import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HEADERS,parseCsv,validateRows} from '../lib/social/schema';
import {createSocialReader,fetchSheetRows} from '../lib/social/source';
const fixture=await readFile(new URL('../examples/muse-daily-scout.csv',import.meta.url),'utf8');
const valid=['1','13a987e4-0cef-4c66-8b41-87a6baebed36','2026-01-01T09:00:00Z','threads','reply','Example','https://example.com/post','topic','title','reason','8.5','draft','new',''];
test('CSV quotes, multiline drafts, sample data and Sheets trailing padding',()=>{
 assert.equal(parseCsv(fixture).rows.length,2);
 assert.equal(validateRows([HEADERS,valid.slice(0,-1)]).rows.length,1);
 const csv=HEADERS.join(',')+'\n'+valid.map((v,i)=>i===11?'"Line one, quoted ""text""\nLine two"':v).join(',');
 assert.equal(parseCsv('\ufeff'+csv).rows[0].draft_text,'Line one, quoted "text"\nLine two');
});
test('reject header drift, malformed CSV and overlong input',()=>{
 assert.throws(()=>validateRows([[...HEADERS,'extra']]));
 assert.throws(()=>validateRows([[...HEADERS].reverse(),valid]));
 assert.throws(()=>parseCsv(HEADERS.join(',')+'\n"unterminated'));
 assert.throws(()=>parseCsv('x'.repeat(5_000_001)));
});
test('bad rows isolated, duplicate IDs rejected, no unsafe links',()=>{
 for(const [index,value] of [[0,'2'],[2,'yesterday'],[3,'tiktok'],[6,'javascript:alert(1)'],[6,'https://user:pass@example.com'],[10,'11'],[10,''],[12,'posted']] as const){
  const bad=[...valid];bad[index]=value;const out=validateRows([HEADERS,bad]);assert.equal(out.rows.length,0);assert.equal(out.issues.length,1);
 }
 assert.equal(validateRows([HEADERS,valid,valid]).issues[0].row,3);
 assert.equal(validateRows([HEADERS,valid,['bad']]).rows.length,1);
 const bad=[...valid];bad[3]='instagram';bad[4]='quote_post';assert.equal(validateRows([HEADERS,bad]).rows.length,0);
});
test('private Sheets request uses bounded range and token only in header',async()=>{
 let called=false;
 const fake:typeof fetch=async(input,init)=>{
  called=true;assert.match(String(input),/sheets.googleapis.com/);assert.match(decodeURIComponent(String(input)),/A1:O10002/);assert.ok(!String(input).includes('fake-token'));assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer fake-token');
  return Response.json({values:[HEADERS,valid]});
 };
 assert.equal((await fetchSheetRows('fake-id','Muse Daily Scout',fake,async()=> 'fake-token')).rows.length,1);assert.ok(called);
 await assert.rejects(()=>fetchSheetRows('fake-id','Muse Daily Scout',async()=>new Response('',{status:403}),async()=> 'fake-token'));
 await assert.rejects(()=>fetchSheetRows('invalid/id','tab',fake,async()=> 'fake-token'));
});
test('coalesces reads and preserves last good snapshot on failure',async()=>{
 const originalNow=Date.now;let now=100000;Date.now=()=>now;
 try{
  let calls=0;
  const reader=createSocialReader(async()=>{calls++;if(calls>1)throw new Error('secret failure');return parseCsv(fixture);},()=> 'sheet');
  const [a,b]=await Promise.all([reader(),reader()]);assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.state,'ok');
  now+=60001;const stale=await reader();assert.equal(stale.state,'stale');assert.equal(stale.rows.length,2);assert.equal(stale.lastSuccessAt,a.lastSuccessAt);assert.ok(!stale.message.includes('secret'));
 }finally{Date.now=originalNow;}
});
test('unconfigured and all-invalid feeds do not masquerade as successful',async()=>{
 assert.equal((await createSocialReader(async()=>parseCsv(fixture),()=> '')()).state,'unconfigured');
 assert.equal((await createSocialReader(async()=>validateRows([HEADERS,['bad']]),()=> 'sheet')()).state,'error');
});
