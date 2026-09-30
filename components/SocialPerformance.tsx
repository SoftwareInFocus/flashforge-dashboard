'use client';
import {useEffect,useState} from 'react';
import {totals,type MetricKey,type Measurement} from '../lib/social/analytics';
import type {WorkbookSnapshot} from '../lib/social/workbook';
import {SocialDashboard} from './SocialDashboard';
const number=(n:number)=>n.toLocaleString();
const range=(m:{min:number;max:number}|undefined)=>m?m.min===m.max?number(m.min):`${number(m.min)}–${number(m.max)}`:'Unavailable';
function Reading({value}:{value?:Measurement}){return <span title={value?`${value.window} observation on ${value.observedAt}`:'Not recorded'}>{range(value)}</span>;}
export function SocialPerformance(){
 const [data,setData]=useState<WorkbookSnapshot|null>(null);const [account,setAccount]=useState('all');const [ranking,setRanking]=useState<MetricKey>('views');
 useEffect(()=>{
  let active=true;let timer:ReturnType<typeof setTimeout>;let controller:AbortController;
  async function poll(){
   if(document.hidden){timer=setTimeout(poll,60000);return;}
   controller=new AbortController();
   try{const r=await fetch('/api/social/metrics',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});if(!r.ok)throw new Error();const next=await r.json();if(active)setData(next);}
   catch{if(active)setData(prior=>({state:prior?.analytics?'stale':'error',message:'Dashboard connection interrupted. Retrying automatically.',checkedAt:new Date().toISOString(),syncedAt:prior?.syncedAt??null,analytics:prior?.analytics??null}));}
   finally{if(active)timer=setTimeout(poll,60000);}
  }
  void poll();return()=>{active=false;clearTimeout(timer);controller?.abort();};
 },[]);
 const a=data?.analytics;const posts=(a?.posts??[]).filter(p=>account==='all'||p.account===account);
 const ranked=[...posts].sort((x,y)=>(y.metrics[ranking]?.min??-1)-(x.metrics[ranking]?.min??-1));
 const latestAnalysis=(a?.analyses??[]).filter(r=>account==='all'||r.Account===account).filter((r,i,arr)=>arr.findIndex(x=>x.Account===r.Account)===i);
 const formats=[...new Set(posts.map(p=>p.format))].map(format=>{const group=posts.filter(p=>p.format===format);return {format,count:group.length,views:totals(group,'views')};}).sort((x,y)=>y.views.min-x.views.min);
 const max=Math.max(1,...formats.map(f=>f.views.max));const run=a?.runs[0];
 return <main className="performance-page">
  <header><div><p className="eyebrow">PERSONAL WORKBENCH / SOCIAL</p><h1>Social performance</h1><p className="page-intro">What’s reaching people. What’s worth repeating.</p></div><span className={`badge ${data?.state==='live'?'online':''}`}><i/>{data?.state==='demo'?'Mock data':data?.state==='live'?'Live workbook':data?.state==='snapshot'?'Saved workbook':data?.state==='stale'?'Stale data':data?'Connection needed':'Connecting'}</span></header>
  <div className="workbook-status" role="status"><p>{data?.message??'Reading Social Content Performance…'}</p>{data?.syncedAt&&<small>Workbook copied/read {new Date(data.syncedAt).toLocaleString()}. Metrics retain their original observation dates.</small>}</div>
  <div className="performance-toolbar"><div><label htmlFor="performance-account">Account</label><select id="performance-account" value={account} onChange={e=>setAccount(e.target.value)}><option value="all">All accounts</option>{a?.accounts.map(v=><option key={v}>{v}</option>)}</select></div><p>{posts.length} unique posts · {a?.observationCount??0} workbook observations<br/><span>Latest reported values across all recorded posts</span></p></div>
  <div className="metric-cards">{([['views','Views / plays'],['reach','Post reach'],['shares','Shares'],['saves','Saves'],['follows','Attributed follows'],['visits','Profile visits']] as [MetricKey,string][]).map(([key,label])=>{
   const m=totals(posts,key);return <section key={key} className="metric-card"><label>{label}</label><strong>{m.covered?range(m):'Unavailable'}</strong><small>{m.covered} of {m.total} posts measured</small></section>;
  })}</div>
  <p className="measurement-note">Each post contributes its latest non-empty measurement, never every snapshot. Dates and measurement windows vary. Missing values stay unavailable. Post reach is summed across posts and is not unique audience reach. Threads performance is not recorded in this workbook yet.</p>
  {!a&&<section className="card empty-performance"><h2>Your workbook, in one view</h2><p className="helper">Connect Google Sheets or import a private workbook copy to see post performance, weekly findings, experiments and collection status.</p></section>}
  {a&&<>
   {!!a.issues.length&&<details className="data-issues"><summary>{a.issues.length} data-quality notes</summary><ul>{a.issues.map((v,i)=><li key={i}>{v}</li>)}</ul></details>}
   <div className="performance-columns"><section className="card format-performance"><div className="section-heading"><div><label>DISTRIBUTION</label><h2>Views by format</h2></div></div>{formats.map(f=><div className="format-row" key={f.format}><div><strong>{f.format||'Unspecified'}</strong><span>{f.views.covered?range(f.views):'Unavailable'}</span></div><div className="format-track"><div style={{width:`${f.views.min/max*100}%`}}/></div><small>{f.count} posts · {f.views.covered} measured</small></div>)}<p className="helper">Totals reflect both publishing volume and performance. Bars use the lower bound where the workbook reports a range.</p></section>
   <section className="card weekly-findings"><label>FROM WEEKLY ANALYSIS</label><h2>Repeat & refine</h2>{latestAnalysis.length?latestAnalysis.map(r=><article key={r.Account}><p className="insight-account">{r.Account} · {r.Week}</p><h3>Repeat</h3><p>{r['Patterns to Repeat']||'No recommendation recorded.'}</p><h3>Change</h3><p>{r['Patterns to Change']||'No recommendation recorded.'}</p></article>):<p className="helper">No weekly analysis for this account.</p>}</section></div>
   <section className="card ranked-posts"><div className="section-heading"><div><label>POST-LEVEL RESULTS</label><h2>Posts worth learning from</h2></div><div><label htmlFor="post-ranking">Rank by</label><select id="post-ranking" value={ranking} onChange={e=>setRanking(e.target.value as MetricKey)}><option value="views">Views / plays</option><option value="reach">Post reach</option><option value="shares">Shares</option><option value="saves">Saves</option><option value="follows">Attributed follows</option></select></div></div>
   <div className="post-results">{ranked.map((p,i)=><article key={p.id}><div className="post-rank">{String(i+1).padStart(2,'0')}</div><div className="post-detail"><p className="insight-account">{p.account} · {p.format} · {p.pillar}</p><h3>{p.url?<a href={p.url} target="_blank" rel="noopener noreferrer">{p.hook||'View post'} ↗</a>:p.hook||'Untitled post'}</h3><p className="helper">Published {p.publishedAt||'date unavailable'} · Last observation {p.lastObservedAt}</p><details><summary>Measurement dates and windows</summary><ul>{Object.entries(p.metrics).map(([key,v])=><li key={key}>{key}: {range(v)} · {v.observedAt} · {v.window}</li>)}</ul></details></div><div className="post-numbers"><div><label>Views</label><strong><Reading value={p.metrics.views}/></strong></div><div><label>Shares / saves</label><strong><Reading value={p.metrics.shares}/> / <Reading value={p.metrics.saves}/></strong></div><div><label>Follows</label><strong><Reading value={p.metrics.follows}/></strong></div></div></article>)}</div></section>
   <section className="card experiments"><label>WORKBOOK EXPERIMENTS / ALL ACCOUNTS</label><h2>What you’re testing</h2>{a.experiments.map((r,i)=><details key={i}><summary><span>{r.Date}</span>{r.Hypothesis}</summary><p className="helper">Variable: {r['Variable Tested']} · Metric: {r['Primary Success Metric']}</p><p>{r.Result}</p><p className="helper">Confidence: {r.Confidence}</p><p><strong>Next:</strong> {r['Next Action']}</p></details>)}</section>
   {run&&<section className="card collection-status"><label>LAST COLLECTION RUN</label><h2>{run['Run Date/Time']}</h2><p className="helper">{run['Accounts Checked']} · {run['Posts Updated']} posts updated · {run['Snapshots Added']} snapshots added</p><details><summary>Permissions and data quality</summary><p>{run['Missing Sources/Permissions']||'No missing sources recorded.'}</p><p>{run['Data Quality Issues']||'No issues recorded.'}</p></details></section>}
  </>}
  <details className="scout-disclosure"><summary>Daily scout opportunities</summary><SocialDashboard/></details>
 </main>;
}
