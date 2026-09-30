import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {listStoredFiles,prepareStoredPrint,startStoredPrint} from '../lib/jobs';
test('stored prints validate materials and live readiness, resist stale selections and never retry commands',async()=>{
 const original=globalThis.fetch;const env={...process.env};const dir=await mkdtemp(tmpdir()+'/ad5x-jobs-');
 Object.assign(process.env,{PRINTER_IP:'127.0.0.1',PRINTER_SERIAL:'test',PRINTER_CHECK_CODE:'test',PRINTER_STATE_DIR:dir});
 let commands=0;let status='ready';let material='PLA';let color='#FF0000';let fail=false;let listed=true;
 const file={gcodeFileName:'stored.3mf',gcodeToolCnt:1,gcodeToolDatas:[{toolId:0,slotId:1,materialName:'PLA',materialColor:'#FF0000'}],printingTime:120,useMatlStation:true};
 globalThis.fetch=async(url,options)=>{
 const path=new URL(String(url)).pathname;const body=JSON.parse(String(options?.body));
 if(path==='/gcodeList')return Response.json({code:0,gcodeListDetail:listed?[file]:[]});
 if(path==='/detail')return Response.json({detail:{status,matlStationInfo:{slotInfos:[{slotId:1,hasFilament:true,materialName:material,materialColor:color}]}}});
 if(path==='/printGcode'){commands++;assert.equal(body.fileName,'stored.3mf');assert.equal(body.useMatlStation,true);assert.equal(body.materialMappings[0].slotId,1);assert.equal(body.gcodeToolCnt,1);if(fail)throw new Error('connection lost');return Response.json({code:0});}
 throw new Error('Unexpected endpoint');
 };
 const selection={fileName:'stored.3mf',mappings:[{toolId:0,slotId:1}],levelingBeforePrint:true};
 try{
 assert.equal((await listStoredFiles()).files.length,1);
 material='PETG';await assert.rejects(prepareStoredPrint(selection),/different material/);assert.equal(commands,0);material='PLA';
 status='printing';await assert.rejects(prepareStoredPrint(selection),/must be ready/);status='ready';
 const plan=await prepareStoredPrint(selection);const args={...selection,fingerprint:plan.fingerprint,requestId:randomUUID(),confirmed:true as const,bedCleared:true as const};
 color='#000000';await assert.rejects(startStoredPrint(args),/changed/);assert.equal(commands,0);color='#FF0000';
 listed=false;await assert.rejects(startStoredPrint(args),/no longer/);listed=true;
 assert.equal((await startStoredPrint(args)).outcome,'accepted');assert.equal(commands,1);
 assert.equal((await startStoredPrint(args)).outcome,'accepted');assert.equal(commands,1);
 fail=true;const uncertain={...args,requestId:randomUUID()};assert.equal((await startStoredPrint(uncertain)).outcome,'unknown');assert.equal(commands,2);
 assert.equal((await startStoredPrint(uncertain)).outcome,'unknown');assert.equal(commands,2);
 await assert.rejects(startStoredPrint({...args,confirmed:false} as never));assert.equal(commands,2);
 }finally{globalThis.fetch=original;process.env=env;await rm(dir,{recursive:true,force:true});}
});
