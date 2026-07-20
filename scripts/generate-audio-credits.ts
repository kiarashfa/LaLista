/**
 * Regenerates the CC-BY-4.0 attribution file for the Lingua Libre recordings
 * (SPEC §12/§14: crediting the speakers is a licence condition, not a courtesy).
 * Output is generated content → lives beside words.json, and will back credits page
 *
 * Run: npm run data:credits
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCsvRecords } from './lib/csv.ts';

const ROOT = resolve(import.meta.dirname, '..');
const AUDIO_DIR = resolve(ROOT, 'public/audio');
const OUT = resolve(ROOT, 'src/content/vocabulary/audio-credits.md');

const manifest = parseCsvRecords(
  readFileSync(resolve(ROOT, 'data/vocabulary/audio-manifest.csv'), 'utf8'),
);

const bySpeaker = new Map<string, number>();
let total = 0;
let wrTotal = 0;
for (const row of manifest) {
  if (row.WR_File && existsSync(resolve(AUDIO_DIR, row.WR_File))) wrTotal++;
  if (!row.LL_File || !existsSync(resolve(AUDIO_DIR, row.LL_File))) continue;
  const speaker = row.LL_Speaker || '(unnamed)';
  bySpeaker.set(speaker, (bySpeaker.get(speaker) ?? 0) + 1);
  total++;
}

const speakers = [...bySpeaker.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const md = `# Audio Credits

## WordReference recordings

${wrTotal} pronunciation recordings come from
[WordReference.com](https://www.wordreference.com/), whose audio has long been
a reference for Spanish learners — gratefully credited as this site's default
voice.

## Lingua Libre recordings (CC BY 4.0)

${total} of LaLista's pronunciation recordings come from
[Lingua Libre](https://lingualibre.org/), a project of Wikimédia France, and are
hosted on [Wikimedia Commons](https://commons.wikimedia.org/). They are licensed
under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
and were recorded by the following ${speakers.length} volunteer speakers, whom we
thank by name as the licence requires:

| Speaker | Recordings |
|---|---|
${speakers.map(([name, n]) => `| ${name} | ${n} |`).join('\n')}

Recordings are used unmodified apart from file renaming.

## Text-to-speech recordings

The remaining pronunciations are synthesized with
[Piper TTS](https://github.com/rhasspy/piper) (MIT licence) using the
\`es_ES-davefx-medium\` voice, trained on a CC0 dataset.

## Phonetic transcriptions

IPA transcriptions come from
[ipa-dict](https://github.com/open-dict-data/ipa-dict) (\`es_ES\`), MIT licence.
`;

writeFileSync(OUT, md);
console.log(`audio-credits.md: ${total} LL recordings across ${speakers.length} speakers`);
