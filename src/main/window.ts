import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { BrowserWindow, app, nativeTheme, screen } from 'electron';
import { appIconPath } from './resources';
import { isExternalWebUrl, openExternalWebUrl } from './externalUrl';

type SavedBounds = {
  width: number;
  height: number;
  x?: number;
  y?: number;
};

const defaultBounds = {
  width: 420,
  height: 860,
  minWidth: 360,
  maxWidth: 520,
  minHeight: 560,
};

function boundsPath(): string {
  return join(app.getPath('userData'), 'window-bounds.json');
}

function readBounds(): SavedBounds {
  const path = boundsPath();

  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as SavedBounds;
      if ([parsed.width, parsed.height, parsed.x ?? 0, parsed.y ?? 0].every(Number.isFinite) && parsed.width > 0 && parsed.height > 0) {
        const display = screen.getDisplayMatching({ x: parsed.x ?? 0, y: parsed.y ?? 0, width: parsed.width, height: parsed.height }).workArea;
        const width = Math.min(Math.max(parsed.width, defaultBounds.minWidth), defaultBounds.maxWidth, display.width);
        const height = Math.min(Math.max(parsed.height, defaultBounds.minHeight), display.height);
        return { width, height,
          x: Math.min(Math.max(parsed.x ?? display.x, display.x), display.x + display.width - width),
          y: Math.min(Math.max(parsed.y ?? display.y, display.y), display.y + display.height - height) };
      }
    } catch {
      // Fall back to the right-edge default when the saved shape is unreadable.
    }
  }

  const display = screen.getPrimaryDisplay().workArea;
  return {
    width: defaultBounds.width,
    height: Math.min(defaultBounds.height, display.height),
    x: display.x + display.width - defaultBounds.width - 18,
    y: display.y + 18,
  };
}

function persistBounds(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return;
  }

  const path = boundsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(window.getBounds(), null, 2));
}

export function createMainWindow(): BrowserWindow {
  const bounds = readBounds();

  const mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: defaultBounds.minWidth,
    maxWidth: defaultBounds.maxWidth,
    minHeight: defaultBounds.minHeight,
    title: 'WayBetter Calendar',
    icon: appIconPath(),
    show: true,
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#272822' : '#f8f8f9',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('resize', () => persistBounds(mainWindow));
  mainWindow.on('move', () => persistBounds(mainWindow));
  mainWindow.on('close', () => persistBounds(mainWindow));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url)) void openExternalWebUrl(url).catch(console.error);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      if (isExternalWebUrl(url)) void openExternalWebUrl(url).catch(console.error);
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}
