import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {AuthContext} from '@/context/AuthContext';
import ProductImageFinder from '@/components/plugins/kpop/ProductImageFinder';

jest.mock('@/context/AuthContext', () => ({AuthContext: require('react').createContext(undefined)}));
jest.mock('next/link', () => ({__esModule: true, default: ({children, ...props}: any) => <a {...props}>{children}</a>}));
jest.mock('@/components/plugins/kpop/KpopProducts', () => ({normalizeCandidate: (x: any) => x, ProductCard: ({candidate}: any) => <p>{candidate.name}</p>}));
jest.mock('@/lib/kpop/productImage', () => ({...jest.requireActual('@/lib/kpop/productImage'), cropProductImage: jest.fn(async () => new Blob(['cropped'], {type: 'image/jpeg'}))}));
const reply = (data: any, status = 200) => Promise.resolve({ok: status < 400, status, json: async () => ({data})});
function view(loggedIn = true, mode: 'upload' | 'url' = 'upload') {
    return render(<AuthContext.Provider value={{isLoggedIn: loggedIn, isLoading: false, user: {userSqno: 42}} as any}><ProductImageFinder mode={mode}/></AuthContext.Provider>);
}
function choose() {fireEvent.change(screen.getByLabelText('사진 올리기'), {target: {files: [new File(['image'], 'item.jpg', {type: 'image/jpeg'})]}});}
function consent() {fireEvent.click(screen.getByRole('checkbox'));}
beforeEach(() => {
    global.fetch = jest.fn(); URL.createObjectURL = jest.fn(() => 'blob:product'); URL.revokeObjectURL = jest.fn();
    Object.defineProperty(crypto, 'randomUUID', {configurable: true, value: () => 'request-1'});
});
test('guest can preview but cannot submit, and login returns to products', async () => {
    view(false); choose(); consent();
    expect(screen.getByRole('button', {name: '선택한 아이템 후보 찾기'})).toBeDisabled();
    expect(screen.getByRole('link', {name: '로그인하고 돌아오기'})).toHaveAttribute('href', expect.stringContaining('KPOP_PRODUCTS'));
    expect(fetch).not.toHaveBeenCalled();
});
test('rejects unsupported media without retaining a previous preview', () => {
    view(); choose();
    fireEvent.change(screen.getByLabelText('사진 올리기'), {target: {files: [new File(['bad'], 'bad.svg', {type: 'image/svg+xml'})]}});
    expect(screen.getByRole('alert')).toHaveTextContent('10MB 이하');
    expect(screen.queryByAltText('상품 부분을 선택할 사진')).not.toBeInTheDocument();
});
test('uploads a cropped image and category, then distinguishes missing model from no candidates', async () => {
    (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('presign')) return reply({sourceKey: 'kpop-analysis/42/file.jpg', uploadUrl: 'https://upload.example/image', headers: {}});
        if (url.startsWith('https://upload.')) return Promise.resolve({ok: true});
        if (url.endsWith('/analysis-jobs')) return reply({jobId: 7, status: 'QUEUED'});
        return reply({jobId: 7, status: 'SUCCEEDED', result: {availability: 'MODEL_NOT_CONFIGURED', candidates: []}});
    });
    view(); choose(); fireEvent.click(screen.getByRole('button', {name: '가방'})); consent();
    fireEvent.click(screen.getByRole('button', {name: '선택한 아이템 후보 찾기'}));
    expect(await screen.findByText(/사진 비교 모델이 아직 연결되지/)).toBeInTheDocument();
    const call = (fetch as jest.Mock).mock.calls.find(([url]) => url.endsWith('/analysis-jobs'));
    expect(JSON.parse(call[1].body)).toMatchObject({itemCategory: 'bag', consentScope: 'user-owned-image-analysis', consented: true});
    expect(screen.queryByText(/공개할 근거가 충분한 상품 후보가 없어요/)).not.toBeInTheDocument();
});
test('retry reuses the same uploaded source and idempotency key after a submission timeout', async () => {
    let submissions = 0;
    (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('presign')) return reply({sourceKey: 'kpop-analysis/42/file.jpg', uploadUrl: 'https://upload.example/image', headers: {}});
        if (url.startsWith('https://upload.')) return Promise.resolve({ok: true});
        if (url.endsWith('/analysis-jobs')) {submissions++; return submissions === 1 ? Promise.reject(new Error('network')) : reply({jobId: 8, status: 'QUEUED'});}
        return reply({jobId: 8, status: 'SUCCEEDED', result: {availability: 'READY', candidates: []}});
    });
    view(); choose(); consent(); fireEvent.click(screen.getByRole('button', {name: '선택한 아이템 후보 찾기'}));
    await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', {name: '다시 시도', exact: true}));
    await screen.findByText(/공개할 근거가 충분한 상품 후보가 없어요/);
    const calls = (fetch as jest.Mock).mock.calls.filter(([url]) => url.endsWith('/analysis-jobs'));
    expect(calls[0][1].body).toBe(calls[1][1].body);
    expect((fetch as jest.Mock).mock.calls.filter(([url]) => url.includes('presign'))).toHaveLength(1);
});
test('URL access failure offers direct upload instead of an empty result', async () => {
    (fetch as jest.Mock).mockResolvedValue({ok: false, status: 422}); view(true, 'url');
    fireEvent.change(screen.getByLabelText('이미지 또는 공개 게시물 주소'), {target: {value: 'https://example.com/post'}});
    fireEvent.click(screen.getByRole('button', {name: '사진 불러오기'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('사진을 직접 올려');
    expect(screen.queryByText(/공개할 근거가 충분한 상품 후보가 없어요/)).not.toBeInTheDocument();
});
test('older URL response cannot replace a newer address selection', async () => {
    let resolve: (x: any) => void = () => {};
    (fetch as jest.Mock).mockReturnValue(new Promise(r => {resolve = r;})); view(true, 'url');
    const input = screen.getByLabelText('이미지 또는 공개 게시물 주소');
    fireEvent.change(input, {target: {value: 'https://example.com/old'}}); fireEvent.click(screen.getByRole('button', {name: '사진 불러오기'}));
    fireEvent.change(input, {target: {value: 'https://example.com/new'}});
    await act(async () => resolve({ok: true, headers: new Headers({'Content-Type': 'application/json'}), json: async () => ({images: ['https://example.com/old.jpg']})}));
    expect(screen.queryByRole('button', {name: '사진 1 불러오기'})).not.toBeInTheDocument();
});
