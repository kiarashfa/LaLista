/**
 * Validates the compiled vocabulary data against the workbook contract and the
 * audio files actually on disk. Run after data:convert; CI runs it against the
 * committed words.json (master.xlsx is gitignored, so CI can't regenerate it).
 *
 * Run: npm run data:validate
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCsvRecords } from './lib/csv.ts';
import type { Word, WordGroup } from '../src/types/word.ts';

const ROOT = resolve(import.meta.dirname, '..');
const AUDIO_DIR = resolve(ROOT, 'public/audio');
const errors: string[] = [];
const warnings: string[] = [];

const words = JSON.parse(
  readFileSync(resolve(ROOT, 'src/content/vocabulary/words.json'), 'utf8'),
) as Word[];
const groups = JSON.parse(
  readFileSync(resolve(ROOT, 'src/content/vocabulary/groups.json'), 'utf8'),
) as WordGroup[];
const manifest = parseCsvRecords(
  readFileSync(resolve(ROOT, 'data/vocabulary/audio-manifest.csv'), 'utf8'),
);

// --- Words ---
if (words.length !== 2001) errors.push(`expected 2001 words, found ${words.length}`);

// The WordReference (_1) files are personal-use only and gitignored (SPEC §14):
// a public checkout (e.g. CI) legitimately has NONE of them. All-absent is
// fine; PARTIALLY absent means something got lost locally — that's an error.
const wrExpected = words.filter((w) => w.audio.wordreference).length;
const wrOnDisk = words.filter(
  (w) => w.audio.wordreference && existsSync(resolve(AUDIO_DIR, w.audio.wordreference)),
).length;
const wrCheckout = wrOnDisk > 0;
if (!wrCheckout) console.log(`validate-vocab: public checkout — all ${wrExpected} personal _1 files absent (expected)`);

const ids = new Set<string>();
for (const w of words) {
  if (ids.has(w.id)) errors.push(`duplicate id "${w.id}"`);
  ids.add(w.id);
  if (!/^[^\s_]+_[^\s]+$/.test(w.id)) errors.push(`id "${w.id}" not in <prefix>_<word> shape`);
  for (const file of [wrCheckout ? w.audio.wordreference : null, w.audio.linguaLibre, w.audio.tts]) {
    if (file && !existsSync(resolve(AUDIO_DIR, file)))
      errors.push(`${w.id}: referenced audio file missing on disk: ${file}`);
  }
  for (const rel of w.relatedWords) {
    if (rel === w.id) errors.push(`${w.id}: relatedWords contains itself`);
  }
}
for (const w of words) {
  for (const rel of w.relatedWords) {
    if (!ids.has(rel)) errors.push(`${w.id}: relatedWords references unknown id "${rel}"`);
  }
}

// --- Groups ---
const groupSlugs = new Set(groups.map((g) => g.slug));
if (groupSlugs.size !== groups.length) errors.push('duplicate group slugs in groups.json');
for (const w of words) {
  if (!groupSlugs.has(w.group)) errors.push(`${w.id}: unknown group "${w.group}"`);
}
for (const g of groups) {
  const actual = words.filter((w) => w.group === g.slug).length;
  if (actual !== g.count) errors.push(`group ${g.slug}: count ${g.count} but ${actual} words`);
}

// --- Manifest cross-check (SPEC §14: read the manifest rather than assuming) ---
const byId = new Map(words.map((w) => [w.id, w]));
for (const row of manifest) {
  const w = byId.get(row.ID);
  if (!w) {
    errors.push(`manifest ID "${row.ID}" not in words.json`);
    continue;
  }
  if (row.LL_File && !w.audio.linguaLibre)
    warnings.push(`${row.ID}: manifest lists ${row.LL_File} but file absent on disk`);
  if (!row.LL_File && w.audio.linguaLibre)
    warnings.push(`${row.ID}: disk has ${w.audio.linguaLibre} but manifest lists no LL recording`);
}
if (manifest.length !== words.length)
  errors.push(`manifest has ${manifest.length} rows, words.json has ${words.length}`);

// --- Orphan audio files on disk ---
const expected = new Set(
  words.flatMap((w) => [w.audio.wordreference, w.audio.linguaLibre, w.audio.tts].filter(Boolean)),
);
const onDisk = readdirSync(AUDIO_DIR).filter((f) => f.endsWith('.mp3'));
for (const file of onDisk) {
  if (!expected.has(file)) warnings.push(`orphan audio file (no word references it): ${file}`);
}

// --- Summary ---
const phonetics = words.filter((w) => w.phonetics).length;
console.log(
  `validate-vocab: ${words.length} words, ${groups.length} groups, ` +
    `${phonetics} with phonetics, ${onDisk.length} audio files on disk`,
);
for (const wmsg of warnings) console.warn(`  warning: ${wmsg}`);
if (errors.length) {
  for (const e of errors) console.error(`  ERROR: ${e}`);
  process.exit(1);
}
console.log(`validate-vocab: OK (${warnings.length} warnings)`);
