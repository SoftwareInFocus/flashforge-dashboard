import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@modelcontextprotocol/ext-apps';
import type { Snapshot } from '../../lib/status';
import '../../app/globals.css';
import { PrinterDashboard } from '../../components/PrinterDashboard';
const jobCall=async(name:string,args:Record<string,unknown>)=>{const r=await bridge.callServerTool({name,arguments:args},{timeout:20000});if(r.isError)return {ok:false,message:r.content?.filter(c=>c.type==='text').map(c=>'text' in c?c.text:'').join(' ')||'Printer request failed.'};return r.structuredContent as import('../../components/StoredPrints').JobReply;};
const bridge=new App({name:'flashforge-dashboard',version:'0.1.0'},{});
function Dashboard(){
 const [state,setState]=useState<Snapshot|null>(null);const [message,setMessage]=useState('Connecting to ChatGPT…');const [ready,setReady]=useState(false);const [last,setLast]=useState<string|null>(null);
 useEffect(()=>{
  let active=true;let timer:ReturnType<typeof setTimeout>;let busy=false;let connected=false;
  function receive(result:{structuredContent?:unknown}){if(!active)return;const s=result.structuredContent as Snapshot|undefined;if(s && ['online','offline','invalid','unconfigured'].includes(s.connection)){setState(s);setMessage(s.message);if(s.connection==='online')setLast(s.checkedAt);}}
  bridge.ontoolresult=receive;
  async function poll(){if(!active)return;if(document.hidden){timer=setTimeout(poll,3000);return;}busy=true;try{receive(await bridge.callServerTool({name:'get_printer_status',arguments:{}},{timeout:8000}));}catch{if(active){setState(null);setMessage('Connection interrupted. Retrying automatically.');}}finally{busy=false;if(active)timer=setTimeout(poll,3000);}}
  bridge.connect().then(()=>{connected=true;if(active){setReady(true);void poll();}}).catch(()=>{if(active)setMessage('Open this dashboard through the FlashForge plugin in ChatGPT.');});
  const wake=()=>{if(connected && !document.hidden && !busy){clearTimeout(timer);void poll();}};document.addEventListener('visibilitychange',wake);
  return()=>{active=false;clearTimeout(timer);document.removeEventListener('visibilitychange',wake);void bridge.close();};
 },[]);
 if(!ready)return <main><p role="status">{message}</p></main>;
 return <PrinterDashboard state={state} message={message} ready={ready} last={last} jobCall={jobCall}/>;
}
createRoot(document.getElementById('root')!).render(<Dashboard/>);
