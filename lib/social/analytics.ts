import { z } from 'zod';
export const METRIC_HEADERS=['Account','Post URL','Platform Post ID','Publish Date/Time','Format','Content Pillar','Hook','Trend or Evergreen','Trend/Example Reel URL','Metric Window','Snapshot Date','Reach','Non-Follower Reach','Impressions','Views/Plays','Avg Watch Time','Retention/Completion Rate','Shares','Saves','Comments','Likes','Profile Visits','Follows Attributed','Link Clicks','Leads/Inquiries','Source Timestamp','Metric Collected At','Notes'];
export const ANALYSIS_HEADERS=['Week','Account','Best Post by Reach','Best Post by Shares+Saves','Best Reel by Watch Time/Retention','Best Post by Profile Actions/Leads','Patterns to Repeat','Patterns to Change','Stop Testing','Trend vs Evergreen','Notes'];
export const EXPERIMENT_HEADERS=['Date','Hypothesis','Variable Tested','Posts Compared','Primary Success Metric','Result','Confidence','Next Action'];
export const LOG_HEADERS=['Run Date/Time','Accounts Checked','Posts Updated','Snapshots Added','Missing Sources/Permissions','Data Quality Issues','Ready for Next Planning Run'];
const cells=z.array(z.array(z.union([z.string().max(12000),z.number().finite(),z.null()]))).max(10002);
export const WorkbookFile=z.object({version:z.literal(1),syncedAt:z.iso.datetime({offset:true}),tabs:z.record(z.string(),cells)});
export type WorkbookData=z.infer<typeof WorkbookFile>;
export function table(values:unknown,headers:string[],name:string):Record<string,string>[] {
 const rows=cells.parse(values);
 if(!rows[0]||rows[0].length!==headers.length||!headers.every((h,i)=>rows[0][i]===h))throw new Error(`${name} headers changed`);
 return rows.slice(1).filter(row=>row.some(v=>v!==null&&v!=='')).map(row=>{
  if(row.length>headers.length)throw new Error(`${name} row has extra columns`);
  return Object.fromEntries(headers.map((key,i)=>[key,String(row[i]??'')]));
 });
}
export type Measurement={min:number;max:number;observedAt:string;window:string};
export function numeric(value:string):{min:number;max:number}|null {
 const clean=value.replaceAll(',','').trim();
 const m=clean.match(/^(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?$/);
 if(!m)return null;const min=Number(m[1]),max=Number(m[2]??m[1]);
 return Number.isFinite(min)&&Number.isFinite(max)&&max>=min?{min,max}:null;
}
export const metricColumns={views:'Views/Plays',reach:'Reach',shares:'Shares',saves:'Saves',comments:'Comments',likes:'Likes',follows:'Follows Attributed',visits:'Profile Visits'} as const;
export type MetricKey=keyof typeof metricColumns;
export type Post={id:string;account:string;url:string;publishedAt:string;format:string;pillar:string;hook:string;lastObservedAt:string;metrics:Partial<Record<MetricKey,Measurement>>};
export type Analytics={posts:Post[];accounts:string[];analyses:Record<string,string>[];experiments:Record<string,string>[];runs:Record<string,string>[];observationCount:number;issues:string[]};
const safeUrl=(v:string)=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?v:'';}catch{return '';}};
export function buildAnalytics(tabs:WorkbookData['tabs']):Analytics{
 const records=table(tabs['Post Metrics'],METRIC_HEADERS,'Post Metrics');
 const issues:string[]=[];const posts=new Map<string,Post>();
 // Later snapshot dates win; later appended rows win ties. Blank updates preserve prior known metrics.
 for(const [i,row] of records.map((r,i)=>({r,i})).sort((a,b)=>a.r['Snapshot Date'].localeCompare(b.r['Snapshot Date'])||a.i-b.i).map(v=>[v.i,v.r] as const)){
  const account=row.Account.trim();const id=row['Platform Post ID']||safeUrl(row['Post URL']);const date=row['Snapshot Date'];
  if(!account||!id||!z.iso.date().safeParse(date).success){issues.push(`Post Metrics row ${i+2}: missing identity or snapshot date`);continue;}
  const key=`${account}:${id}`;
  const post=posts.get(key)??{id:key,account,url:safeUrl(row['Post URL']),publishedAt:row['Publish Date/Time'],format:row.Format,pillar:row['Content Pillar'],hook:row.Hook,lastObservedAt:date,metrics:{}};
  post.lastObservedAt=date;
  for(const [key,column] of Object.entries(metricColumns) as [MetricKey,string][]){
   const value=numeric(row[column]);
   if(value)post.metrics[key]={...value,observedAt:date,window:row['Metric Window']};
   else if(row[column].trim()&&!['--','N/A','n/a'].includes(row[column]))issues.push(`Post Metrics row ${i+2}: ${column} is not an exact number or numeric range`);
  }
  posts.set(key,post);
 }
 return {posts:[...posts.values()],accounts:[...new Set([...posts.values()].map(p=>p.account))].sort(),analyses:table(tabs['Weekly Analysis'],ANALYSIS_HEADERS,'Weekly Analysis').reverse(),experiments:table(tabs.Experiments,EXPERIMENT_HEADERS,'Experiments').reverse(),runs:table(tabs['Run Log'],LOG_HEADERS,'Run Log').reverse(),observationCount:records.length,issues};
}
export function totals(posts:Post[],key:MetricKey){const values=posts.flatMap(p=>p.metrics[key]?[p.metrics[key]!]:[]);return {min:values.reduce((n,v)=>n+v.min,0),max:values.reduce((n,v)=>n+v.max,0),covered:values.length,total:posts.length};}
