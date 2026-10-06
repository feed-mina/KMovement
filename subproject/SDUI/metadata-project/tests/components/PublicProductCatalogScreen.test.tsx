import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import PublicProductCatalogScreen from '@/components/plugins/kpop/PublicProductCatalogScreen';
let query='';const push=jest.fn();
jest.mock('next/navigation',()=>({usePathname:()=>'/view/KPOP_EXPLORE',useRouter:()=>({push}),useSearchParams:()=>new URLSearchParams(query)}));
const item={id:1,name:'응원봉 후보',brand:'LIGHT',evidenceGrade:'EXACT_CANDIDATE',evidenceText:'공식 기록 대조',catalogSource:'MANUAL_CURATED',lastVerifiedAt:'2026-10-01 10:15:00',rightsChecked:true,officialUrl:'https://example.com/products/1'};
const response=(data:any,status=200,policy='public-evidence-v1')=>Promise.resolve({ok:status===200,status,headers:{get:()=>policy},json:async()=>({data})} as unknown as Response);
const component=()=> <PublicProductCatalogScreen screenId="KPOP_PRODUCTS" refId={null}/>;
beforeEach(()=>{query='';push.mockReset();global.fetch=jest.fn();});
test('C01 search preserves optional filters and only public credential-free GET is used',async()=>{
 query='artistId=1&eventId=2';(fetch as jest.Mock).mockReturnValue(response([item]));render(component());await screen.findByText(item.name);
 fireEvent.change(screen.getByLabelText('상품명 또는 브랜드'),{target:{value:' LIGHT '}});fireEvent.submit(screen.getByRole('search'));
 expect(push).toHaveBeenLastCalledWith('/view/KPOP_PRODUCTS?q=LIGHT&artistId=1&eventId=2',{scroll:false});
 expect(fetch).toHaveBeenCalledWith('/api/v1/kpop/product-candidates?view=public&limit=20&artistId=1&eventId=2',expect.objectContaining({credentials:'omit',cache:'no-store'}));
 expect(screen.queryByRole('button',{name:/저장/})).not.toBeInTheDocument();expect(fetch).toHaveBeenCalledTimes(1);
});
test('C01 121 characters stops form submission before a request',async()=>{
 (fetch as jest.Mock).mockReturnValue(response([item]));render(component());await screen.findByText(item.name);
 fireEvent.change(screen.getByLabelText('상품명 또는 브랜드'),{target:{value:'a'.repeat(121)}});fireEvent.submit(screen.getByRole('search'));
 expect(await screen.findByRole('alert')).toHaveTextContent('120자');expect(push).not.toHaveBeenCalled();expect(fetch).toHaveBeenCalledTimes(1);
});
test('oversized URL is also blocked before fetch',async()=>{query='q='+ 'a'.repeat(121);render(component());await screen.findByRole('alert');expect(fetch).not.toHaveBeenCalled();});
test('C02 source recorded time and non-guaranteed grade appear; no made-up model score',async()=>{
 (fetch as jest.Mock).mockReturnValue(response([{...item,confidence:99}]));render(component());await screen.findByText(item.name);
 expect(screen.getByText('운영 검수 카탈로그',{exact:false})).toBeInTheDocument();expect(screen.getByText(/2026-10-01 10:15:00/)).toBeInTheDocument();
 expect(screen.getByText(/동일 상품 확정 아님/)).toBeInTheDocument();expect(screen.queryByText(/모델 참고 점수/)).not.toBeInTheDocument();
});
test('C06 unreviewed link is absent even when URL exists',async()=>{
 (fetch as jest.Mock).mockReturnValue(response([{...item,rightsChecked:false}]));render(component());await screen.findByText(item.name);expect(screen.queryByRole('link',{name:/공식 출처/})).not.toBeInTheDocument();
});
test('C06 reviewed HTTPS link opens a separate tab',async()=>{
 (fetch as jest.Mock).mockReturnValue(response([item]));render(component());await screen.findByText(item.name);
 expect(screen.getByRole('link',{name:/공식 출처/})).toHaveAttribute('href',item.officialUrl);expect(screen.getByRole('link',{name:/공식 출처/})).toHaveAttribute('target','_blank');
});
test('C03 empty is normal and disclaimer stays visible',async()=>{
 (fetch as jest.Mock).mockReturnValue(response([]));render(component());expect(await screen.findByRole('status')).toHaveTextContent('상품이 없다는 뜻은 아니며');
 expect(screen.getByText(/동일 상품·정품·구매 적합성을 보증하지/)).toBeInTheDocument();expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('500 keeps conditions and retries without pretending empty',async()=>{
 query='q=LIGHT';(fetch as jest.Mock).mockReturnValueOnce(response(null,500)).mockReturnValue(response([item]));render(component());await screen.findByRole('alert');expect(screen.queryByRole('status')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));await screen.findByText(item.name);expect((fetch as jest.Mock).mock.calls[0][0]).toEqual((fetch as jest.Mock).mock.calls[1][0]);
});
test('reset removes query and optional association filters',async()=>{
 query='q=LIGHT&artistId=1&eventId=2';(fetch as jest.Mock).mockReturnValue(response([item]));render(component());await screen.findByText(item.name);
 fireEvent.click(screen.getByRole('button',{name:'초기화'}));expect(push).toHaveBeenLastCalledWith('/view/KPOP_PRODUCTS',{scroll:false});
});
test('stale response cannot replace newer search',async()=>{
 let old:(x:any)=>void=()=>{};(fetch as jest.Mock).mockReturnValueOnce(new Promise(r=>old=r)).mockReturnValue(response([{...item,name:'새 후보'}]));
 const view=render(component());query='q=new';view.rerender(component());await screen.findByText('새 후보');await act(async()=>old(await response([item])));expect(screen.queryByText(item.name)).not.toBeInTheDocument();
});
test('missing policy header fails closed rather than consuming legacy contract',async()=>{
 (fetch as jest.Mock).mockReturnValue(response([item],200,''));render(component());await screen.findByRole('alert');expect(screen.queryByText(item.name)).not.toBeInTheDocument();
});
