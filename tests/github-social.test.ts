import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fetchGithubMirror,checkMirror} from '../lib/social/github';
import {WorkbookFile} from '../lib/social/analytics';
const workbook=WorkbookFile.parse(JSON.parse(await readFile(new URL('../examples/social-workbook.json',import.meta.url),'utf8')));
const empty={schema_version:'1',run_id:'13a987e4-0cef-4c66-8b41-87a6baebed36',scouted_at:'2026-01-08T12:00:00Z',opportunities:[]};
test('GitHub sync requires a private repo and pins both files to the same commit',async()=>{
 const calls:string[][]=[];const sha='a'.repeat(40);
 const api=async(args:string[])=>{calls.push(args);if(args[1]==='repos/example/private')return '{"private":true}';if(args[1].endsWith('commits/main'))return sha;return args.some(v=>v.includes('workbook/latest'))?JSON.stringify(workbook):JSON.stringify(empty);};
 assert.equal((await fetchGithubMirror('example/private',api)).sha,sha);
 assert.equal(calls.filter(c=>c.some(v=>v.includes(`?ref=${sha}`))).length,2);
 await assert.rejects(()=>fetchGithubMirror('example/public',async()=>'{"private":false}'));
 await assert.rejects(()=>fetchGithubMirror('example/private',async args=>args[1]==='repos/example/private'?'{"private":true}':'bad-sha'));
});
test('bad runs and sheet/repo disagreement cannot be committed into the local snapshot',()=>{
 assert.throws(()=>checkMirror(workbook,{...empty,schema_version:'2'}));
 const opportunity={schema_version:'1',id:empty.run_id,scouted_at:empty.scouted_at,platform:'threads',opportunity_type:'content_idea',creator:'',source_url:'',topic:'Sample',title:'Sample',reason:'Sample',score:'8',draft_text:'',status:'new',notes:''};
 assert.throws(()=>checkMirror(workbook,{...empty,opportunities:[opportunity]}));
});
