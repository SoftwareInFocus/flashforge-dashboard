import { ModelPreview } from './ModelPreview';
import React, { useEffect, useState } from 'react';
import type { StoredFile, Selection } from '../lib/jobs';
import type { Snapshot } from '../lib/status';
export type JobReply={ok:boolean;message?:string;files?:StoredFile[];fingerprint?:string;warnings?:string[];outcome?:string;imageData?:string;mimeType?:string};
export type JobCall=(name:string,args:Record<string,unknown>)=>Promise<JobReply>;
const webCall:JobCall=async(name,args)=>{
 const path=name==='list_stored_prints'?'/api/files':name==='prepare_stored_print'?'/api/prints/prepare':'/api/prints/start';
 const response=await fetch(path,name==='list_stored_prints'?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});
 return response.json();
};
export function StoredPrints({snapshot,call=webCall}:{snapshot:Snapshot|null;call?:JobCall}){
 const [files,setFiles]=useState<StoredFile[]>([]);const [selected,setSelected]=useState('');const [mappings,setMappings]=useState<Selection['mappings']>([]);
 const [level,setLevel]=useState(true);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [plan,setPlan]=useState<JobReply|null>(null);const [cleared,setCleared]=useState(false);const [requestId,setRequestId]=useState('');const [uncertain,setUncertain]=useState(false);
 const file=files.find(f=>f.gcodeFileName===selected);const d=snapshot?.data;const ready=snapshot?.connection==='online'&&d?.status.toLowerCase()==='ready'&&!d.error;
 async function load(){setBusy(true);try{const r=await call('list_stored_prints',{});setFiles(r.files??[]);setMessage(r.ok?'':r.message??'Unable to load files.');}catch{setMessage('Stored files unavailable. Retry when the printer is online.');}finally{setBusy(false);}}
 useEffect(()=>{let active=true;void call('list_stored_prints',{}).then(r=>{if(active){setFiles(r.files??[]);if(!r.ok)setMessage(r.message??'Stored files unavailable.');}}).catch(()=>{if(active)setMessage('Stored files unavailable. Use Refresh to retry.');});return()=>{active=false;};},[call]);
 function reset(){setPlan(null);setCleared(false);setMessage('');}
 function choose(name:string){reset();setSelected(name);const f=files.find(f=>f.gcodeFileName===name);const used=new Set<number>();
 setMappings(f?.useMatlStation?f.gcodeToolDatas.map(t=>{const eligible=d?.slots?.filter(s=>s.loaded&&s.material?.toUpperCase()===t.materialName.toUpperCase()&&s.id!==null&&!used.has(s.id))??[];const s=eligible.find(s=>s.color.toUpperCase()===t.materialColor.toUpperCase())??eligible.find(s=>s.id===t.slotId)??eligible[0];if(s?.id)used.add(s.id);return {toolId:t.toolId,slotId:s?.id??0};}):[]);}
 const selection={fileName:selected,mappings,levelingBeforePrint:level};
 async function review(){setBusy(true);reset();try{const r=await call('prepare_stored_print',selection);if(r.ok){setPlan(r);setRequestId(crypto.randomUUID());}else setMessage(r.message??'Review failed.');}catch{setMessage('Unable to review this print. No start command was sent.');}finally{setBusy(false);}}
 async function start(){if(!plan?.fingerprint||!cleared)return;setBusy(true);try{const r=await call('start_stored_print',{...selection,fingerprint:plan.fingerprint,requestId,confirmed:true,bedCleared:true});setMessage(r.message??'Start request completed.');setPlan(null);if(r.outcome==='unknown'||r.outcome==='accepted')setUncertain(true);}catch{setMessage('Start delivery is uncertain. Check the printer before submitting another start.');setPlan(null);setUncertain(true);}finally{setBusy(false);}}
 return <section className="card stored-prints"><div className="section-heading"><div><label>ON YOUR PRINTER</label><h2>Recent stored prints</h2></div><button className="secondary" disabled={busy} onClick={()=>{reset();void load();}}>Refresh files</button></div><p className="helper">Up to ten recent stored files. The printer does not report whether each job finished successfully.</p>
 <label className="field-label" htmlFor="stored-file">Choose a print</label><select id="stored-file" disabled={busy||uncertain} value={selected} onChange={e=>choose(e.target.value)}><option value="">Select a stored file…</option>{files.map(f=><option key={f.gcodeFileName} value={f.gcodeFileName}>{f.gcodeFileName}</option>)}</select>
 {file&&<div className="print-selection"><ModelPreview fileName={file.gcodeFileName} call={call===webCall?undefined:call}/><p className="helper">Estimated {(file.printingTime/60).toFixed(0)} min{file.totalFilamentWeight!=null?` · ${file.totalFilamentWeight.toFixed(1)} g`:''} · {file.useMatlStation?'IFS filament':'External spool'}</p>
 {file.useMatlStation&&file.gcodeToolDatas.map(t=><div className="tool-mapping" key={t.toolId}><label htmlFor={`tool-${t.toolId}`}><span className="tool-color" style={{background:t.materialColor}}/>Tool {t.toolId+1} · {t.materialName}</label><select id={`tool-${t.toolId}`} disabled={busy||uncertain} value={mappings.find(m=>m.toolId===t.toolId)?.slotId??0} onChange={e=>{reset();setMappings(mappings.map(m=>m.toolId===t.toolId?{...m,slotId:Number(e.target.value)}:m));}}><option value="0">Choose a loaded slot</option>{d?.slots?.filter(s=>s.loaded&&s.id!==null&&s.material?.toUpperCase()===t.materialName.toUpperCase()).map(s=><option key={s.id} value={s.id!}>Slot {s.id} · {s.material} · {s.color}</option>)}</select></div>)}
 <label className="check-label"><input type="checkbox" checked={level} disabled={busy||uncertain} onChange={e=>{reset();setLevel(e.target.checked);}}/>Level the bed before printing</label>
 {!ready&&<p className="helper">The printer must be online, ready, and free of reported errors to start.</p>}
 {!plan&&<button disabled={busy||!ready||uncertain||mappings.some(m=>m.slotId===0)} onClick={()=>void review()}>{busy?'Checking…':'Review print'}</button>}
 {plan&&<div className="print-review"><h3>Ready to start this file?</h3><p className="selected-name">{selected}</p>{plan.warnings?.map(w=><p className="warning" key={w}>{w}</p>)}<label className="check-label"><input type="checkbox" checked={cleared} onChange={e=>setCleared(e.target.checked)} disabled={busy}/>The bed is clear and I’ve checked the selected filament.</label><button disabled={busy||!ready||!cleared} onClick={()=>void start()}>{busy?'Sending…':'Start this print'}</button><button className="secondary" disabled={busy} onClick={reset}>Back</button></div>}
 </div>}
 {message&&<p className="job-message" role="status">{message}</p>}{uncertain&&<p className="helper">Start is locked in this view to prevent an accidental repeat. Check live status and the printer before refreshing the page for another job.</p>}
 </section>;
}
