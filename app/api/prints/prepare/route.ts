import { prepareStoredPrint, prepareSchema } from '../../../../lib/jobs';
export const runtime='nodejs';
export async function POST(req:Request){
 const origin=req.headers.get('origin');const host=req.headers.get('host');
 if(!origin||new URL(origin).host!==host||!['127.0.0.1','localhost'].includes(new URL(req.url).hostname))return Response.json({ok:false,message:'Only local dashboard requests are accepted.'},{status:403});
 try{const input=prepareSchema.safeParse(await req.json());if(!input.success)return Response.json({ok:false,message:'Invalid print selection.'},{status:400});return Response.json(await prepareStoredPrint(input.data));}
 catch(e){return Response.json({ok:false,message:e instanceof Error?e.message:'Print request failed.'},{status:400});}
}
