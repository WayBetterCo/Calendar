import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const appName = 'WayBetter Calendar';
const candidates = process.platform === 'darwin'
  ? [join(root, `dist/mac-${process.arch}/${appName}.app`), join(root, `dist/mac/${appName}.app`), join(root, `dist/local-install/mac-${process.arch}/${appName}.app`), join(root, `dist/local-install/mac/${appName}.app`)]
  : [join(root, `dist/win-unpacked/${appName}.exe`)];
const target = process.argv[2] ? resolve(process.argv[2]) : candidates.find(existsSync);
if (!target) throw new Error('Package an app first, or pass the installed app path to smoke:packaged.');
const executable = target.endsWith('.app') ? join(target, `Contents/MacOS/${appName}`) : target;
const userData = mkdtempSync(join(tmpdir(), 'waybetter-smoke-'));
let running;
try {
  running = await launch();
  const result = await running.evaluate(`(async () => {
    const api = window.waybetterCalendar;
    const accounts = await api.auth.listAccounts();
    if (accounts.length) throw new Error('Smoke test must use isolated storage.');
    const calendars = await api.calendar.listCalendars();
    const calendar = calendars.find(c => c.canWrite !== false);
    const event = await api.calendar.createEvent({ calendarId: calendar.id, title: 'Packaged smoke test', date: '2026-10-17', startTime: '10:00', endTime: '10:30', addVideoCall: false, guests: [], notes: 'Persist across restart' });
    await api.settings.update({ timeFormat: '24h', showWeather: false });
    return { id: event.id, calendarId: event.calendarId, title: document.title, root: document.querySelector('#root').children.length };
  })()`);
  assert.equal(result.title, appName);
  assert.ok(result.root > 0, 'React UI did not mount');
  await running.stop();
  running = await launch();
  const afterRestart = await running.evaluate(`(async () => {
    const api = window.waybetterCalendar;
    const input = ${JSON.stringify({ startsAt: '2026-10-17T00:00:00.000Z', endsAt: '2026-10-19T00:00:00.000Z', calendarIds: [result.calendarId] })};
    const found = (await api.calendar.listEvents(input)).find(e => e.id === ${JSON.stringify(result.id)});
    if (!found) throw new Error('Created event was lost after restart.');
    await api.calendar.updateEvent({ id: found.id, calendarId: found.calendarId, title: 'Updated after restart', notes: '' });
    const changed = (await api.calendar.listEvents(input)).find(e => e.id === found.id);
    await api.calendar.deleteEvent({ id: found.id, calendarId: found.calendarId });
    const deleted = !(await api.calendar.listEvents(input)).some(e => e.id === found.id);
    const settings = await api.settings.get();
    let unsafeLinkRejected = false;
    try { await api.shell.openExternal('file:///etc/passwd'); } catch { unsafeLinkRejected = true; }
    return { updated: changed.title === 'Updated after restart' && !changed.description, deleted, savedSettings: settings.timeFormat === '24h' && settings.showWeather === false, unsafeLinkRejected };
  })()`);
  assert.deepEqual(afterRestart, { updated: true, deleted: true, savedSettings: true, unsafeLinkRejected: true });
  const dateNavigation = await running.evaluate(`(async () => {
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const settle = async () => { await frame(); await frame(); };
    const style = document.createElement('style');
    style.textContent = '* { transition: none !important; }';
    document.head.append(style);
    const header = document.querySelector('.app-header');
    const initialHeight = header.getBoundingClientRect().height;
    document.querySelector('[aria-label="Previous day"]').click();
    await settle();
    const jump = document.querySelector('.date-jump-button');
    if (!jump) throw new Error('Browsing away from today did not expose the date return action.');
    const browsingHeight = header.getBoundingClientRect().height;
    jump.focus();
    await settle();
    const focusShowsJump = getComputedStyle(jump).opacity === '1'
      && getComputedStyle(document.querySelector('.selected-date-label')).opacity === '0';
    const jumpInsideDate = Boolean(document.querySelector('.selected-date .date-jump-button'));
    const noExtraRow = !document.querySelector('.today-jump');
    jump.click();
    await settle();
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    const returnedToToday = document.querySelector('[aria-label="Select agenda date"]')?.value === today;
    const stableHeight = initialHeight === browsingHeight && initialHeight === header.getBoundingClientRect().height;
    style.remove();
    return { focusShowsJump, jumpInsideDate, noExtraRow, returnedToToday, stableHeight };
  })()`);
  assert.deepEqual(dateNavigation, { focusShowsJump: true, jumpInsideDate: true, noExtraRow: true, returnedToToday: true, stableHeight: true });
  const externalEventRefreshed = await running.evaluate(`(async () => {
    const api = window.waybetterCalendar;
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    // Bypass the renderer mutation to simulate an event arriving from elsewhere.
    const event = await api.calendar.createEvent({ calendarId: ${JSON.stringify(result.calendarId)}, title: 'External refresh smoke event', date, startTime: '10:00', endTime: '10:30', addVideoCall: false, guests: [] });
    try {
      window.dispatchEvent(new Event('focus'));
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (document.body.textContent.includes(event.title)) return true;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return false;
    } finally {
      await api.calendar.deleteEvent({ id: event.id, calendarId: event.calendarId });
    }
  })()`);
  assert.equal(externalEventRefreshed, true, 'Returning to the app did not load an externally added event.');
  console.log(`Packaged smoke test passed: startup, preload, React, event CRUD, restart persistence, settings, URL validation, stable date navigation and automatic focus refresh (${target}).`);
} finally {
  await running?.stop();
  rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}

async function launch() {
  let logs = '';
  const child = spawn(executable, ['--remote-debugging-port=0'], { env: { ...process.env, WAYBETTER_USER_DATA_DIR: userData, ELECTRON_ENABLE_LOGGING: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let socket;
  let launchError;
  try {
  child.on('error', error => { launchError = error; });
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  const deadline = Date.now() + 45000;
  let page;
  while (Date.now() < deadline && !page) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error(`App exited before startup (${child.exitCode}): ${logs.slice(-4000)}`);
    const port = logs.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)?.[1];
    if (port) {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()).catch(() => []);
      page = targets.find(item => item.type === 'page' && item.url.startsWith('file:'));
    }
    if (!page) await delay(100);
  }
  if (!page) { child.kill(); throw new Error(`Packaged renderer did not load: ${logs.slice(-4000)}`); }
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const pending = new Map();
  let nextId = 0;
  socket.addEventListener('message', message => {
    const response = JSON.parse(String(message.data));
    if (!response.id) return;
    const waiter = pending.get(response.id);
    if (!waiter) return;
    pending.delete(response.id);
    response.error ? waiter.reject(new Error(response.error.message)) : waiter.resolve(response.result);
  });
  const evaluate = async expression => {
    const id = ++nextId;
    let timer;
    let response;
    try {
      response = await new Promise((resolve, reject) => {
        timer = setTimeout(() => { pending.delete(id); reject(new Error('Renderer evaluation timed out.')); }, 20000);
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
      });
    } finally { clearTimeout(timer); }
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  };
  while (!await evaluate('Boolean(window.waybetterCalendar && document.querySelector("#root")?.children.length)')) {
    if (Date.now() > deadline) throw new Error('Preload API or renderer was unavailable.');
    await delay(100);
  }
  return { evaluate, stop: async () => {
    socket.close();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(5000, undefined, { ref: false })]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  } };
  } catch (error) {
    socket?.close();
    child.kill('SIGKILL');
    throw error;
  }
}
