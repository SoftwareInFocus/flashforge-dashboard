import React from 'react';
import { OogwayProgress } from './OogwayProgress';
import { ModelPreview } from './ModelPreview';
import { TemperatureGauge } from './TemperatureGauge';
import { StoredPrints, type JobCall } from './StoredPrints';
import type { Snapshot } from '../lib/status';
const num=(v:number|null|undefined)=>v==null?'Unavailable':String(v);
const time=(v:number|null|undefined)=>v==null?'Unavailable':`${Math.floor(v/3600)}h ${Math.floor(v%3600/60)}m`;
export function PrinterDashboard({state,message,ready,last,jobCall}:{jobCall?:JobCall;state:Snapshot|null;message:string;ready:boolean;last:string|null}){
 const d=state?.data;const idle=d?.status==='ready'&&!d.file;const online=state?.connection==='online';
 return <main>
 <header><div className="brand"><div className="brand-icon">▣</div><div><p className="eyebrow">PERSONAL WORKBENCH</p><h1>FlashForge <span>AD5X</span></h1></div></div><div className={`badge ${online?'online':''}`}><i/>{online?'Connected':ready?'Offline':'Connecting'}</div></header>
 <div className="overview"><span>PRINTER DASHBOARD</span><span>{last?`Updated ${new Date(last).toLocaleTimeString()}`:'Waiting for live status'}</span></div>
 {!online&&<section className="notice" role="status">{message}</section>}
 <section className="job"><div className="job-heading"><label>CURRENT PRINT</label><span className="status"><i/>{d?.status ?? 'Unknown'}</span></div>
 <div className="job-body"><div className="job-copy"><h2>{idle?'Ready for your next idea.':d?.file ?? (d?'No print file reported':'Waiting for printer')}</h2><p>{idle?'Choose a stored print below, or prepare a new file in Flash Studio.':d?'Live progress from your AD5X.':'The dashboard will reconnect automatically.'}</p><div className="stats"><div><label>LAYERS</label><strong>{idle?'—':`${num(d?.layer)} / ${num(d?.layers)}`}</strong></div><div><label>ELAPSED</label><strong>{idle?'—':time(d?.elapsed)}</strong></div><div><label>REMAINING</label><strong>{idle?'—':time(d?.remaining)}</strong></div></div></div>
 <div className="job-visual"><ModelPreview fileName={d?.file??null} call={jobCall}/><div className={`progress-ring ${idle?'idle':''}`} style={{'--progress':`${d?.progress ?? 0}%`} as React.CSSProperties} role="img" aria-label={idle?'Printer idle':`Print progress ${d?.progress ?? 'unknown'} percent`}><div><strong>{idle?'▣':d?.progress==null?'—':`${d.progress.toFixed(1)}%`}</strong><small>{idle?'STANDING BY':'COMPLETE'}</small></div></div></div></div>
 <div className="temperatures">{(['nozzle','bed'] as const).map(k=><TemperatureGauge key={k} kind={k} current={d?.[k].current??null} target={d?.[k].target??null}/>)}</div>
 {!idle&&<OogwayProgress progress={d?.progress??null} walking={d?.status.toLowerCase()==='printing'}/> }</section>

 <section className="card station"><div className="section-heading"><div><label>MULTICOLOR SYSTEM</label><h2>Filament station</h2></div><span>IFS · 4 slots</span></div>{d?.slots?.length?<div className="slots">{d.slots.map((s,i)=><div className={`slot ${s.active?'active':''} ${s.loaded===false?'empty':''}`} key={i}><div className="slot-top"><label>SLOT {s.id ?? '?'}</label>{s.active&&<span>In use</span>}</div><div className="spool" style={{'--filament':s.color} as React.CSSProperties}><div/></div><strong>{s.material ?? 'Unknown'}</strong><small><i/>{s.loaded==null?'Presence unknown':s.loaded?'Loaded':'Not loaded'}</small></div>)}</div>:<p>Filament information {d?'not exposed by printer':'unavailable while disconnected'}.</p>}</section>
 <section className={`health ${d?.error?'error':''}`} role="status"><div className="health-icon">{d?.error?'!':d?'✓':'·'}</div><div><strong>{d?.error?`Printer error: ${d.error}`:d?'No errors reported':'Printer status unavailable'}</strong><p>{d?'Status reported directly by your printer.':'Check that your printer is on and connected to your home network.'}</p></div></section>
 <StoredPrints snapshot={state} call={jobCall}/>
 <footer><span><i/>Local connection · Updates every 3 seconds</span><span>Slicing and profiles in Flash Studio</span></footer>
 </main>;

}
