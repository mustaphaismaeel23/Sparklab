export function getAppBaseUrl(requestUrl?: string) {
  const configuredUrl = process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : requestUrl);
  if (!configuredUrl) throw new Error('APP_URL is not configured.');

  const url = new URL(configuredUrl);
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
  ) {
    throw new Error('APP_URL must be a valid HTTPS application URL.');
  }
  return url.origin;
}
