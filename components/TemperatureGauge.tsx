import React from 'react';
export function TemperatureGauge({kind,current,target}:{kind:'nozzle'|'bed';current:number|null;target:number|null}){
 // Labeled display scales, not hardware limits. Expand if a reading exceeds the default.
 const max=Math.max(kind==='nozzle'?300:120,Math.ceil(Math.max(current??0,target??0)/20)*20);
 const value=current==null?0:Math.min(100,current/max*100);const marker=target==null?0:Math.min(100,target/max*100);
 const label=target==null||current==null?'Unavailable':target===0?'Heater off':Math.abs(current-target)<=2?'At target':current<target?'Heating to target':'Above target';
 return <section className={`card temperature ${kind}`}><div className="section-heading"><label>{kind==='nozzle'?'NOZZLE':'PRINT BED'}</label><span>{label}</span></div><div className="temperature-reading"><h3>{current==null?'—':current.toFixed(1)}<small>°C</small></h3><p>Target <strong>{target==null?'—':`${target.toFixed(0)}°C`}</strong></p></div>
 <div className="thermal-gauge" role="img" aria-label={`${kind}: current ${current??'unavailable'} degrees Celsius, target ${target??'unavailable'}, display scale zero to ${max}`}><div className="thermal-fill" style={{width:`${value}%`,opacity:current==null?0:1}}/>{target!==null&&target>0&&<div className="thermal-target" style={{left:`${marker}%`}}><span>Target</span></div>}</div><div className="gauge-scale"><span>0°C</span><span>{max/2}°C</span><span>{max}°C</span></div><div className="gauge-key"><span><i/>Current temperature</span><span>│ Target marker</span></div>
 </section>;
}
