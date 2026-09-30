'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import type {Snapshot} from '../lib/status';
import type {WorkbookSnapshot} from '../lib/social/workbook';
import {totals,type MetricKey} from '../lib/social/analytics';
export function HomeDashboard(){
 const [printer,setPrinter]=useState<Snapshot|null>(null);const [social,setSocial]=useState<WorkbookSnapshot|null>(null);
 useEffect(()=>{
  let active=true;const controllers=new Set<AbortController>();const timers=new Set<ReturnType<typeof setTimeout>>();
  function start<T>(url:string,interval:number,receive:(value:T)=>void,fail:()=>void){
   async function poll(){
    if(!active)return;
    if(!document.hidden){const controller=new AbortController();controllers.add(controller);
     try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});if(!r.ok)throw new Error();const value:T=await r.json();if(active)receive(value);}
     catch{if(active)fail();}finally{controllers.delete(controller);}
    }
    if(active){const timer=setTimeout(()=>{timers.delete(timer);void poll();},interval);timers.add(timer);}
   }void poll();
  }
  start('/api/status',3000,setPrinter,()=>setPrinter({connection:'offline',message:'Connection interrupted. Retrying automatically.',checkedAt:new Date().toISOString(),data:null}));
  start('/api/social/metrics',60000,setSocial,()=>setSocial(prior=>({state:prior?.analytics?'stale':'error',message:'Connection interrupted. Retrying automatically.',checkedAt:new Date().toISOString(),syncedAt:prior?.syncedAt??null,analytics:prior?.analytics??null})));
  return()=>{active=false;timers.forEach(clearTimeout);controllers.forEach(c=>c.abort());};
 },[]);
 const d=printer?.data;const a=social?.analytics;const connected=printer?.connection==='online';
 const metric=(key:MetricKey)=>{if(!a)return 'Unavailable';const m=totals(a.posts,key);return !m.covered?'Unavailable':m.min===m.max?m.min.toLocaleString():`${m.min.toLocaleString()}–${m.max.toLocaleString()}`;};
 return <main className="home-page"><header><div><p className="eyebrow">PERSONAL WORKBENCH / HOME</p><h1>Your workbench</h1><p className="page-intro">A quick read on your printer and social performance.</p></div><span className="badge">Overview</span></header>
 <div className="home-sections"><section className="card home-printer"><div className="section-heading"><div><label>PRINTER</label><h2>{d?.name??'FlashForge AD5X'}</h2></div><span className={`badge ${connected?'online':''}`}>{connected?'Connected':printer?'Offline':'Connecting'}</span></div>
 <h3>{connected?d?.status??'Unknown':'Status unavailable'}</h3><p className="helper">{connected?d?.file??'No active print reported.':printer?.message??'Reading printer status…'}</p>
 <div className="home-readings"><div><label>Print progress</label><strong>{connected&&d?.file&&d.progress!==null?`${d.progress.toFixed(1)}%`:'—'}</strong></div><div><label>Nozzle</label><strong>{d?.nozzle.current!=null?`${d.nozzle.current.toFixed(1)}°C`:'Unavailable'}</strong></div><div><label>Bed</label><strong>{d?.bed.current!=null?`${d.bed.current.toFixed(1)}°C`:'Unavailable'}</strong></div></div>
 <p className="helper">{d?.error?`Printer error: ${d.error}`:connected?'No errors reported. Updates every 3 seconds.':'The dashboard reconnects automatically.'}</p><Link className="view-link" href="/printer">Open printer dashboard <span aria-hidden="true">↗</span></Link></section>
 <section className="card home-social"><div className="section-heading"><div><label>SOCIAL</label><h2>Performance at a glance</h2></div><span className="badge">{social?.state==='demo'?'Mock data':social?.state==='stale'?'Stale data':a?'Saved workbook':'Connecting'}</span></div>
 <div className="home-readings"><div><label>Tracked posts</label><strong>{a?.posts.length??'—'}</strong></div><div><label>Views / plays</label><strong>{metric('views')}</strong></div><div><label>Attributed follows</label><strong>{metric('follows')}</strong></div></div>
 <p className="helper">{a?`${a.accounts.length} accounts · Latest reported measurements across recorded posts. Dates and measurement windows vary.`:social?.message??'Reading the local workbook…'}</p>{social?.syncedAt&&<p className="helper">Workbook captured {new Date(social.syncedAt).toLocaleString()}.</p>}
 <Link className="view-link" href="/social">Open social dashboard <span aria-hidden="true">↗</span></Link></section></div>
 <section className="home-next"><p className="eyebrow">EXPLORE YOUR WORKBENCH</p><div className="home-shortcuts"><Link href="/printer"><strong>Printer</strong><span>Live progress, temperatures, filament and stored prints.</span></Link><Link href="/social"><strong>Social</strong><span>Post results, weekly findings, experiments and daily scout drafts.</span></Link></div></section>
 </main>;
}
