import { getPrintThumbnail } from '../../../lib/jobs';
export const runtime='nodejs';
export async function GET(req:Request){return Response.json(await getPrintThumbnail(new URL(req.url).searchParams.get('fileName')??''),{headers:{'Cache-Control':'no-store'}});}
