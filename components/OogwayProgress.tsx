import React from 'react';
import { oogwaySprite } from '../lib/oogway-sprite';
export function OogwayProgress({progress,walking}:{progress:number|null;walking:boolean}){
 const percent=Math.max(0,Math.min(100,progress??0));
 return <div className="oogway-walkway"><progress max="100" value={percent} aria-label="Print progress"/>{progress!==null&&<div className="oogway-position" style={{left:`${percent}%`}} aria-hidden="true"><div className={`oogway-sprite ${walking&&percent<100?'walking':''}`} style={{backgroundImage:`url(${oogwaySprite})`}}/></div>}<div className="journey-labels"><span>Starting out</span><span>100%</span></div></div>;
}
