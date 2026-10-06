// jest.setup.js

// ⚠️ 중요: NODE_ENV를 'test'로 설정 (axios baseURL 분기에서 사용)
process.env.NODE_ENV = 'test';

// ⚠️ 중요: TextEncoder/TextDecoder를 가장 먼저 설정 (MSW가 필요로 함)
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import '@testing-library/jest-dom';

// 1. Web Streams API 폴리필 추가 (WritableStream 등)
import { WritableStream, ReadableStream, TransformStream } from 'node:stream/web';

Object.defineProperties(global, {
    WritableStream: { value: WritableStream },
    ReadableStream: { value: ReadableStream },
    TransformStream: { value: TransformStream },
});

// 2. 이전에 추가했던 BroadcastChannel 폴리필
if (typeof global.BroadcastChannel === 'undefined') {
    global.BroadcastChannel = class {
        constructor(name) { this.name = name; }
        postMessage(message) {}
        onmessage = null;
        close() {}
        addEventListener() {}
        removeEventListener() {}
    };
}

// 3. fetch 폴리필
import 'whatwg-fetch';

if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
    Element.prototype.scrollTo = jest.fn();
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = jest.fn();
}

// window.alert 모킹 (axios.tsx에서 사용)
global.alert = jest.fn();

// window.location 완전 모킹 (MSW URL 파싱 및 리다이렉트 테스트에 필요)
if (typeof window !== 'undefined') {
delete window.location;
const locationData = {
    href: 'http://localhost/',
    origin: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
};
window.location = {
    ...locationData,
    replace: jest.fn(),
    assign: jest.fn(),
    reload: jest.fn(),
};

// href setter를 오버라이드하여 리다이렉트를 모킹
Object.defineProperty(window.location, 'href', {
    writable: true,
    value: locationData.href,
});

}

// 4. Next.js useRouter 모킹 (AuthProvider, MetadataProvider에서 사용)
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        prefetch: jest.fn(),
        back: jest.fn(),
        pathname: '/',
        query: {},
        asPath: '/',
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({ slug: ['MAIN_PAGE'], screenId: 'MAIN_PAGE' }),
}));

// 5. MSW 서버 설정은 각 테스트 파일에서 직접 import하여 사용
// (jest.setup.js에서 import 시 TextEncoder 순서 문제 발생)