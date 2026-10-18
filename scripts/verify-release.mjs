import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ref = process.env.GITHUB_REF || '';
if (ref.startsWith('refs/tags/') && ref !== `refs/tags/v${version}`) {
  throw new Error(`Release tag must be v${version}, matching package.json.`);
}
console.log(`Validated version ${version}.`);
