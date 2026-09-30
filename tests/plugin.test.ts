import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFileSync} from 'node:fs';
test('real MCP transport exposes read-only tools, sidebar entrypoints, UI resource and safe status',async()=>{
 const client=new Client({name:'flashforge-test',version:'1.0.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:['plugin/dist/server.mjs'],env:{...process.env as Record<string,string>,PRINTER_IP:'',PRINTER_SERIAL:'',PRINTER_CHECK_CODE:''}});
 try {
 await client.connect(transport);
 const {tools}=await client.listTools();assert.deepEqual(tools.map(t=>t.name).sort(),['get_print_thumbnail','get_printer_status','list_stored_prints','open_printer_dashboard','prepare_stored_print','start_stored_print']);
 assert.ok(tools.filter(t=>t.name!=='start_stored_print').every(t=>t.annotations?.readOnlyHint===true && t.annotations?.destructiveHint===false));
 assert.equal(tools.find(t=>t.name==='start_stored_print')?.annotations?.destructiveHint,true);
 const denied=await client.callTool({name:'start_stored_print',arguments:{fileName:'test.3mf'}});assert.equal(denied.isError,true);
 const dashboard=tools.find(t=>t.name==='open_printer_dashboard')!;
 assert.deepEqual((dashboard._meta?.['openai/ui'] as {entrypoints:unknown[]}).entrypoints,[{type:'global'},{type:'thread'}]);
 const result=await client.callTool({name:'get_printer_status',arguments:{}});const status=result.structuredContent as {connection:string;data:unknown};assert.equal(status.connection,'unconfigured');assert.equal(status.data,null);
 const ui=await client.readResource({uri:'ui://flashforge/dashboard-v1.html'});assert.equal(ui.contents[0].mimeType,'text/html;profile=mcp-app');assert.ok('text' in ui.contents[0] && ui.contents[0].text.includes('FlashForge AD5X'));
 const invalid=await client.callTool({name:'get_printer_status',arguments:{ip:'8.8.8.8'}});assert.equal(invalid.isError,true);
 }finally{await client.close();}
});
test('plugin manifest points to the implemented local server',()=>{
 const m=JSON.parse(readFileSync('plugin/plugin.json','utf8'));assert.equal(m.name,'flashforge-ad5x');
 const config=JSON.parse(readFileSync('plugin/mcp.json','utf8'));assert.equal(config.mcpServers['flashforge-ad5x'].args[0], 'plugin/dist/server.mjs');
});
