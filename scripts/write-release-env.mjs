import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

loadDotenv();

const outputPath = resolve('resources/.env');

const entries = [
  ['WAYBETTER_GOOGLE_CLIENT_ID', valueFor('WAYBETTER_GOOGLE_CLIENT_ID', 'DAYLINE_GOOGLE_CLIENT_ID')],
  ['WAYBETTER_MICROSOFT_CLIENT_ID', valueFor('WAYBETTER_MICROSOFT_CLIENT_ID', 'DAYLINE_MICROSOFT_CLIENT_ID')],
  ['WAYBETTER_MICROSOFT_REDIRECT_PORT', valueFor('WAYBETTER_MICROSOFT_REDIRECT_PORT', 'DAYLINE_MICROSOFT_REDIRECT_PORT') ?? '53685'],
  ['WAYBETTER_ZOOM_CLIENT_ID', valueFor('WAYBETTER_ZOOM_CLIENT_ID', 'DAYLINE_ZOOM_CLIENT_ID')],
  ['WAYBETTER_ZOOM_REDIRECT_PORT', valueFor('WAYBETTER_ZOOM_REDIRECT_PORT', 'DAYLINE_ZOOM_REDIRECT_PORT') ?? '53683'],
  ['WAYBETTER_TEAMS_CLIENT_ID', valueFor('WAYBETTER_TEAMS_CLIENT_ID', 'DAYLINE_TEAMS_CLIENT_ID')],
  ['WAYBETTER_TEAMS_REDIRECT_PORT', valueFor('WAYBETTER_TEAMS_REDIRECT_PORT', 'DAYLINE_TEAMS_REDIRECT_PORT') ?? '53684'],
].filter((entry) => Boolean(entry[1]));

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  [
    '# Generated during release packaging.',
    '# Contains public OAuth client IDs and redirect ports only. Do not add client secrets here.',
    ...entries.map(([key, value]) => `${key}=${value}`),
    '',
  ].join('\n'),
);

console.log(`Wrote release environment with ${entries.length} public entries to ${outputPath}.`);

function valueFor(primary, legacy) {
  return process.env[primary] || process.env[legacy] || undefined;
}
