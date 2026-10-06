import {render,screen,fireEvent} from '@testing-library/react';
import ItineraryPanel from '@/components/fields/kride/ItineraryPanel';
import ItineraryCard from '@/components/fields/kride/chat/components/ItineraryCard';
const place={id:'curated:seoul:100291',name:'N서울타워',lat:37.5511225714939,lon:126.987867837993,sourceUrl:'https://culture.seoul.go.kr/culture/culture/cultureSpace/view.do?facCode=100291&menuNo=200025'};
const day={day:1,morning:{places:[]},afternoon:{places:[]},evening:{places:[place]}};
test('evening-only schedules keep the marker identity and show its source',()=>{
 render(<ItineraryPanel id="plan" data={{itinerary:[day],markers:[{...place,lng:place.lon,slot:'evening',day:1}]}}/>);
 fireEvent.click(screen.getByText('저녁'));
 expect(screen.getByText('N서울타워')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'N서울타워 출처 확인'})).toHaveAttribute('href',place.sourceUrl);
});
test('chat itinerary counts evening and exposes a coordinate link with no inert apply control',()=>{
 render(<ItineraryCard itinerary={{days:[day]}}/>);
 expect(screen.getByText('저녁')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'지도 열기'})).toHaveAttribute('href',expect.stringContaining('37.5511225714939,126.987867837993'));
 expect(screen.queryByRole('button',{name:'FOCUS 화면에 적용'})).toBeNull();
});
