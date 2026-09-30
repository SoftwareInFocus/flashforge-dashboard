import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {WorkbookFile,type WorkbookData} from './analytics';
import {ScoutRow,validateRows,HEADERS} from './schema';
import {z} from 'zod';
const exec=promisify(execFile);
export const ScoutRun=z.object({schema_version:z.literal('1'),run_id:z.string().uuid(),scouted_at:z.iso.datetime({offset:true}),opportunities:z.array(z.object(Object.fromEntries(HEADERS.map(h=>[h,z.string()]))).strict()).max(500)}).strict().superRefine((run,ctx)=>{
 const seen=new Set<string>();
 for(const [index,row] of run.opportunities.entries()){
  const checked=ScoutRow.safeParse(row);
  if(!checked.success)ctx.addIssue({code:'custom',message:'Invalid scout row',path:['opportunities',index]});
  if(seen.has(row.id))ctx.addIssue({code:'custom',message:'Duplicate opportunity ID',path:['opportunities',index,'id']});
  seen.add(row.id);
 }
});
export function checkMirror(workbook:WorkbookData,run:unknown){
 const parsed=ScoutRun.parse(run);const table=workbook.tabs['Muse Daily Scout'];
 const valid=validateRows(table?.map(row=>row.map(v=>String(v??''))));
 if(valid.issues.length)throw new Error('Scout mirror contains invalid rows');
 for(const opportunity of parsed.opportunities){
  const row=valid.rows.find(v=>v.id===opportunity.id);
  // Human review status can change in Sheets after the daily run was archived.
  if(!row||HEADERS.some(h=>h!=='status'&&String(row[h])!==String(h==='score'?Number(opportunity[h]):opportunity[h])))throw new Error('Sheet mirror and scout run disagree');
 }
 return workbook;
}
export async function fetchGithubMirror(repo:string,api:(args:string[])=>Promise<string>=async args=>(await exec(process.env.GITHUB_CLI_PATH||'gh',args,{timeout:30000,maxBuffer:6_000_000,env:{...process.env,GH_PROMPT_DISABLED:'1',GIT_TERMINAL_PROMPT:'0'}})).stdout){
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw new Error('Invalid private data repository');
 const metadata=JSON.parse(await api(['api',`repos/${repo}`]));
 if(metadata.private!==true)throw new Error('Data repository must be private');
 const sha=(await api(['api',`repos/${repo}/commits/main`,'--jq','.sha'])).trim();
 if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('Invalid source revision');
 const read=(path:string)=>api(['api','-H','Accept: application/vnd.github.raw+json',`repos/${repo}/contents/${path}?ref=${sha}`]);
 const [workbookJson,scoutJson]=await Promise.all([read('workbook/latest.json'),read('scout/latest.json')]);
 const workbook=WorkbookFile.parse(JSON.parse(workbookJson));checkMirror(workbook,JSON.parse(scoutJson));
 return {workbook,sha};
}
