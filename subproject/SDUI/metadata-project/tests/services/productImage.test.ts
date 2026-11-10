import {FULL_CROP, validCrop} from '@/lib/kpop/productImage';
import {fetchPublicImageSource, pageImageChoices, publicImageUrl, publicV4} from '@/lib/kpop/remoteProductImage';
import * as dns from 'node:dns/promises';
import * as https from 'node:https';
import {EventEmitter} from 'node:events';
jest.mock('node:dns/promises', () => ({lookup: jest.fn()}));
jest.mock('node:https', () => ({request: jest.fn()}));

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test.each(['http://example.com/p.jpg', 'https://127.0.0.1/p.jpg', 'https://user:pass@example.com/p.jpg', 'https://example.com:8443/x', 'https://host.local/x', 'https://[::1]/x'])('rejects unsafe source %s', value => {
    expect(() => publicImageUrl(value)).toThrow();
});
test.each(['127.0.0.1', '10.0.0.1', '172.16.1.2', '192.168.1.1', '169.254.169.254', '100.100.100.200', '198.18.0.1', '::ffff:127.0.0.1', '0.0.0.0'])('rejects internal DNS answer %s', value => expect(publicV4(value)).toBe(false));
test('permits a public IPv4 answer and strips URL fragments', () => {
    expect(publicV4('8.8.8.8')).toBe(true);
    expect(publicImageUrl('https://example.com/p.jpg#fragment').href).toBe('https://example.com/p.jpg');
});
test('extracts a bounded set of public image choices without executing page contents', () => {
    const html = '<script>fetch("https://example.com/private")</script><meta property="og:image" content="/a.jpg"><img src="/a.jpg"><img src="https://127.0.0.1/private"><img src="https://cdn.example.com/b.jpg?a=1&amp;b=2">';
    expect(pageImageChoices(html, 'https://example.com/post')).toEqual(['https://example.com/a.jpg', 'https://cdn.example.com/b.jpg?a=1&b=2']);
    expect(pageImageChoices(Array.from({length: 12}, (_, i) => `<img src="/${i}.jpg">`).join(''), 'https://example.com')).toHaveLength(8);
});
test('crop stays inside the original photograph', () => {
    expect(validCrop(FULL_CROP)).toBe(true);
    expect(validCrop({x: 90, y: 0, width: 20, height: 50})).toBe(false);
    expect(validCrop({x: NaN, y: 0, width: 20, height: 50})).toBe(false);
});

test('pins the validated DNS answer into the connection and forwards no private headers', async () => {
    jest.spyOn(dns, 'lookup').mockResolvedValue([{address: '8.8.8.8', family: 4}] as never);
    const request = jest.spyOn(https, 'request').mockImplementation(((url: URL, options: any, callback: any) => {
        expect(url.hostname).toBe('images.example.com');
        expect(options.headers.cookie).toBeUndefined(); expect(options.headers.Authorization).toBeUndefined();
        const lookupResult = jest.fn(); options.lookup(url.hostname, {}, lookupResult);
        expect(lookupResult).toHaveBeenCalledWith(null, '8.8.8.8', 4);
        const req = new EventEmitter() as any;
        req.end = () => {const res = new EventEmitter() as any; res.statusCode = 200; res.headers = {'content-type': 'image/jpeg'}; callback(res); res.emit('data', Buffer.from([255,216,255,0])); res.emit('end');};
        req.destroy = (error: Error) => req.emit('error', error);
        return req;
    }) as any);
    expect((await fetchPublicImageSource('https://images.example.com/photo.jpg')).type).toBe('image/jpeg');
    expect(request).toHaveBeenCalledTimes(1);
});

test('rejects a redirect to an internal address before making a second request', async () => {
    jest.spyOn(dns, 'lookup').mockResolvedValue([{address: '8.8.8.8', family: 4}] as never);
    const request = jest.spyOn(https, 'request').mockImplementation(((_url: URL, _options: any, callback: any) => {
        const req = new EventEmitter() as any;
        req.end = () => {const res = new EventEmitter() as any; res.statusCode = 302; res.headers = {location: 'https://127.0.0.1/private'}; res.destroy = jest.fn(); callback(res);};
        req.destroy = (error: Error) => req.emit('error', error);
        return req;
    }) as any);
    await expect(fetchPublicImageSource('https://images.example.com/photo.jpg')).rejects.toThrow('invalid_url');
    expect(request).toHaveBeenCalledTimes(1);
});
