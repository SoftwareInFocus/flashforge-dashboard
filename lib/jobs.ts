import { isIPv4 } from 'node:net';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { readPrinter } from './printer';
const color=z.string().regex(/^#[0-9a-f]{6}$/i);
const tool=z.object({toolId:z.number().int().min(0).max(3),slotId:z.number().int().min(0).max(4),materialName:z.string().min(1),materialColor:color});
const file=z.object({gcodeFileName:z.string().min(1).max(512),gcodeToolCnt:z.number().int().min(0).max(4),gcodeToolDatas:z.array(tool).max(4),printingTime:z.number().nonnegative(),totalFilamentWeight:z.number().nonnegative().optional(),useMatlStation:z.boolean()});
export type StoredFile=z.infer<typeof file>;
export const mappingSchema=z.object({toolId:z.number().int().min(0).max(3),slotId:z.number().int().min(1).max(4)}).strict();
export const prepareSchema=z.object({fileName:z.string().min(1).max(512),mappings:z.array(mappingSchema).max(4),levelingBeforePrint:z.boolean()}).strict();
export const startSchema=prepareSchema.extend({fingerprint:z.string().regex(/^[a-f0-9]{64}$/),requestId:z.string().uuid(),confirmed:z.literal(true),bedCleared:z.literal(true)}).strict();
export type Selection=z.infer<typeof prepareSchema>;
async function request(endpoint:string,extra:Record<string,unknown>={}){
 const ip=process.env.PRINTER_IP,serial=process.env.PRINTER_SERIAL,code=process.env.PRINTER_CHECK_CODE,port=Number(process.env.PRINTER_PORT||8898);
 if(!ip||!isIPv4(ip)||!serial||!code||!Number.isInteger(port)||port<1||port>65535)throw new Error('Printer configuration is unavailable.');
 const r=await fetch(`http://${ip}:${port}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serialNumber:serial,checkCode:code,...extra}),signal:AbortSignal.timeout(5000),cache:'no-store'});
 if(!r.ok)throw new Error('Printer rejected the request.');
 const body=await r.json();if(body.code!==0)throw new Error('Printer rejected the request. Check LAN access and printer state.');return body;
}
export async function listStoredFiles(){
 try{const body=await request('gcodeList');const entries=body.gcodeListDetail;
 if(!Array.isArray(entries))return {ok:false,message:'Printer did not provide file material metadata. Use Flash Studio to start these files.',files:[] as StoredFile[]};
 const files:StoredFile[]=[];for(const entry of entries){const result=file.safeParse(entry);if(result.success)files.push(result.data);}
 return {ok:true,message:'Up to ten recent stored files reported by the printer. This is not a completion history.',files};
 }catch{return {ok:false,message:'Stored files unavailable. Check printer power and LAN connection.',files:[] as StoredFile[]};}
}
export async function prepareStoredPrint(selection:Selection){
 const parsed=prepareSchema.parse(selection);const listing=await listStoredFiles();if(!listing.ok)throw new Error(listing.message);
 const f=listing.files.find(f=>f.gcodeFileName===parsed.fileName);if(!f)throw new Error('This file is no longer in the printer’s recent stored files. Refresh the list.');
 const snapshot=await readPrinter();const d=snapshot.data;if(snapshot.connection!=='online'||!d)throw new Error('Printer is unavailable.');
 if(d.status.toLowerCase()!=='ready'||d.error)throw new Error('Printer must be ready with no reported error before starting a print.');
 const warnings:string[]=[];const mappings:Record<string,unknown>[]=[];
 if(f.useMatlStation){
 if(!f.gcodeToolCnt||f.gcodeToolDatas.length!==f.gcodeToolCnt||new Set(f.gcodeToolDatas.map(t=>t.toolId)).size!==f.gcodeToolCnt)throw new Error('File has incomplete material requirements. Use Flash Studio.');
 if(parsed.mappings.length!==f.gcodeToolCnt||new Set(parsed.mappings.map(m=>m.toolId)).size!==f.gcodeToolCnt||new Set(parsed.mappings.map(m=>m.slotId)).size!==f.gcodeToolCnt)throw new Error('Map every tool to a different loaded filament slot.');
 for(const t of f.gcodeToolDatas){const m=parsed.mappings.find(m=>m.toolId===t.toolId);const s=d.slots?.find(s=>s.id===m?.slotId);
 if(!s||s.loaded!==true)throw new Error(`Tool ${t.toolId+1} needs a loaded slot.`);
 if(s.material?.trim().toUpperCase()!==t.materialName.trim().toUpperCase())throw new Error(`Tool ${t.toolId+1} requires ${t.materialName}. The selected slot has a different material.`);
 if(s.color.toUpperCase()!==t.materialColor.toUpperCase())warnings.push(`Tool ${t.toolId+1}: selected slot color differs from the original file.`);
 mappings.push({toolId:t.toolId,slotId:s.id,materialName:s.material,toolMaterialColor:t.materialColor,slotMaterialColor:s.color});}
 }else{if(parsed.mappings.length)throw new Error('This file uses external filament, not IFS slots.');warnings.push('This file uses external filament. Verify the spool matches the sliced material.');}
 const payload={fileName:f.gcodeFileName,levelingBeforePrint:parsed.levelingBeforePrint,firstLayerInspection:false,flowCalibration:false,timeLapseVideo:false,useMatlStation:f.useMatlStation,gcodeToolCnt:f.useMatlStation?f.gcodeToolCnt:0,materialMappings:mappings};
 const fingerprint=createHash('sha256').update(JSON.stringify({file:f,payload})).digest('hex');
 return {ok:true as const,file:f,mappings,warnings,fingerprint,payload};
}

export async function startStoredPrint(input:z.infer<typeof startSchema>){
 const local=resolve(process.env.PRINTER_STATE_DIR||resolve(process.cwd(),'.local/printer-jobs'));
 const args=startSchema.parse(input);await mkdir(local,{recursive:true,mode:0o700});const record=resolve(local,args.requestId+'.json');
 try{const previous=JSON.parse(await readFile(record,'utf8'));return previous;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Unable to verify prior start request. No command sent.');}
 const lock=resolve(local,'start.lock');try{await mkdir(lock);}catch{throw new Error('Another start request is in progress, or a prior request needs checking. No command sent.');}
 try{
 try{return JSON.parse(await readFile(record,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const plan=await prepareStoredPrint({fileName:args.fileName,mappings:args.mappings,levelingBeforePrint:args.levelingBeforePrint});if(plan.fingerprint!==args.fingerprint)throw new Error('File or selected filament changed. Review the print again.');
 const uncertain={ok:false,outcome:'unknown',message:'Start delivery is uncertain. Check live printer status before issuing another start. This request will not be resent.'};
 await writeFile(record,JSON.stringify(uncertain),{flag:'wx',mode:0o600});
 let result;try{await request('printGcode',plan.payload);result={ok:true,outcome:'accepted',message:'Printer accepted the start command. Watch live status for printing to begin.'};}catch{result=uncertain;}
 await writeFile(record,JSON.stringify(result),{mode:0o600});return result;
 }finally{await rm(lock,{recursive:true,force:true});}
}

export async function getPrintThumbnail(fileName:string){
 if(!fileName||fileName.length>512)throw new Error('Invalid file name.');
 const [listing,status]=await Promise.all([listStoredFiles(),readPrinter()]);
 if(!listing.files.some(f=>f.gcodeFileName===fileName)&&status.data?.file!==fileName)return {ok:false,message:'This file is no longer available.'};
 try{const body=await request('gcodeThumb',{fileName});if(typeof body.imageData!=='string'||body.imageData.length>2800000)return {ok:false,message:'Preview unavailable.'};
 const bytes=Buffer.from(body.imageData,'base64');let mimeType:string;
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mimeType='image/png';
 else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mimeType='image/jpeg';else return {ok:false,message:'Preview format unsupported.'};
 return {ok:true,imageData:bytes.toString('base64'),mimeType};
 }catch{return {ok:false,message:'Model preview unavailable.'};}
}
