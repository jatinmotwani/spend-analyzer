import { expect, test } from 'vitest';
import { combineAlternatives, speechLang } from '@/components/useSpeech';
import { chooseDrafts } from '@/lib/drafts';

const TODAY = '2026-09-29';

test('prefers an alternative that has an amount', () => {
  const r = chooseDrafts(['spent at Starbucks', '450 at Starbucks'], TODAY, new Map());
  expect(r?.heard).toBe('450 at Starbucks');
  expect(r?.drafts[0]).toMatchObject({ amount: 450, title: 'Starbucks', category: 'food', learned: false });
});

test('prefers a place the user has filed before, and uses their category', () => {
  const learned = new Map([['chaayos', 'fun' as const]]);
  const r = chooseDrafts(['120 at chaos', '120 at Chaayos'], TODAY, learned);
  expect(r?.heard).toBe('120 at Chaayos');
  expect(r?.drafts[0]).toMatchObject({ title: 'Chaayos', category: 'fun', learned: true });
});

test('otherwise keeps the engine ranking', () => {
  expect(chooseDrafts(['200 for lunch', '200 for launch'], TODAY, new Map())?.heard).toBe('200 for lunch');
});

test('nothing parseable gives null', () => {
  expect(chooseDrafts(['hello there'], TODAY, new Map())).toBeNull();
});

test('combineAlternatives stitches segments and dedupes', () => {
  const results = [
    [{ transcript: 'spent 450' }, { transcript: 'spent 415' }],
    [{ transcript: ' at Starbucks' }],
  ];
  expect(combineAlternatives(results)).toEqual(['spent 450 at Starbucks', 'spent 415 at Starbucks']);
  expect(combineAlternatives([[{ transcript: 'a' }, { transcript: 'a' }]])).toEqual(['a']);
});

test('INR users get Indian English recognition', () => {
  // Node reports navigator.language as en-US, like most phones set to English
  expect(speechLang('INR')).toBe('en-IN');
  expect(speechLang('USD')).toBe(navigator.language);
});
