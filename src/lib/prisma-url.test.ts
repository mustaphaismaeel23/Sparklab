import { equal } from 'node:assert/strict';
import { test } from 'node:test';
import { configurePrismaUrl } from './prisma-url';

test('enables PgBouncer compatibility for the Supabase transaction pooler', () => {
  const result = new URL(configurePrismaUrl(
    'postgresql://user:password@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require'
  ));
  equal(result.searchParams.get('pgbouncer'), 'true');
  equal(result.searchParams.get('sslmode'), 'require');
});

test('does not alter direct Postgres connection URLs', () => {
  const result = new URL(configurePrismaUrl('postgresql://user:password@localhost:5432/postgres'));
  equal(result.searchParams.has('pgbouncer'), false);
});
