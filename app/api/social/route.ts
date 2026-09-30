import { readSocial } from '../../../lib/social/source';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(await readSocial(),{headers:{'Cache-Control':'no-store'}});}
