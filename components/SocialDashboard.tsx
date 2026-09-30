'use client';
import {useEffect,useState} from 'react';
import type {SocialSnapshot} from '../lib/social/source';
export function SocialDashboard(){
 const [data,setData]=useState<SocialSnapshot|null>(null);
 const [platform,setPlatform]=useState('all');
 useEffect(()=>{
  let alive=true;let timer:ReturnType<typeof setTimeout>;let controller:AbortController;
  async function poll(){
   if(document.hidden){timer=setTimeout(poll,60000);return;}
   controller=new AbortController();
   try{const r=await fetch('/api/social',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});if(!r.ok)throw new Error();const next=await r.json();if(alive)setData(next);}
   catch{if(alive)setData(previous=>({state:previous?.rows.length?'stale':'error',message:'Dashboard connection interrupted. Retrying automatically.',checkedAt:new Date().toISOString(),lastSuccessAt:previous?.lastSuccessAt??null,rows:previous?.rows??[],issues:previous?.issues??[]}));}
   finally{if(alive)timer=setTimeout(poll,60000);}
  }
  void poll();return()=>{alive=false;clearTimeout(timer);controller?.abort();};
 },[]);
 const rows=(data?.rows??[]).filter(row=>platform==='all'||row.platform===platform);
 return <section className="social-dashboard card" aria-labelledby="social-heading">
  <div className="section-heading"><div><label>DAILY SOCIAL SCOUT</label><h2 id="social-heading">Social growth</h2></div><span>{data?.state??'Connecting'}</span></div>
  <p className="helper" role="status">{data?.message??'Reading scout results…'}</p>
  {data?.lastSuccessAt&&<p className="helper">Last successful read: {new Date(data.lastSuccessAt).toLocaleString()}</p>}
  {!!data?.issues.length&&<p className="warning">Skipped: {data.issues.map(i=>`row ${i.row} (${i.fields.join(', ')})`).join('; ')}</p>}
  <label htmlFor="social-platform" className="field-label">Platform</label><select id="social-platform" value={platform} onChange={e=>setPlatform(e.target.value)}><option value="all">All platforms</option><option value="threads">Threads</option><option value="instagram">Instagram</option></select>
  {rows.length===0&&<p className="helper">{data?.state==='ok'?'No scout results yet.':'No results to display.'}</p>}
  <div className="scout-grid">{rows.map(row=><article className="scout-item" key={row.id}>
   <p className="scout-meta">{row.platform} · {row.opportunity_type.replaceAll('_',' ')} · {row.score}/10 · {row.status}</p>
   <h3>{row.title}</h3><p className="helper">{row.topic} · {new Date(row.scouted_at).toLocaleString()}</p><p>{row.reason}</p>
   {row.source_url&&<a href={row.source_url} target="_blank" rel="noopener noreferrer">View source{row.creator?` (${row.creator})`:''}</a>}
   {row.draft_text&&<details><summary>Draft for review</summary><p className="scout-draft">{row.draft_text}</p></details>}
   {row.notes&&<p className="helper">{row.notes}</p>}
  </article>)}</div>
 </section>;
}
