import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

let slug: string[] = [];
jest.mock('next/navigation', () => ({
    usePathname: () => '/view/' + slug.join('/'),
    useParams: () => ({slug}),
}));
jest.mock('@/context/AuthContext', () => ({useAuth: () => ({user: null})}));

import {MetadataProvider, useMetadata} from '@/components/providers/MetadataProvider';

function Probe() {
    const {refId} = useMetadata();
    return <span data-testid="ref">{String(refId)}</span>;
}
function renderWith(segments: string[]) {
    slug = segments;
    global.fetch = jest.fn().mockResolvedValue({ok: true, json: async () => ({data: []})}) as jest.Mock;
    render(<QueryClientProvider client={new QueryClient()}><MetadataProvider><Probe/></MetadataProvider></QueryClientProvider>);
    return screen.getByTestId('ref').textContent;
}

// Next 16 useParams 는 한글·공백 경로를 인코딩된 채로 준다. refId 는 원래 글자로 풀어서 넘겨야
// 화면이 encodeURIComponent 를 한 번만 적용해 API 가 400 대신 아티스트를 돌려준다.
test('percent-encoded artist slug becomes the original text', () => {
    expect(renderWith(['KPOP_ARTIST_DETAIL', '%EC%95%84%EC%9D%B4%EC%9C%A0(IU)'])).toBe('아이유(IU)');
});
test('space-encoded slug and numeric id', () => {
    expect(renderWith(['KPOP_ARTIST_DETAIL', 'Stray%20Kids'])).toBe('Stray Kids');
});
test('malformed escape is kept as-is', () => {
    expect(renderWith(['KPOP_ARTIST_DETAIL', '100%'])).toBe('100%');
});
