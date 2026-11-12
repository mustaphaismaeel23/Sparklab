const MAX_USERNAME_LENGTH = 24;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/\s+/g, '-');
}

export function createUsername(fullName: string, usedUsernames: ReadonlySet<string>) {
  const slug = fullName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const normalizedBase = (slug || 'person').slice(0, MAX_USERNAME_LENGTH);
  const base = normalizedBase.length < 3 ? `${normalizedBase}-user` : normalizedBase;
  const used = new Set([...usedUsernames].map(username => username.toLowerCase()));
  let candidate = base.slice(0, MAX_USERNAME_LENGTH);
  let suffix = 2;

  while (used.has(candidate.toLowerCase())) {
    const suffixText = `-${suffix++}`;
    const prefix = base.slice(0, MAX_USERNAME_LENGTH - suffixText.length).replace(/-+$/g, '') || 'user';
    candidate = `${prefix}${suffixText}`;
  }

  return candidate;
}
