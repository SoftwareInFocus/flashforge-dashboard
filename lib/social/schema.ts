import { z } from 'zod';
import { parse } from 'csv-parse/sync';

export const HEADERS = ['schema_version','id','scouted_at','platform','opportunity_type','creator','source_url','topic','title','reason','score','draft_text','status','notes'] as const;
const text = (max: number) => z.string().max(max).refine(v => !v.includes('\0'), 'NUL is not allowed');
const required = (max: number) => text(max).refine(v => v.trim().length > 0, 'Required');
const url = text(2048).refine(v => {
 if (!v) return true;
 try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}, 'Use an HTTPS URL without credentials');
export const ScoutRow = z.object({
 schema_version: z.literal('1'),
 id: z.string().uuid(),
 scouted_at: z.iso.datetime({offset:true}),
 platform: z.enum(['threads','instagram']),
 opportunity_type: z.enum(['reply','quote_post','content_idea','creator_watch']),
 creator: text(200), source_url: url, topic: required(200), title: required(300), reason: required(2000),
 score: z.string().regex(/^(?:[0-9](?:\.\d)?|10(?:\.0)?)$/).transform(Number),
 draft_text: text(4000), status: z.enum(['new','reviewed','used','dismissed']), notes: text(2000),
}).strict().superRefine((row, ctx) => {
 if (row.opportunity_type !== 'content_idea' && (!row.source_url || !row.creator.trim())) ctx.addIssue({code:'custom',message:'Creator and source URL required for this type',path:['source_url']});
 if (row.platform === 'instagram' && row.opportunity_type === 'quote_post') ctx.addIssue({code:'custom',message:'quote_post is Threads only',path:['opportunity_type']});
});
export type Scout = z.infer<typeof ScoutRow>;
export type RowIssue = {row:number;fields:string[]};
export function validateRows(input: unknown): {rows:Scout[];issues:RowIssue[]} {
 if (!Array.isArray(input) || input.length === 0 || input.length > 10001) throw new Error('Missing header or row limit exceeded');
 const [header,...records] = input;
 if (!Array.isArray(header) || header.length !== HEADERS.length || !HEADERS.every((v,i)=>header[i]===v)) throw new Error('Schema header mismatch');
 const rows:Scout[]=[]; const issues:RowIssue[]=[]; const seen=new Set<string>();
 records.forEach((record,index)=>{
  if (Array.isArray(record) && record.every(v=>v==='')) return;
  // Sheets omits trailing empty cells. Pad only the trailing fields.
  if (!Array.isArray(record) || record.length > HEADERS.length || record.some(v=>typeof v!=='string')) {issues.push({row:index+2,fields:['row']});return;}
  const result=ScoutRow.safeParse(Object.fromEntries(HEADERS.map((key,i)=>[key,record[i]??''])));
  if (!result.success) {issues.push({row:index+2,fields:[...new Set(result.error.issues.map(e=>String(e.path[0]??'row')))]});return;}
  if(seen.has(result.data.id)){issues.push({row:index+2,fields:['id']});return;}
  seen.add(result.data.id); rows.push(result.data);
 });
 return {rows:rows.sort((a,b)=>b.scouted_at.localeCompare(a.scouted_at)||b.score-a.score),issues};
}
export function parseCsv(csv:string) {
 if(Buffer.byteLength(csv)>5_000_000)throw new Error('CSV exceeds 5 MB');
 return validateRows(parse(csv,{bom:true,skip_empty_lines:true,max_record_size:25000}));
}
