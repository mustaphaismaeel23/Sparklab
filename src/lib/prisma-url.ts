export function configurePrismaUrl(connectionString: string) {
  const url = new URL(connectionString);
  if (url.hostname.endsWith('.pooler.supabase.com') && url.port === '6543') {
    url.searchParams.set('pgbouncer', 'true');
  }
  return url.toString();
}
