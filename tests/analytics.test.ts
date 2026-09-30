import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildAnalytics,totals,numeric,METRIC_HEADERS,ANALYSIS_HEADERS,EXPERIMENT_HEADERS,LOG_HEADERS,type WorkbookData} from '../lib/social/analytics';
import {HEADERS} from '../lib/social/schema';
import {writeSnapshot,readSnapshot} from '../lib/social/sync';
import {createWorkbookReader} from '../lib/social/workbook';
const row=(account:string,id:string,date:string,values:Record<string,string>)=>METRIC_HEADERS.map(h=>({Account:account,'Platform Post ID':id,'Snapshot Date':date,'Post URL':'https://example.com/post','Metric Window':'7-day',...values})[h]??'');
function fixture():WorkbookData{return {version:1,syncedAt:'2026-01-01T00:00:00Z',tabs:{'Post Metrics':[METRIC_HEADERS,row('Sample account','one','2026-01-01',{'Views/Plays':'100-105',Reach:'50',Shares:'2','Follows Attributed':'1'}),row('Sample account','one','2026-01-02',{'Views/Plays':'150',Shares:'0'}),row('Other account','one','2026-01-01',{'Views/Plays':'30'})],'Weekly Analysis':[ANALYSIS_HEADERS],Experiments:[EXPERIMENT_HEADERS],'Run Log':[LOG_HEADERS],'Muse Daily Scout':[[...HEADERS]]}};}
test('deduplicates snapshots, isolates accounts, preserves prior known measurements and real zeros',()=>{
 const out=buildAnalytics(fixture().tabs);assert.equal(out.posts.length,2);
 const post=out.posts.find(p=>p.account==='Sample account')!;
 assert.equal(post.metrics.views?.min,150);assert.equal(post.metrics.reach?.min,50);assert.equal(post.metrics.reach?.observedAt,'2026-01-01');assert.equal(post.metrics.shares?.min,0);
 assert.deepEqual(totals(out.posts,'views'),{min:180,max:180,covered:2,total:2});assert.deepEqual(totals(out.posts,'reach'),{min:50,max:50,covered:1,total:2});
});
test('preserves ranges and missing data; rejects malformed headers and impossible dates',()=>{
 assert.deepEqual(numeric('1,000-1,005'),{min:1000,max:1005});for(const v of ['', '--','20%','1.2K','-2','200-100'])assert.equal(numeric(v),null);
 const f=fixture();f.tabs['Post Metrics'].push(row('Sample account','bad','2026-02-30',{}));assert.equal(buildAnalytics(f.tabs).issues.length,1);
 f.tabs['Post Metrics'][0]=['wrong'];assert.throws(()=>buildAnalytics(f.tabs));
});
test('snapshot writes are validated and atomic; invalid sync cannot replace good data',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'social-snapshot-'));const path=join(dir,'workbook.json');
 try{await writeSnapshot(path,fixture());const prior=await readFile(path,'utf8');assert.equal((await readSnapshot(path)).version,1);
 const bad=fixture();bad.tabs['Post Metrics'][0]=['bad'];await assert.rejects(()=>writeSnapshot(path,bad));assert.equal(await readFile(path,'utf8'),prior);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('local reader coalesces requests and retains dated data when a snapshot becomes invalid',async()=>{
 const original=Date.now;let clock=100000;Date.now=()=>clock;
 try{let calls=0;const reader=createWorkbookReader(async()=>{calls++;if(calls>1)throw new Error();return fixture();});const [a,b]=await Promise.all([reader(),reader()]);assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.state,'snapshot');clock+=60001;const failed=await reader();assert.equal(failed.state,'stale');assert.equal(failed.syncedAt,a.syncedAt);assert.equal(failed.analytics?.posts.length,2);
 }finally{Date.now=original;}
});
