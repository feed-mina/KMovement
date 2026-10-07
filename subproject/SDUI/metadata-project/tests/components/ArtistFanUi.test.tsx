import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import ArtistRelated from '@/components/plugins/kpop/ArtistRelated';
import ArtistMedia from '@/components/plugins/kpop/ArtistMedia';
import {artistReturnPath} from '@/components/plugins/kpop/ArtistReturn';
let query='q=BTS&page=2';
jest.mock('next/navigation',()=>({usePathname:()=>'/view/KPOP_ARTIST_DETAIL/bts',useSearchParams:()=>new URLSearchParams(query),useRouter:()=>{const [,refresh]=require('react').useState(0);return {replace:(url:string)=>{query=url.split('?')[1];refresh((v:number)=>v+1);}}}}));
const response=(data:any,status=200)=>Promise.resolve({ok:status===200,headers:new Headers({'X-Candidate-Policy':'public-evidence-v1'}),json:async()=>({data})} as Response);
beforeEach(()=>{query='q=BTS&page=2';global.fetch=jest.fn()});
test('events are scoped by artist and return retains query; product route uses supported itemId',async()=>{
 (fetch as jest.Mock).mockReturnValueOnce(response([{id:10,artistId:1,titleKo:'BTS 일정'},{id:11,artistId:2,titleKo:'다른 그룹'}])).mockReturnValueOnce(response([{id:22,name:'공개 상품'}]));
 render(<ArtistRelated id={1} name="BTS"/>);
 const event=await screen.findByRole('link',{name:'BTS 일정'});expect(screen.queryByText('다른 그룹')).toBeNull();
 expect(new URL(event.getAttribute('href')!,'https://example.org').searchParams.get('returnArtist')).toBe('/view/KPOP_ARTIST_DETAIL/bts?q=BTS&page=2');
 fireEvent.click(screen.getByRole('button',{name:'관련 상품'}));
 expect(await screen.findByRole('link',{name:'공개 상품'})).toHaveAttribute('href',expect.stringContaining('/view/KPOP_PRODUCTS?itemId=22&'));
 expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('artistId=1'),expect.any(Object));
});
test('failure is not empty and retry recovers',async()=>{
 (fetch as jest.Mock).mockReturnValueOnce(response(null,500)).mockReturnValueOnce(response([]));
 render(<ArtistRelated id={1} name="BTS"/>);await screen.findByRole('alert');expect(screen.queryByText(/아직 확인된/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));await screen.findByText(/아직 확인된 새 일정/);expect(screen.queryByRole('alert')).toBeNull();
});
test('late event response cannot replace product tab',async()=>{
 let resolve:(v:any)=>void=()=>{};(fetch as jest.Mock).mockReturnValueOnce(new Promise(r=>resolve=r)).mockReturnValueOnce(response([{id:22,name:'현재 상품'}]));
 render(<ArtistRelated id={1} name="BTS"/>);fireEvent.click(screen.getByRole('button',{name:'관련 상품'}));await screen.findByText('현재 상품');
 await act(async()=>resolve(await response([{id:10,artistId:1,titleKo:'늦은 일정'}])));expect(screen.queryByText('늦은 일정')).toBeNull();expect(screen.getByText('현재 상품')).toBeInTheDocument();
});
test('broken photo keeps name and changing artist resets image failure',()=>{
 const v=render(<ArtistMedia id={1} name="BTS"/>);fireEvent.error(screen.getByRole('img'));expect(screen.getByText('BTS')).toBeInTheDocument();expect(screen.getByText('사진을 준비하고 있어요')).toBeInTheDocument();
 v.rerender(<ArtistMedia id={2} name="BLACKPINK"/>);expect(screen.getByRole('img')).toHaveAttribute('src',expect.stringContaining('/2.'));
});
test('return navigation accepts only internal artist detail',()=>{
 expect(artistReturnPath('https://evil.example')).toBeNull();expect(artistReturnPath('//evil.example')).toBeNull();expect(artistReturnPath('/view/KPOP_ARTIST_DETAIL/bts?q=BTS&page=2')).toBeTruthy();
});

test('section URL survives reload and artist schedule link retains identity and return',async()=>{
 query='q=BTS&page=2&section=products';(fetch as jest.Mock).mockReturnValue(response([]));render(<ArtistRelated id={1} name="BTS"/>);await screen.findByText(/아직 연결된 공개 상품/);expect(fetch).toHaveBeenCalledWith(expect.stringContaining('product-candidates'),expect.anything());fireEvent.click(screen.getByRole('button',{name:'소식·일정'}));await screen.findByText(/아직 확인된 새 일정/);expect(query).toContain('section=events');expect(query).toContain('page=2');const href=screen.getByRole('link',{name:/국내\/해외로 보기/}).getAttribute('href')!;const p=new URL(href,'https://test').searchParams;expect(p.get('artistId')).toBe('1');expect(p.get('scope')).toBe('all');expect(p.get('returnArtist')).toContain('section=events');
});
test('photo loading settles on success or failure',()=>{render(<ArtistMedia id={1} name="BTS"/>);expect(screen.getByRole('status')).toHaveTextContent('사진을 불러');fireEvent.load(screen.getByRole('img'));expect(screen.queryByRole('status')).toBeNull();});
