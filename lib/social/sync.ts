import {mkdir,writeFile,rename,stat} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {WorkbookFile,buildAnalytics,type WorkbookData} from './analytics';
import {validateRows} from './schema';
export async function readSnapshot(path:string):Promise<WorkbookData>{
 const {readFile}=await import('node:fs/promises');
 if((await stat(path)).size>5_000_000)throw new Error('Snapshot exceeds 5 MB');
 return WorkbookFile.parse(JSON.parse(await readFile(path,'utf8')));
}
export async function writeSnapshot(path:string,input:unknown){
 const data=WorkbookFile.parse(input);buildAnalytics(data.tabs);
 const scout=validateRows(data.tabs['Muse Daily Scout']?.map(row=>row.map(v=>String(v??''))));
 if(scout.issues.length&&scout.rows.length===0)throw new Error('All scout rows invalid');
 const serialized=JSON.stringify(data);if(Buffer.byteLength(serialized)>5_000_000)throw new Error('Snapshot exceeds 5 MB');
 await mkdir(dirname(path),{recursive:true,mode:0o700});
 const temp=`${path}.${randomUUID()}.tmp`;
 try{await writeFile(temp,serialized,{mode:0o600,flag:'wx'});await rename(temp,path);}
 catch(error){const {unlink}=await import('node:fs/promises');await unlink(temp).catch(()=>{});throw error;}
 return data.syncedAt;
}
