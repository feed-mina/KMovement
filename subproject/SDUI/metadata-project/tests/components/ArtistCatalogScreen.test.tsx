import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import ArtistCatalogScreen from '@/components/plugins/kpop/ArtistCatalogScreen';
jest.mock('@/components/plugins/kpop/ArtistRelated',()=>({__esModule:true,default:()=>null}));
let query = '';
const push = jest.fn();
jest.mock('next/navigation', () => ({usePathname: () => '/view/kpop',useRouter: () => ({push}), useSearchParams: () => new URLSearchParams(query)}));
const artist = {id: 9, slug: 'artist-9', nameKo: '검증 아티스트', nameEn: 'Test Artist'};
const pageData = (items = [artist], totalCount = items.length) => ({items, totalCount, page: 1, pageSize: 8, query: ''});
const response = (data: any, status = 200) => Promise.resolve({ok: status === 200, status, json: async () => ({data})} as Response);
beforeEach(() => {query = ''; push.mockReset(); global.fetch = jest.fn();});

test('public cards and eight-item pagination omit F8 actions', async () => {
    (fetch as jest.Mock).mockReturnValue(response(pageData(Array.from({length: 8}, (_, i) => ({...artist, id: i+1, nameKo: `아티스트 ${i+1}`})), 9)));
    render(<ArtistCatalogScreen screenId="KPOP_EXPLORE" refId={null}/>);
    expect(await screen.findAllByRole('article')).toHaveLength(8);
    expect(screen.queryByRole('button', {name: '팔로우'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '다음'}));
    expect(push).toHaveBeenCalledWith('/view/KPOP_EXPLORE?page=2', {scroll:false});
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('pageSize=8'), expect.objectContaining({credentials:'omit', cache:'no-store'}));
});
test('search resets page and detail retains list conditions', async () => {
    query = 'q=old&page=2'; (fetch as jest.Mock).mockReturnValue(response(pageData()));
    render(<ArtistCatalogScreen screenId="KPOP_EXPLORE" refId={null}/>);
    await screen.findByRole('heading',{name:'검증 아티스트'});
    fireEvent.change(screen.getByLabelText('아티스트 이름'), {target:{value:'  새 이름  '}});
    fireEvent.submit(screen.getByRole('search'));
    expect(push).toHaveBeenLastCalledWith('/view/KPOP_EXPLORE?q=%EC%83%88+%EC%9D%B4%EB%A6%84', {scroll:false});
    fireEvent.click(screen.getByRole('button',{name:'상세 보기'}));
    expect(push).toHaveBeenLastCalledWith('/view/KPOP_ARTIST_DETAIL/artist-9?q=old&page=2');
    fireEvent.click(screen.getByRole('button',{name:'초기화'}));
    expect(push).toHaveBeenLastCalledWith('/view/KPOP_EXPLORE', {scroll:false});
});
test.each(['9','artist-9'])('detail accepts %s without saved/event actions', async ref => {
    query = 'q=test&page=2'; (fetch as jest.Mock).mockReturnValue(response(artist));
    render(<ArtistCatalogScreen screenId="KPOP_ARTIST_DETAIL" refId={ref}/>);
    await screen.findByRole('heading',{name:'검증 아티스트'});
    expect(fetch).toHaveBeenCalledWith(`/api/v1/kpop/artists/${ref}?view=profile`,expect.any(Object));
    expect(screen.getByRole('link',{name:'아티스트 목록으로'})).toHaveAttribute('href','/view/KPOP_EXPLORE?q=test&page=2');
    expect(screen.getByRole('button',{name:'내 아티스트로 저장'})).toBeInTheDocument();
});
test('500 is not 404 and retry recovers using the same conditions', async () => {
    const mock = fetch as jest.Mock;
    mock.mockReturnValueOnce(response(null,500)).mockReturnValueOnce(response(artist));
    render(<ArtistCatalogScreen screenId="KPOP_ARTIST_DETAIL" refId="9"/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('아티스트를 불러오지 못했어요');
    expect(screen.queryByText(/아티스트를 찾을 수 없어요/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));
    await screen.findByRole('heading',{name:'검증 아티스트'});
    expect(mock.mock.calls[0][0]).toEqual(mock.mock.calls[1][0]);
});
test('404 renders missing without an invented card', async () => {
    (fetch as jest.Mock).mockReturnValue(response(null,404));
    render(<ArtistCatalogScreen screenId="KPOP_ARTIST_DETAIL" refId="missing"/>);
    await screen.findByText(/아티스트를 찾을 수 없어요/);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
});
test.each([['','아직 공개된'],['q=nothing','조건에 맞는']])('empty state %s is not an error', async (qs, copy) => {
    query=qs; (fetch as jest.Mock).mockReturnValue(response(pageData([])));
    render(<ArtistCatalogScreen screenId="KPOP_EXPLORE" refId={null}/>);
    expect(await screen.findByRole('status')).toHaveTextContent(copy);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('stale responses cannot replace newer search results', async () => {
    let resolveOld: (value: Response) => void = () => {};
    (fetch as jest.Mock).mockReturnValueOnce(new Promise(resolve => {resolveOld=resolve;})).mockReturnValue(response(pageData([{...artist,nameKo:'새 결과'}])));
    const view=render(<ArtistCatalogScreen screenId="KPOP_EXPLORE" refId={null}/>);
    query='q=new';view.rerender(<ArtistCatalogScreen screenId="KPOP_EXPLORE" refId={null}/>);
    await screen.findByText('새 결과');
    await act(async () => resolveOld(await response(pageData([{...artist,nameKo:'옛 결과'}]))));
    expect(screen.queryByText('옛 결과')).not.toBeInTheDocument();
});
test('out of range page offers first page recovery', async () => {
    query='page=9'; (fetch as jest.Mock).mockReturnValue(response(pageData([],10)));
    render(<ArtistCatalogScreen screenId="KPOP_EXPLORE" refId={null}/>);
    await screen.findByText(/이 페이지에 아티스트가 없어요/);
    fireEvent.click(screen.getByRole('button',{name:'첫 페이지로'}));
    expect(push).toHaveBeenCalledWith('/view/KPOP_EXPLORE',{scroll:false});
});
