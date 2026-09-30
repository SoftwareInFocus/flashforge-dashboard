import { readFile } from 'node:fs/promises';
import { GoogleAuth } from 'google-auth-library';
import { parseCsv, validateRows, type Scout, type RowIssue } from './schema';
export type SocialSnapshot = {state:'unconfigured'|'ok'|'partial'|'error'|'stale'|'demo';message:string;checkedAt:string;lastSuccessAt:string|null;rows:Scout[];issues:RowIssue[]};
const auth = new GoogleAuth({scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']});
export async function fetchSheetRows(id:string, tab:string, fetcher:typeof fetch=fetch, getToken=()=>auth.getAccessToken()) {
 if(!/^[a-zA-Z0-9_-]+$/.test(id)||!tab||tab.length>100)throw new Error('Invalid sheet configuration');
 const token=await getToken(); if(!token)throw new Error('Missing access token');
 // One extra column and row detect schema growth or overflow instead of silently truncating.
 const range=`'${tab.replaceAll("'","''")}'!A1:O10002`;
 const response=await fetcher(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('Sheet request failed');
 const raw=await response.text();if(Buffer.byteLength(raw)>5_000_000)throw new Error('Sheet exceeds 5 MB');
 return validateRows(JSON.parse(raw).values);
}
export function createSocialReader(loader:()=>Promise<ReturnType<typeof validateRows>>, mode:()=>string) {
 let cached:SocialSnapshot|null=null; let cachedAt=0; let lastGood:SocialSnapshot|null=null; let pending:Promise<SocialSnapshot>|null=null;
 return async function readSocial():Promise<SocialSnapshot>{
  if(cached&&Date.now()-cachedAt<60000)return cached;
  pending??=(async()=>{
   const checkedAt=new Date().toISOString();const source=mode();
   const base={checkedAt,lastSuccessAt:lastGood?.lastSuccessAt??null,rows:[] as Scout[],issues:[] as RowIssue[]};
   let validationIssues:RowIssue[]=[];
   let next:SocialSnapshot;
   if(!source)next={...base,state:'unconfigured',message:'Configure the private Google Sheet connection to see daily scout results.'};
   else try {
    const data=await loader();
    validationIssues=data.issues;
    if(data.issues.length&&data.rows.length===0)throw new Error('All rows invalid');
    next={...base,...data,lastSuccessAt:checkedAt,state:source==='demo'?'demo':data.issues.length?'partial':'ok',message:source==='demo'?'Sample data, not live scout results.':data.issues.length?`${data.issues.length} invalid rows skipped. Check the reported row numbers.`:'Sheet connected. Refreshes every minute.'};
    lastGood=next;
   }catch{
    next={...base,rows:lastGood?.rows??[],issues:validationIssues.length?validationIssues:lastGood?.issues??[],state:lastGood?'stale':'error',message:lastGood?'Sheet refresh failed. Showing the last successful read.':'Could not read valid scout data. Check server credentials, sheet access and schema.'};
   }
   cached=next;cachedAt=Date.now();return next;
  })().finally(()=>{pending=null;});
  return pending;
 };
}
export const readSocial=createSocialReader(async()=>{
 if(process.env.SOCIAL_DEMO==='true')return parseCsv(await readFile(`${process.cwd()}/examples/muse-daily-scout.csv`,'utf8'));
 return fetchSheetRows(process.env.SOCIAL_SHEET_ID!,process.env.SOCIAL_SHEET_TAB||'Muse Daily Scout');
},()=>process.env.SOCIAL_DEMO==='true'?'demo':process.env.SOCIAL_SHEET_ID?'sheet':'');
