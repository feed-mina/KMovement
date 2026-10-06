 'use client';
import Link from 'next/link';import {usePathname} from 'next/navigation';
export default function KpopNav(){const path=usePathname()||'';return <nav className="kpop-section-nav" aria-label="K-pop 탐색">{[['아티스트','/view/kpop'],['이벤트','/view/KPOP_EVENTS'],['상품','/view/KPOP_PRODUCTS']].map(([label,url],i)=><Link key={url} href={url} aria-current={(i===0?(path==='/view/kpop'||path.includes('ARTIST')||path.includes('EXPLORE')):i===1?path.includes('EVENT'):path.includes('PRODUCT'))?'page':undefined}>{label}</Link>)}<Link href="/view/INTRO1">코스 만들기 →</Link></nav>}
