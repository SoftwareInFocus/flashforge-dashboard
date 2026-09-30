import React,{useEffect,useState} from 'react';
import type {JobCall} from './StoredPrints';
export function ModelPreview({fileName,call}:{fileName:string|null;call?:JobCall}){
 const [image,setImage]=useState<{file:string;url:string}|null>(null);const [message,setMessage]=useState('Loading model preview…');
 useEffect(()=>{let active=true;setImage(null);setMessage('Loading model preview…');if(!fileName)return;
 const request=call?call('get_print_thumbnail',{fileName}):fetch(`/api/thumbnail?fileName=${encodeURIComponent(fileName)}`,{cache:'no-store'}).then(r=>r.json());
 void request.then(r=>{if(!active)return;if(r.ok&&r.imageData&&['image/png','image/jpeg'].includes(r.mimeType??''))setImage({file:fileName,url:`data:${r.mimeType};base64,${r.imageData}`});else setMessage('No model preview available.');}).catch(()=>{if(active)setMessage('Model preview unavailable.');});return()=>{active=false;};
 },[fileName,call]);
 if(!fileName)return null;
 return <figure className="model-preview">{image?.file===fileName?<img src={image.url} alt={`Sliced model preview for ${fileName}`} onError={()=>{setImage(null);setMessage('Model preview unavailable.');}}/>:<div className="preview-placeholder">{message}</div>}<figcaption>Sliced model preview</figcaption></figure>;
}
