import { equal } from 'node:assert/strict';
import { test } from 'node:test';
import { createUsername, normalizeUsername } from './usernames';

test('normalizes entered usernames', () => {
  equal(normalizeUsername('  Amina Yusuf  '), 'amina-yusuf');
});

test('creates a normalized username from a name', () => {
  equal(createUsername('Amina Yusuf', new Set()), 'amina-yusuf');
});

test('adds a suffix when the username already exists', () => {
  equal(createUsername('Amina Yusuf', new Set(['AMINA-YUSUF'])), 'amina-yusuf-2');
});

test('creates a valid fallback for names without ASCII letters', () => {
  equal(createUsername('李', new Set()), 'person');
});
