import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { getPrintThumbnail, listStoredFiles, prepareStoredPrint, startStoredPrint, prepareSchema, startSchema } from '../../lib/jobs';
import { readPrinter } from '../../lib/printer';
import type { Snapshot } from '../../lib/status';

// Configuration is loaded by Node from the repository root, never exposed via a tool.
const here = dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(resolve(here, '../../.env.local')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Unable to load local printer configuration.'); }
const uiUri = 'ui://flashforge/dashboard-v1.html';
const n = z.number().nonnegative().nullable();
const t = z.object({current:n,target:n});
const schema = z.object({connection:z.enum(['online','offline','unconfigured','invalid']),message:z.string(),checkedAt:z.string(),data:z.object({name:z.string(),status:z.string(),error:z.string().nullable(),file:z.string().nullable(),progress:n,layer:n,layers:n,elapsed:n,remaining:n,nozzle:t,bed:t,slots:z.array(z.object({id:n,material:z.string().nullable(),color:z.string(),loaded:z.boolean().nullable(),active:z.boolean()})).nullable()}).nullable()});
let pending:Promise<Snapshot>|null=null;let cached:Snapshot|null=null;let cachedAt=0;
async function snapshot(){
 if(cached && Date.now()-cachedAt<2000)return cached;
 pending ??= readPrinter().then(s=>{cached=s;cachedAt=Date.now();return s;}).finally(()=>{pending=null;});
 return pending;
}
export function makeServer(){
 process.env.PRINTER_STATE_DIR ??= resolve(here,'../../.local/printer-jobs');
 const server=new McpServer({name:'flashforge-ad5x',version:'0.3.0'});
 registerAppResource(server,'printer-dashboard',uiUri,{},async()=>({contents:[{uri:uiUri,mimeType:RESOURCE_MIME_TYPE,text:readFileSync(resolve(here,'dashboard.html'),'utf8'),_meta:{ui:{prefersBorder:true,csp:{connectDomains:[],resourceDomains:[]}},'openai/widgetDescription':'Live AD5X printer dashboard with stored-file selection with print progress, temperatures and IFS slots.'}}]}));
 const annotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
 async function reply(){const s=await snapshot();return {structuredContent:s,content:[{type:'text' as const,text:JSON.stringify(s)}]};}
 registerAppTool(server,'get_printer_status',{title:'Read AD5X status',description:'Read the configured local AD5X printer: connection, job, progress, layers, elapsed and remaining seconds, temperatures, errors and IFS slots. No printer controls.',inputSchema:z.object({}).strict(),outputSchema:schema,annotations,_meta:{ui:{visibility:['model','app']}}},reply);
 registerAppTool(server,'open_printer_dashboard',{title:'Open AD5X dashboard',description:'Open the live dashboard for the local FlashForge AD5X.',inputSchema:z.object({}).strict(),outputSchema:schema,annotations,_meta:{ui:{resourceUri:uiUri},'openai/ui':{entrypoints:[{type:'global'},{type:'thread'}]}}},reply);
 const jobReply=async(fn:()=>Promise<unknown>)=>{try{const result=await fn();return {content:[{type:'text' as const,text:JSON.stringify(result)}],structuredContent:result as Record<string,unknown>};}catch(e){return {isError:true,content:[{type:'text' as const,text:e instanceof Error?e.message:'Print request failed.'}]};}};
 registerAppTool(server,'get_print_thumbnail',{title:'Read model preview',description:'Read a sliced-model thumbnail for a current or recent stored print. Not a camera image.',inputSchema:z.object({fileName:z.string().min(1).max(512)}).strict(),annotations,_meta:{ui:{visibility:['model','app']}}},(args:{fileName:string})=>jobReply(()=>getPrintThumbnail(args.fileName)));
 registerAppTool(server,'list_stored_prints',{title:'List recent stored prints',description:'List up to ten recent files stored on the AD5X, with material requirements. Not a completed-print history.',inputSchema:z.object({}).strict(),annotations,_meta:{ui:{visibility:['model','app']}}},()=>jobReply(listStoredFiles));
 registerAppTool(server,'prepare_stored_print',{title:'Review stored print',description:'Validate a selected stored file and tool-to-slot mappings against live loaded filament. Returns color warnings and a fingerprint to use for starting. Does not start a print.',inputSchema:prepareSchema,annotations,_meta:{ui:{visibility:['model','app']}}},(args:z.infer<typeof prepareSchema>)=>jobReply(()=>prepareStoredPrint(args)));
 registerAppTool(server,'start_stored_print',{title:'Start stored print',description:'Start the exact previously reviewed file. Requires explicit user confirmation, cleared bed confirmation, current fingerprint and a unique request UUID. Never automatically retry an uncertain result or choose a different file. Physically starts the printer.',inputSchema:startSchema,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:false},_meta:{ui:{visibility:['model','app']}}},(args:z.infer<typeof startSchema>)=>jobReply(()=>startStoredPrint(args)));
 return server;
}
async function main(){
 if(!process.argv.includes('--http')){await makeServer().connect(new StdioServerTransport());return;}
 const port=Number(process.env.MCP_PORT || 8787);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid MCP_PORT');
 const token=process.env.MCP_BEARER_TOKEN;
 const http=createServer(async(req,res)=>{
  if(req.url==='/health' && req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true}');return;}
  if(req.url!=='/mcp'){res.writeHead(404).end();return;}
  // Loopback-only HTTP. A hosted connection must forward here through a trusted tunnel.
  if(req.headers.origin){res.writeHead(403).end('Browser origins are not accepted');return;}
  if(token && req.headers.authorization!==`Bearer ${token}`){res.writeHead(401).end('Unauthorized');return;}
  const host=req.headers.host?.split(':')[0];
  if(host!=='127.0.0.1' && host!=='localhost'){res.writeHead(403).end('Invalid host');return;}
  const server=makeServer();const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  res.on('close',()=>{void transport.close();void server.close();});
  try{await server.connect(transport);await transport.handleRequest(req,res);}catch{if(!res.headersSent)res.writeHead(500).end('MCP request failed');}
 });
 http.listen(port,'127.0.0.1',()=>console.error(`FlashForge MCP listening at http://127.0.0.1:${port}/mcp`));
 const stop=()=>http.close(()=>process.exit(0));process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))void main().catch(()=>{console.error('FlashForge MCP startup failed. Check configuration.');process.exitCode=1;});
