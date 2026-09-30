import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
await mkdir('plugin/dist',{recursive:true});
await build({entryPoints:['plugin/src/widget.tsx'],bundle:true,format:'iife',platform:'browser',outfile:'plugin/dist/widget.js',minify:true});
const js=await readFile('plugin/dist/widget.js','utf8');const css=await readFile('plugin/dist/widget.css','utf8');
await writeFile('plugin/dist/dashboard.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FlashForge AD5X</title><style>${css}</style></head><body><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`);
await build({entryPoints:['plugin/src/server.ts'],bundle:true,packages:'external',platform:'node',format:'esm',outfile:'plugin/dist/server.mjs'});
