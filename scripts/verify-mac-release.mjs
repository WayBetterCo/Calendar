import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dist = fileURLToPath(new URL('../dist', import.meta.url));
if (process.env.WAYBETTER_REQUIRE_SIGNED_RELEASE !== 'true') {
  console.log('No Developer ID credentials configured. These artifacts require manual review and remain a draft release.');
  process.exit(0);
}
for (const directory of readdirSync(dist).filter((name) => /^mac(?:-|$)/.test(name))) {
  const app = join(dist, directory, 'WayBetter Calendar.app');
  for (const [command, args] of [
    ['codesign', ['--verify', '--deep', '--strict', app]],
    ['spctl', ['--assess', '--type', 'execute', '--verbose=2', app]],
    ['xcrun', ['stapler', 'validate', app]],
  ]) {
    const result = spawnSync(command, args, { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${command} failed for ${directory}.`);
  }
}
