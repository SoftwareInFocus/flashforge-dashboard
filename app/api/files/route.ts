import { listStoredFiles } from '../../../lib/jobs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(await listStoredFiles(),{headers:{'Cache-Control':'no-store'}});}
