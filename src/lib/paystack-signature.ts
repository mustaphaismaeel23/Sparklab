import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return timingSafeEqual(expected, received);
}
