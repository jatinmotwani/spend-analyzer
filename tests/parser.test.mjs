import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSpends, wordsToNumbers, categorize } from '../js/parser.js';

const NOW = new Date(2026, 8, 29, 12); // Tue 29 Sep 2026

const one = (text) => {
  const r = parseSpends(text, NOW);
  assert.equal(r.length, 1, `expected one spend for "${text}", got ${JSON.stringify(r)}`);
  return r[0];
};

test('amount and place', () => {
  const s = one('I spent 450 rupees at Starbucks');
  assert.equal(s.amount, 450);
  assert.equal(s.title, 'Starbucks');
  assert.equal(s.category, 'food');
  assert.equal(s.date, '2026-09-29');
});

test('currency symbols, commas and decimals', () => {
  assert.equal(one('₹1,200 at DMart').amount, 1200);
  assert.equal(one('$4.50 for coffee').amount, 4.5);
  assert.equal(one('paid Rs.300 for petrol').amount, 300);
  assert.equal(one('2.5k on rent').amount, 2500);
});

test('item and place together', () => {
  const s = one('paid 1200 for groceries at DMart');
  assert.equal(s.title, 'Dmart');
  assert.equal(s.note, 'groceries');
  assert.equal(s.category, 'groceries');
});

test('picks the currency-marked or largest number', () => {
  assert.equal(one('2 coffees for 300').amount, 300);
  assert.equal(one('bought 3 shirts for 1500 rupees').amount, 1500);
  assert.equal(one('bought 3 shirts for 1500 rupees').category, 'shopping');
});

test('spelled-out numbers', () => {
  assert.equal(wordsToNumbers('two hundred and fifty on lunch'), '250 on lunch');
  assert.equal(wordsToNumbers('twenty five dollars'), '25 dollars');
  assert.equal(wordsToNumbers('a thousand for rent'), '1000 for rent');
  assert.equal(wordsToNumbers('2 thousand 5 hundred'), '2500');
  assert.equal(one('twenty dollars on uber').amount, 20);
});

test('multiple spends in one sentence', () => {
  const r = parseSpends('250 on lunch and 100 for an auto', NOW);
  assert.equal(r.length, 2);
  assert.deepEqual(
    r.map((s) => [s.amount, s.category]),
    [
      [250, 'food'],
      [100, 'travel'],
    ],
  );
});

test('pieces without an amount stay with their neighbour', () => {
  const s = one('coffee and cake for 300');
  assert.equal(s.amount, 300);
  assert.equal(s.category, 'food');
});

test('relative dates', () => {
  assert.equal(one('uber 180 yesterday').date, '2026-09-28');
  assert.equal(one('movie 500 day before yesterday').date, '2026-09-27');
  assert.equal(one('spent 90 on sunday at the chemist').date, '2026-09-27');
  assert.equal(one('last tuesday 400 on dinner').date, '2026-09-22');
});

test('categories', () => {
  assert.equal(categorize('uber eats dinner'), 'food');
  assert.equal(categorize('uber to office'), 'travel');
  assert.equal(categorize('netflix subscription'), 'fun');
  assert.equal(categorize('electricity bill'), 'bills');
  assert.equal(categorize('medicines from apollo'), 'health');
  assert.equal(categorize('random thing'), 'other');
});

test('no amount means nothing parsed', () => {
  assert.deepEqual(parseSpends('went to the mall', NOW), []);
  assert.deepEqual(parseSpends('', NOW), []);
});
