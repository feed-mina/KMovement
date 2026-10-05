import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import HolySubmitPage from '@/app/holy/submit/page';
import api from '@/services/axios';
let mockLoggedIn=true;
jest.mock('@/context/AuthContext',()=>({useAuth:()=>({isLoggedIn:mockLoggedIn,isLoading:false})}));
jest.mock('@/services/axios',()=>({__esModule:true,default:{post:jest.fn()}}));
jest.mock('@/components/fields/kride/maps/HolyMapPicker',()=>({__esModule:true,default:()=> <div>지도 시험 대역</div>}));
jest.mock('@/components/fields/kride/maps/loadKakaoMaps',()=>({loadKakaoMaps:jest.fn()}));
beforeEach(()=>{mockLoggedIn=true;jest.clearAllMocks();});
function fill(){
 fireEvent.change(screen.getByLabelText('장소명'),{target:{value:'검증 장소'}});
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'BTS'}});
 fireEvent.change(screen.getByLabelText('검색된 기본 주소'),{target:{value:'서울특별시 성동구 테스트로 1'}});
 fireEvent.change(screen.getByLabelText('위도'),{target:{value:'37.54'}});
 fireEvent.change(screen.getByLabelText('경도'),{target:{value:'127.04'}});
 fireEvent.change(screen.getByLabelText('추천 이유·확인 가능한 사실'),{target:{value:'확인 가능한 공개 근거'}});
 fireEvent.change(screen.getByLabelText('출처 URL'),{target:{value:'https://example.test/fact'}});
}
test('guest can read the form but cannot submit',()=>{
 mockLoggedIn=false;render(<HolySubmitPage/>);expect(screen.getByRole('button',{name:'검수 요청하기'})).toBeDisabled();expect(screen.getByRole('link',{name:'로그인'})).toHaveAttribute('href','/view/LOGIN_PAGE');expect(api.post).not.toHaveBeenCalled();
});
test('initial map location is never silently submitted as the actual place',()=>{
 render(<HolySubmitPage/>);expect(screen.getByLabelText('위도')).toHaveValue(null);expect(screen.getByLabelText('경도')).toHaveValue(null);
 fireEvent.submit(screen.getByRole('button',{name:'검수 요청하기'}).closest('form')!);expect(api.post).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('주소와 좌표');
});
test('verified manual address and coordinates submit the original API contract',async()=>{
 (api.post as jest.Mock).mockResolvedValue({data:{data:{reviewStatus:'PENDING'}}});render(<HolySubmitPage/>);fill();fireEvent.click(screen.getByRole('button',{name:'검수 요청하기'}));
 await screen.findByRole('heading',{name:'제보가 검수 대기열에 등록됐습니다.'});expect(api.post).toHaveBeenCalledWith('/api/v1/tour/holy/submissions',expect.objectContaining({addr:'서울특별시 성동구 테스트로 1',mapX:127.04,mapY:37.54}));
});
test('duplicate response explains pending or approved source without losing input',async()=>{
 (api.post as jest.Mock).mockRejectedValue({response:{status:409}});render(<HolySubmitPage/>);fill();fireEvent.click(screen.getByRole('button',{name:'검수 요청하기'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('같은 출처 URL');expect(screen.getByLabelText('장소명')).toHaveValue('검증 장소');
});
test('changing the address invalidates old coordinates',()=>{
 render(<HolySubmitPage/>);fill();fireEvent.change(screen.getByLabelText('검색된 기본 주소'),{target:{value:'부산광역시 해운대구'}});expect(screen.getByLabelText('위도')).toHaveValue(null);expect(screen.getByLabelText('경도')).toHaveValue(null);
});
