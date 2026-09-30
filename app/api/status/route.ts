import { readPrinter } from '../../../lib/printer';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let pending: ReturnType<typeof readPrinter> | null = null;
let cached: Awaited<ReturnType<typeof readPrinter>> | null = null;
let cachedAt = 0;
export async function GET() {
 if (!cached || Date.now() - cachedAt > 2000) {
  pending ??= readPrinter().then(value => {cached = value; cachedAt = Date.now();return value;}).finally(() => {pending = null;});
  await pending;
 }
 return Response.json(cached,{headers:{'Cache-Control':'no-store'}});
}
