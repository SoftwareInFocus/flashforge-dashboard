import {readSnapshot} from './sync';
import {buildAnalytics,WorkbookFile,type Analytics,type WorkbookData} from './analytics';
import {getSheetToken,SheetReadError} from './source';
const ranges=["'Post Metrics'!A1:AC1000","'Weekly Analysis'!A1:Z1002","'Experiments'!A1:Z1001","'Run Log'!A1:Z1001","'Muse Daily Scout'!A1:O10002"];
export type WorkbookSnapshot={state:'demo'|'live'|'snapshot'|'stale'|'unconfigured'|'error';message:string;checkedAt:string;syncedAt:string|null;analytics:Analytics|null};
export async function fetchWorkbook():Promise<WorkbookData>{
 const id=process.env.SOCIAL_SHEET_ID;if(!id||!/^[A-Za-z0-9_-]+$/.test(id))throw new SheetReadError('configuration');
 const token=await getSheetToken();
 const params=new URLSearchParams({valueRenderOption:'FORMATTED_VALUE',majorDimension:'ROWS'});ranges.forEach(r=>params.append('ranges',r));
 const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchGet?${params}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new SheetReadError(r.status===401?'credentials':r.status===403?'access':'connection');
 const text=await r.text();if(Buffer.byteLength(text)>5_000_000)throw new SheetReadError('schema');
 const body=JSON.parse(text);if(!Array.isArray(body.valueRanges)||body.valueRanges.length!==ranges.length)throw new SheetReadError('schema');
 const tabs=Object.fromEntries(['Post Metrics','Weekly Analysis','Experiments','Run Log','Muse Daily Scout'].map((name,i)=>[name,body.valueRanges[i].values]));
 return WorkbookFile.parse({version:1,syncedAt:new Date().toISOString(),tabs});
}
export function connectionMessage(error:unknown){
 if(error instanceof SheetReadError){
  if(error.code==='credentials')return 'Automatic refresh needs Google credentials with read access to this workbook.';
  if(error.code==='access')return 'The Google account cannot access this workbook. Check its sharing permissions.';
  if(error.code==='configuration')return 'Add the private workbook connection in local settings.';
 }
 return 'Workbook refresh failed. Check the connection and workbook column headers.';
}
export function createWorkbookReader(load:()=>Promise<WorkbookData>){
 let cached:WorkbookSnapshot|null=null;let timestamp=0;let pending:Promise<WorkbookSnapshot>|null=null;let good:WorkbookSnapshot|null=null;
 return async()=>{
  if(cached&&Date.now()-timestamp<60000)return cached;
  pending??=(async()=>{
   const checkedAt=new Date().toISOString();let next:WorkbookSnapshot;
   try{const data=await load();next={state:'snapshot',message:'Reading the local workbook copy. Source capture time is shown below.',checkedAt,syncedAt:data.syncedAt,analytics:buildAnalytics(data.tabs)};good=next;}
   catch{next=good?{...good,state:'stale',checkedAt,message:'The local workbook copy could not be read. Showing the last valid copy.'}:{state:'unconfigured',message:'No valid workbook copy is available yet. Configure the private data source and run the sync.',checkedAt,syncedAt:null,analytics:null};}
   cached=next;timestamp=Date.now();return next;
  })().finally(()=>{pending=null;});return pending;
 };
}
// HTTP requests never contact Google. The sync command owns network access and disk writes.
export const snapshotPath=()=>process.env.SOCIAL_SNAPSHOT_PATH||`${process.cwd()}/.local/social/workbook.json`;
const workbookReader=createWorkbookReader(()=>readSnapshot(snapshotPath()));
export const readWorkbook=async():Promise<WorkbookSnapshot>=>{const result=await workbookReader();return process.env.SOCIAL_DEMO==='true'&&result.analytics&&result.state==='snapshot'?{...result,state:'demo',message:'Fictional sample workbook for testing. These are not live social metrics.'}:result;};
