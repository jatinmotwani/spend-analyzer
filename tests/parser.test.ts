import { describe, expect, test } from 'vitest';
import { categorize, parseSpends, wordsToNumbers } from '@/lib/parser';

const TODAY = '2026-09-29'; // a Tuesday

const one = (text: string) => {
  const r = parseSpends(text, TODAY);
  expect(r, `one spend for "${text}"`).toHaveLength(1);
  return r[0];
};

describe('parseSpends', () => {
  test('amount and place', () => {
    const s = one('I spent 450 rupees at Starbucks');
    expect(s).toMatchObject({ amount: 450, title: 'Starbucks', category: 'food', date: TODAY });
  });

  test('currency symbols, commas, decimals and k', () => {
    expect(one('₹1,200 at DMart').amount).toBe(1200);
    expect(one('$4.50 for coffee').amount).toBe(4.5);
    expect(one('paid Rs.300 for petrol').amount).toBe(300);
    expect(one('2.5k on rent').amount).toBe(2500);
  });

  test('item and place together', () => {
    expect(one('paid 1200 for groceries at DMart')).toMatchObject({ title: 'Dmart', note: 'groceries', category: 'groceries' });
  });

  test('prefers the currency-marked or the largest number', () => {
    expect(one('2 coffees for 300').amount).toBe(300);
    expect(one('bought 3 shirts for 1500 rupees')).toMatchObject({ amount: 1500, category: 'shopping' });
  });

  test('several spends in one sentence', () => {
    const r = parseSpends('250 on lunch and 100 for an auto', TODAY);
    expect(r.map((s) => [s.amount, s.category])).toEqual([
      [250, 'food'],
      [100, 'travel'],
    ]);
  });

  test('pieces without an amount stay with their neighbour', () => {
    expect(one('coffee and cake for 300')).toMatchObject({ amount: 300, category: 'food' });
  });

  test('relative dates', () => {
    expect(one('uber 180 yesterday').date).toBe('2026-09-28');
    expect(one('movie 500 day before yesterday').date).toBe('2026-09-27');
    expect(one('spent 90 on sunday at the chemist').date).toBe('2026-09-27');
    expect(one('last tuesday 400 on dinner').date).toBe('2026-09-22');
  });

  test('no amount, nothing parsed', () => {
    expect(parseSpends('went to the mall', TODAY)).toEqual([]);
    expect(parseSpends('', TODAY)).toEqual([]);
  });

  test('never returns more than 10 spends', () => {
    const many = Array.from({ length: 15 }, (_, i) => `${i + 1} on tea`).join(' and ');
    expect(parseSpends(many, TODAY)).toHaveLength(10);
  });
});

test('wordsToNumbers', () => {
  expect(wordsToNumbers('two hundred and fifty on lunch')).toBe('250 on lunch');
  expect(wordsToNumbers('twenty five dollars')).toBe('25 dollars');
  expect(wordsToNumbers('a thousand for rent')).toBe('1000 for rent');
  expect(wordsToNumbers('2 thousand 5 hundred')).toBe('2500');
  expect(wordsToNumbers('250 and 100')).toBe('250 and 100');
});

test('categorize', () => {
  expect(categorize('uber eats dinner')).toBe('food');
  expect(categorize('uber to office')).toBe('travel');
  expect(categorize('netflix subscription')).toBe('fun');
  expect(categorize('electricity bill')).toBe('bills');
  expect(categorize('medicines from apollo')).toBe('health');
  expect(categorize('random thing')).toBe('other');
});
