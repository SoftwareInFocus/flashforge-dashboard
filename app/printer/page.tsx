"use client";
import { useEffect, useState } from 'react';
import type { Snapshot } from '../../lib/status';
import { PrinterDashboard } from '../../components/PrinterDashboard';
export default function Dashboard() {
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [last,setLast]=useState<string|null>(null);
 useEffect(()=>{
  let alive=true;let busy=false;let timer:ReturnType<typeof setTimeout>;let controller:AbortController;
  async function poll(){
   if(!alive||busy)return;
   if(document.hidden){timer=setTimeout(poll,3000);return;}
   busy=true;controller=new AbortController();
   try{const r=await fetch('/api/status',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});if(!r.ok)throw new Error();const s:Snapshot=await r.json();if(alive){setSnapshot(s);if(s.connection==='online')setLast(s.checkedAt);}}
   catch{if(alive)setSnapshot({connection:'offline',message:'Dashboard connection interrupted. Retrying automatically.',checkedAt:new Date().toISOString(),data:null});}
   finally{busy=false;if(alive)timer=setTimeout(poll,3000);}
  }
  const wake=()=>{if(!document.hidden&&!busy){clearTimeout(timer);void poll();}};
  document.addEventListener('visibilitychange',wake);void poll();
  return()=>{alive=false;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',wake);};
 },[]);
 return <PrinterDashboard state={snapshot} message={snapshot?.message??'Connecting to your printer…'} ready={snapshot!==null} last={last}/>;
}
