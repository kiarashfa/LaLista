/**
 * master.xlsx → src/content/vocabulary/words.json + groups.json
 * + data/vocabulary/disambiguation-report.md
 *
 * Read-only against the workbook (safe without openpyxl's rich_text caveat —
 * we never write back). Fails loudly on any value outside the known taxonomy
 * rather than guessing.
 *
 * Run: npm run data:convert
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { parseCsvRecords } from './lib/csv.ts';
import { buildRelatedWords, findExactDuplicates } from '../src/lib/duplicateDetection.ts';
import type { Gender, PartOfSpeech, Word, WordGroup } from '../src/types/word.ts';

const ROOT = resolve(import.meta.dirname, '..');
const WORKBOOK = resolve(ROOT, 'data/vocabulary/master.xlsx');
const MANIFEST = resolve(ROOT, 'data/vocabulary/audio-manifest.csv');
const MANUAL_RELATED = resolve(ROOT, 'data/vocabulary/related-manual.json');
const DISAMBIGUATION_NOTES = resolve(ROOT, 'data/vocabulary/disambiguation-notes.json');
const AUDIO_DIR = resolve(ROOT, 'public/audio');
const OUT_DIR = resolve(ROOT, 'src/content/vocabulary');
const REPORT = resolve(ROOT, 'data/vocabulary/disambiguation-report.md');

const POS_MAP: Record<string, PartOfSpeech> = {
  '[sust.]': 'noun',
  '[verb.]': 'verb',
  '[adj.]': 'adjective',
  '[adv.]': 'adverb',
  '[pron.]': 'pronoun',
  '[prep.]': 'preposition',
  '[conj.]': 'conjunction',
  '[interj.]': 'interjection',
  '[sust./adj.]': 'noun-adjective',
};

const GENDER_MAP: Record<string, Gender> = {
  '[]': null,
  '[masc.]': 'masc',
  '[fem.]': 'fem',
  '[neut.]': 'neut',
  '[invar.]': 'invariable',
  '[masc./fem.]': 'masc-fem',
};

const CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2']);

type CellValue = ExcelJS.CellValue;

/** Plain text of a cell, flattening rich-text runs. */
function cellText(value: CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((run) => run.text).join('');
  }
  throw new Error(`Unexpected cell value type: ${JSON.stringify(value)}`);
}

/** Text of a cell with bold rich-text runs wrapped in **markers** (the Example column bolds the target word). */
function cellMarkedText(value: CellValue): string {
  if (value != null && typeof value === 'object' && 'richText' in value) {
    return value.richText
      .map((run) => (run.font?.bold ? `**${run.text}**` : run.text))
      .join('');
  }
  return cellText(value);
}

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

async function main() {
  // --- Manifest: id → group slug (and sanity data for the validator) ---
  const manifestRows = parseCsvRecords(readFileSync(MANIFEST, 'utf8'));
  const manifestById = new Map(manifestRows.map((r) => [r.ID, r]));
  if (manifestById.size !== manifestRows.length) fail('manifest', 'duplicate IDs in audio-manifest.csv');

  const manualRelated = JSON.parse(readFileSync(MANUAL_RELATED, 'utf8')) as Record<string, string[]>;
  const disambiguationNotes = JSON.parse(readFileSync(DISAMBIGUATION_NOTES, 'utf8')) as Record<string, string>;

  // --- Workbook ---
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK);

  const words: Word[] = [];
  const groups: WordGroup[] = [];
  const seenIds = new Set<string>();

  for (const sheet of workbook.worksheets) {
    const groupSlugs = new Set<string>();
    let count = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const ctx = `${sheet.name} row ${rowNumber}`;
      const id = cellText(row.getCell(1).value).trim();
      if (!id) return; // trailing blank row

      if (seenIds.has(id)) fail(ctx, `duplicate id "${id}"`);
      seenIds.add(id);

      const spanish = cellText(row.getCell(2).value).trim();
      const english = cellText(row.getCell(3).value).trim();
      const attr = cellText(row.getCell(4).value).trim();
      const genderRaw = cellText(row.getCell(5).value).trim();
      const phonetics = cellText(row.getCell(6).value).trim();
      const note = cellText(row.getCell(7).value).trim();
      const cefr = cellText(row.getCell(8).value).trim();
      const example = cellMarkedText(row.getCell(9).value).trim();

      if (!spanish) fail(ctx, 'empty Spanish');
      if (!english) fail(ctx, 'empty English');
      if (!(attr in POS_MAP)) fail(ctx, `unknown Attributes value "${attr}"`);
      if (!(genderRaw in GENDER_MAP)) fail(ctx, `unknown Gender value "${genderRaw}"`);
      if (!CEFR_LEVELS.has(cefr)) fail(ctx, `unknown CEFR Level "${cefr}"`);
      if (!example) fail(ctx, 'empty Example');
      if (phonetics && !/^\/.*\/$/.test(phonetics)) fail(ctx, `Phonetics not slash-delimited: "${phonetics}"`);

      const manifest = manifestById.get(id) ?? fail(ctx, `id "${id}" missing from audio-manifest.csv`);
      if (manifest.Spanish !== spanish)
        fail(ctx, `Spanish mismatch vs manifest: workbook "${spanish}" / manifest "${manifest.Spanish}"`);
      groupSlugs.add(manifest.Group);

      // Disk is the truth for audio existence; _3 (TTS) is guaranteed per SPEC §14.
      const has = (n: number) => existsSync(resolve(AUDIO_DIR, `${id}_${n}.mp3`));
      if (!has(3)) fail(ctx, `missing guaranteed TTS file ${id}_3.mp3`);

      words.push({
        id,
        spanish,
        english,
        phonetics: phonetics || null,
        partOfSpeech: POS_MAP[attr],
        gender: GENDER_MAP[genderRaw],
        group: manifest.Group,
        cefr: cefr as Word['cefr'],
        example,
        registerNote: note || null,
        audio: {
          wordreference: has(1) ? `${id}_1.mp3` : null,
          linguaLibre: has(2) ? `${id}_2.mp3` : null,
          tts: `${id}_3.mp3`,
        },
        disambiguationNote: disambiguationNotes[id] ?? null,
        relatedWords: [], // filled below
      });
      count++;
    });

    if (groupSlugs.size !== 1)
      fail(sheet.name, `expected exactly one group slug per sheet, got: ${[...groupSlugs].join(', ')}`);
    groups.push({ slug: [...groupSlugs][0], title: sheet.name, count });
  }

  // --- Related words (exact-match English + manual links) ---
  const related = buildRelatedWords(words, manualRelated);
  for (const word of words) word.relatedWords = related.get(word.id)!;

  for (const [id, note] of Object.entries(disambiguationNotes)) {
    if (!seenIds.has(id)) fail('disambiguation-notes.json', `unknown word id "${id}"`);
    if (!note.trim()) fail('disambiguation-notes.json', `empty note for "${id}"`);
  }

  // --- Outputs ---
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, 'words.json'), JSON.stringify(words, null, 2) + '\n');
  writeFileSync(resolve(OUT_DIR, 'groups.json'), JSON.stringify(groups, null, 2) + '\n');

  // --- "Needs disambiguation note" report (SPEC §4 step 4) ---
  const duplicateGroups = findExactDuplicates(words);
  const needingNotes = duplicateGroups.filter((g) => g.ids.some((id) => !disambiguationNotes[id]));
  const bySpanish = new Map(words.map((w) => [w.id, w.spanish]));
  const lines = [
    '# Disambiguation-note checklist',
    '',
    '> Generated by `npm run data:convert` — do not hand-edit. Auto-linked groups',
    '> (exact-match English) where at least one member still lacks a note in',
    '> `disambiguation-notes.json`. SPEC §4: each flagged group needs a human-written,',
    '> owner-approved note before it silently ships empty.',
    '',
    `Total auto-linked groups: ${duplicateGroups.length} · still needing notes: ${needingNotes.length}`,
    '',
    '| English | Words | Missing notes |',
    '|---|---|---|',
    ...needingNotes.map((g) => {
      const members = g.ids.map((id) => `${bySpanish.get(id)} (\`${id}\`)`).join(', ');
      const missing = g.ids.filter((id) => !disambiguationNotes[id]).length;
      return `| ${g.english} | ${members} | ${missing}/${g.ids.length} |`;
    }),
    '',
  ];
  writeFileSync(REPORT, lines.join('\n'));

  const withNotes = words.filter((w) => w.disambiguationNote).length;
  console.log(
    `words.json: ${words.length} words in ${groups.length} groups · ` +
      `${words.filter((w) => w.audio.wordreference).length} with WR audio, ` +
      `${words.filter((w) => w.audio.linguaLibre).length} with LL audio · ` +
      `${words.filter((w) => w.phonetics).length} with phonetics · ` +
      `${duplicateGroups.length} duplicate groups (${withNotes} words noted, ${needingNotes.length} groups pending)`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
