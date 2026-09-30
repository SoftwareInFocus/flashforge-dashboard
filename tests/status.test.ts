import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../lib/status';
import { readPrinter } from '../lib/printer';
test('maps AD5X wire fields without inventing missing readings',()=>{
 const s=normalize({status:'paused',printProgress:0.42,printLayer:42,targetPrintLayer:100,estimatedTime:3600,printDuration:60,rightTemp:0,rightTargetTemp:210,matlStationInfo:{currentSlot:2,currentLoadSlot:0,slotCnt:1,stateAction:0,stateStep:0,slotInfos:[{slotId:2,hasFilament:true,materialName:'PLA',materialColor:'#ff0000'}]}});
 assert.equal(s.progress,42);assert.equal(s.remaining,3600);assert.equal(s.nozzle.current,0);assert.equal(s.bed.current,null);assert.equal(s.slots?.[0].active,true);
});
test('rejects nonfinite metrics and unsafe swatch values',()=>{
 assert.equal(normalize({printProgress:NaN,printDuration:-1}).progress,null);
 assert.equal(normalize({}).elapsed,null);
});
test('unconfigured printer returns safe setup state',async()=>{
 const saved=process.env.PRINTER_IP;delete process.env.PRINTER_IP;
 try{const s=await readPrinter();assert.equal(s.connection,'unconfigured');assert.equal(s.data,null);}finally{if(saved!==undefined)process.env.PRINTER_IP=saved;}
});
test('adapter handles rejection, malformed replies and offline errors without leaking credentials',async()=>{
 const previous={ip:process.env.PRINTER_IP,serial:process.env.PRINTER_SERIAL,code:process.env.PRINTER_CHECK_CODE};
 const original=globalThis.fetch;
 process.env.PRINTER_IP='192.168.1.10';process.env.PRINTER_SERIAL='test-serial';process.env.PRINTER_CHECK_CODE='test-secret';
 try {
  globalThis.fetch=async()=>new Response(JSON.stringify({detail:{status:'printing',printProgress:0.5}}));
  const online=await readPrinter();assert.equal(online.data?.progress,50);assert.equal(JSON.stringify(online).includes('test-secret'),false);
  globalThis.fetch=async()=>new Response('{}');assert.equal((await readPrinter()).connection,'offline');
  globalThis.fetch=async()=>new Response('{}',{status:403});assert.equal((await readPrinter()).data,null);
  globalThis.fetch=async()=>{throw new Error('test-secret');};const offline=await readPrinter();assert.equal(offline.connection,'offline');assert.equal(JSON.stringify(offline).includes('test-secret'),false);
 } finally {
  globalThis.fetch=original;
  for(const [key,v] of Object.entries({PRINTER_IP:previous.ip,PRINTER_SERIAL:previous.serial,PRINTER_CHECK_CODE:previous.code})){if(v===undefined)delete process.env[key];else process.env[key]=v;}
 }
});
