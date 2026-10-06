import {renderHook,waitFor} from '@testing-library/react';
import {useKrideItinerary} from '@/components/DynamicEngine/hook/useKrideItinerary';
jest.mock('@/lib/analytics/dataLayer',()=>({trackEvent:jest.fn()}));
test('accepts the actual range-slider budget and preserves source data without a second generation',async()=>{
 const original=global.fetch;const place={id:'a',name:'공개 장소',lat:37.5,lon:127,sourceUrl:'https://example.test/a'};
 global.fetch=jest.fn().mockResolvedValue({ok:true,status:200,json:async()=>({status:'ok',itinerary:[{day:1,morning:{places:[place]}}],mapData:{markers:[{...place,lng:127}]},source_pois:[place],scopeNotice:'일반 서울 장소'})});
 try{
  const form={duration:'day',selectedRegions:[{name:'서울'}],budget:[30000,200000]};
  const {result,rerender}=renderHook(({value})=>useKrideItinerary('KRIDE_FOCUS',value),{initialProps:{value:form}});
  await waitFor(()=>expect(result.current.data?.source_pois).toEqual([place]));
  expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).budget).toEqual({min:30000,max:200000});
  expect(result.current.data?.scopeNotice).toBe('일반 서울 장소');rerender({value:{...form}});expect(fetch).toHaveBeenCalledTimes(1);
 }finally{global.fetch=original}
});
