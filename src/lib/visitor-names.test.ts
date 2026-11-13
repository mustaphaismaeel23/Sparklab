import { equal } from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeVisitorName } from './visitor-names';

test('normalizes visitor names for daily duplicate checks', () => {
  equal(normalizeVisitorName('  Ada   LOVELACE  '), 'ada lovelace');
});

test('normalizes Unicode-equivalent visitor names', () => {
  equal(normalizeVisitorName('Ａda Lovelace'), 'ada lovelace');
});
