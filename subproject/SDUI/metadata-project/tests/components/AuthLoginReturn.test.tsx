import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {AuthProvider, useAuth} from '@/context/AuthContext';
import {rememberLoginReturn, consumeLoginReturn, safeLoginReturn, loginReturnLabel} from '@/lib/kride/loginReturn';

const mockReplace = jest.fn();
const mockGet = jest.fn();
const mockRouter = {replace: mockReplace, push: jest.fn()};
jest.mock('next/navigation', () => ({useRouter: () => mockRouter}));
jest.mock('@/services/axios', () => ({__esModule: true, default: {get: (...args: any[]) => mockGet(...args)}, refreshSession: jest.fn().mockRejectedValue(new Error('guest'))}));
jest.mock('@/lib/firebase', () => ({requestForToken: jest.fn().mockResolvedValue(null), onMessageListener: jest.fn()}));
jest.mock('@/lib/analytics/dataLayer', () => ({trackEvent: jest.fn()}));

beforeEach(() => {jest.clearAllMocks(); sessionStorage.clear(); window.history.replaceState({}, '', '/view/MY_PAGE');});

function SessionStatus() { const auth = useAuth(); return <div>{auth.isLoading ? 'loading' : auth.isLoggedIn ? 'signed in' : 'guest'}</div>; }

test.each(['AI_ENGLISH_CHAT_PAGE', 'AI_JAPANESE_CHAT_PAGE'])('returns to %s only after the real session check succeeds', async screen => {
    rememberLoginReturn('/view/' + screen);
    let resolve: (value: any) => void = () => {};
    mockGet.mockImplementationOnce(() => new Promise(r => {resolve = r;}));
    render(<AuthProvider><div>App</div></AuthProvider>);
    expect(mockReplace).not.toHaveBeenCalled();
    resolve({data: {isLoggedIn: true, role: 'ROLE_USER', userSqno: 3}});
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/view/' + screen));
    expect(mockGet).toHaveBeenCalledWith('/api/auth/me');
    expect(consumeLoginReturn()).toBeNull();
});

test('does not use the hint to bypass login or incomplete registration', async () => {
    rememberLoginReturn('/view/AI_JAPANESE_CHAT_PAGE');
    mockGet.mockResolvedValue({data: {isLoggedIn: false}});
    const guest = render(<AuthProvider><SessionStatus/></AuthProvider>);
    await screen.findByText('guest');
    expect(mockReplace).not.toHaveBeenCalled();
    guest.unmount();
    mockGet.mockResolvedValue({data: {isLoggedIn: true, role: 'ROLE_GUEST'}});
    render(<AuthProvider><div>App</div></AuthProvider>);
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/view/ADDITIONAL_INFO_PAGE'));
    expect(mockReplace).not.toHaveBeenCalled();
});

test.each(['https://example.com', '//example.com/view/CHAT', '/view/../outside', '/view/%2e%2e/outside', '/view/LOGIN_PAGE', '/view/ADDITIONAL_INFO_PAGE', '/view/CHAT\\evil', '/view/CHAT\n'])('rejects unsafe or looping return address %s', value => {
    expect(safeLoginReturn(value)).toBe('/view/MY_PAGE');
});

test('preserves saved category and page while dropping fragments', () => {
    expect(safeLoginReturn('/view/KPOP_SAVED_ITEMS?kind=events&page=2#section')).toBe('/view/KPOP_SAVED_ITEMS?kind=events&page=2');
});

test('expires the hint and clears malformed storage', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    rememberLoginReturn('/view/AI_ENGLISH_CHAT_PAGE');
    now.mockReturnValue(1_600_001);
    expect(consumeLoginReturn()).toBeNull();
    sessionStorage.setItem('kride.login-return', 'bad json');
    expect(consumeLoginReturn()).toBeNull();
    expect(sessionStorage.getItem('kride.login-return')).toBeNull();
    now.mockRestore();
});

// 벤치마킹 H8: 랜딩 홈(H3 배너)으로는 돌아갈 수 있고, 화면 이름은 안내 문구에 쓴다
test('allows only the exact home path outside /view/', () => {
    expect(safeLoginReturn('/')).toBe('/');
    expect(safeLoginReturn('/travel/food')).toBe('/view/MY_PAGE');
    expect(safeLoginReturn('/?x=1')).toBe('/view/MY_PAGE');
});
test.each([['/', '홈'], ['/view/KPOP_EVENTS?scope=mine', '팬 일정'], ['/view/ROUTE_PLANNER', '코스 만들기'], ['/view/KPOP_SAVED_ITEMS', '내 목록'], ['/view/AI_JAPANESE_CHAT_PAGE', '언어 채팅'], ['/view/KPOP_EVENT_DETAIL/12?returnEvents=x', '일정 상세'], ['/view/UNKNOWN_SCREEN', null]])('names %s as %s', (path, label) => {
    expect(loginReturnLabel(path)).toBe(label);
});

test('resumes the selected private video after a confirmed OAuth session',async()=>{
 const path='/travel/video?view=history&page=2&job=1b9f52ba-77c2-4aa9-a1f4-a7fa18529e82';
 rememberLoginReturn(path);mockGet.mockResolvedValue({data:{isLoggedIn:true,role:'ROLE_USER',userSqno:3}});
 render(<AuthProvider><div>App</div></AuthProvider>);
 await waitFor(()=>expect(mockReplace).toHaveBeenCalledWith(path));
});

test('keeps private video return through required additional registration',async()=>{
 const previousPath=window.location.pathname,previousSearch=window.location.search;
 Object.assign(window.location,{pathname:'/travel/video',search:'?view=history&page=2'});
 mockGet.mockResolvedValue({data:{isLoggedIn:true,role:'ROLE_GUEST',userSqno:3}});
 const view=render(<AuthProvider><div>App</div></AuthProvider>);
 await waitFor(()=>expect(mockRouter.push).toHaveBeenCalledWith('/view/ADDITIONAL_INFO_PAGE'));
 expect(consumeLoginReturn()).toBe('/travel/video?view=history&page=2');expect(mockReplace).not.toHaveBeenCalled();
 view.unmount();Object.assign(window.location,{pathname:previousPath,search:previousSearch});
});
