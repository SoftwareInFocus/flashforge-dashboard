import {readWorkbook} from '../../../../lib/social/workbook';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(await readWorkbook(),{headers:{'Cache-Control':'no-store'}});}
