import nextEnv from '@next/env';
import {fetchWorkbook,snapshotPath,connectionMessage} from '../lib/social/workbook';
import {fetchGithubMirror} from '../lib/social/github';
import {writeSnapshot} from '../lib/social/sync';
nextEnv.loadEnvConfig(process.cwd());
const watch=process.argv.includes('--watch');
const abort=new AbortController();process.once('SIGINT',()=>abort.abort());process.once('SIGTERM',()=>abort.abort());
async function sync(){
 try{
  const repo=process.env.SOCIAL_DATA_REPO;
  const data=repo?(await fetchGithubMirror(repo)).workbook:await fetchWorkbook();
  const date=await writeSnapshot(snapshotPath(),data);
  console.log(`Social workbook synced from ${repo?'private GitHub mirror':'Google Sheets'}; source captured at ${date}.`);return true;
 }
 catch(error){console.error(`Social workbook not updated. ${process.env.SOCIAL_DATA_REPO?'Check GitHub CLI login, private repo access and the mirrored data contract.':connectionMessage(error)}`);return false;}
}
do{
 const ok=await sync();if(!watch){if(!ok)process.exitCode=1;break;}
 const {setTimeout}=await import('node:timers/promises');
 await setTimeout(300000,undefined,{signal:abort.signal}).catch(()=>{});
}while(!abort.signal.aborted);
