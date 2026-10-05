import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import RoadRoutePlanner from '@/components/plugins/travel/RoadRoutePlanner';
jest.mock('next/dynamic',()=>()=>function Map({points}:{points:unknown[]}){return <div data-testid="road-map">{JSON.stringify(points)}</div>});
beforeEach(()=>{global.fetch=jest.fn();});
function fill(){render(<RoadRoutePlanner/>);for(const [label,value] of [['출발 위도','37.5'],['출발 경도','127'],['도착 위도','37.52'],['도착 경도','127']])fireEvent.change(screen.getByLabelText(label),{target:{value}});}
test('passes the complete ordered route geometry to the map',async()=>{const points=[{lat:37.5,lon:127},{lat:37.51,lon:127.01},{lat:37.52,lon:127}];(fetch as jest.Mock).mockResolvedValue({ok:true,json:async()=>({path:points,total_distance_km:2})});fill();fireEvent.click(screen.getByRole('button',{name:'길 찾기'}));await waitFor(()=>expect(screen.getByTestId('road-map')).toHaveTextContent(JSON.stringify(points)));expect(fetch).toHaveBeenCalledWith('/api/kride/route/route',expect.objectContaining({method:'POST'}));});
test('shows unsupported coordinates as an error, without an old map',async()=>{(fetch as jest.Mock).mockResolvedValue({ok:false,json:async()=>({detail:'지원 도로에서 2km 이내'})});fill();fireEvent.click(screen.getByRole('button',{name:'길 찾기'}));expect(await screen.findByRole('alert')).toHaveTextContent('2km');expect(screen.queryByTestId('road-map')).toBeNull();});
