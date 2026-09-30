'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export function DashboardNav(){
 const path=usePathname();
 return <nav className="dashboard-nav" aria-label="Dashboard views"><div className="nav-brand" aria-label="Personal dashboard">▣</div>
  <Link href="/" className={path==='/'?'selected':''} aria-current={path==='/'?'page':undefined} title="Printer dashboard"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M7 8V3h10v5M7 16H4V8h16v8h-3M7 13h10v8H7z"/><path d="M16 10h2"/></svg><span>Printer</span></Link>
  <Link href="/social" className={path==='/social'?'selected':''} aria-current={path==='/social'?'page':undefined} title="Social dashboard"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 20V4M4 20h17M8 16v-5M13 16V7M18 16V3"/></svg><span>Social</span></Link>
  <div className="nav-local"><i/>Local</div>
 </nav>;
}
