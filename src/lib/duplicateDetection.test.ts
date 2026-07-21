import { describe, expect, it } from 'vitest';
import { buildRelatedWords, findExactDuplicates, normalizeEnglish } from './duplicateDetection';

describe('normalizeEnglish', () => {
  it('lowercases and trims only — no fuzzy matching', () => {
    expect(normalizeEnglish('  School ')).toBe('school');
    expect(normalizeEnglish('schools')).not.toBe('school');
  });
});

describe('findExactDuplicates', () => {
  it('groups exact matches and ignores unique words', () => {
    const groups = findExactDuplicates([
      { id: 'school_escuela', english: 'school' },
      { id: 'school_colegio', english: 'School' },
      { id: 'food_pan', english: 'bread' },
    ]);
    expect(groups).toEqual([{ english: 'school', ids: ['school_escuela', 'school_colegio'] }]);
  });
});

describe('buildRelatedWords', () => {
  const words = [
    { id: 'a', english: 'x' },
    { id: 'b', english: 'x' },
    { id: 'c', english: 'y' },
    { id: 'd', english: 'z' },
  ];

  it('links duplicate-group members to each other, not themselves', () => {
    const related = buildRelatedWords(words);
    expect(related.get('a')).toEqual(['b']);
    expect(related.get('b')).toEqual(['a']);
    expect(related.get('c')).toEqual([]);
  });

  it('applies manual links symmetrically on top of auto links', () => {
    const related = buildRelatedWords(words, { c: ['d'] });
    expect(related.get('c')).toEqual(['d']);
    expect(related.get('d')).toEqual(['c']);
  });

  it('rejects manual links to unknown ids', () => {
    expect(() => buildRelatedWords(words, { c: ['nope'] })).toThrow(/unknown word id/);
    expect(() => buildRelatedWords(words, { nope: ['c'] })).toThrow(/unknown word id/);
  });
});
