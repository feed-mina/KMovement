import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {isIP} from 'node:net';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_HTML = 1024 * 1024;

export function publicImageUrl(raw: string): URL {
    if (raw.length > 2048) throw new Error('invalid_url');
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
        || isIP(url.hostname) || !url.hostname.includes('.') || /\.(?:local|localhost|internal)$/i.test(url.hostname))
        throw new Error('invalid_url');
    url.hash = '';
    return url;
}

export function publicV4(address: string): boolean {
    if (isIP(address) !== 4) return false;
    const [a, b, c] = address.split('.').map(Number);
    return a > 0 && a < 224 && ![10, 127].includes(a)
        && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254)
        && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || b === 0 || b === 2))
        && !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
        && !(a === 203 && b === 0 && c === 113);
}

/** Resolve once, reject non-public addresses, and pin that exact IP to the TLS request. */
export async function fetchPublicImageSource(raw: string, redirects = 0): Promise<{body: Buffer; type: string; url: string}> {
    const url = publicImageUrl(raw);
    if (redirects > 3) throw new Error('too_many_redirects');
    let dnsTimer: ReturnType<typeof setTimeout> | undefined;
    const addresses = await Promise.race([
        lookup(url.hostname, {all: true, family: 4}),
        new Promise<never>((_, reject) => {dnsTimer = setTimeout(() => reject(new Error('dns_timeout')), 3000);}),
    ]).finally(() => clearTimeout(dnsTimer));
    if (!addresses.length || addresses.some(a => !publicV4(a.address))) throw new Error('private_address');
    return new Promise((resolve, reject) => {
        const req = request(url, {
            method: 'GET', agent: false,
            headers: {'Accept': 'image/jpeg,image/png,image/webp,text/html;q=0.7', 'Accept-Encoding': 'identity', 'User-Agent': 'KRIDE-ProductImage/1.0'},
            // No second DNS lookup, cookies, authorization or user-provided headers.
            lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, 4),
        }, res => {
            const status = res.statusCode || 0;
            if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
                res.destroy(); clearTimeout(timer);
                fetchPublicImageSource(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject);
                return;
            }
            const type = String(res.headers['content-type'] || '').split(';')[0].toLowerCase().trim();
            const max = type === 'text/html' ? MAX_HTML : MAX_BYTES;
            if (status !== 200 || !['image/jpeg', 'image/png', 'image/webp', 'text/html'].includes(type)
                || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')
                || Number(res.headers['content-length'] || 0) > max) {
                res.destroy(); clearTimeout(timer); reject(new Error('unsupported_source')); return;
            }
            const chunks: Buffer[] = []; let size = 0;
            res.on('data', (chunk: Buffer) => {
                size += chunk.length;
                if (size > max) {req.destroy(new Error('source_too_large')); return;}
                chunks.push(chunk);
            });
            res.on('error', reject);
            res.on('end', () => {
                clearTimeout(timer);
                const body = Buffer.concat(chunks);
                if (type !== 'text/html' && !imageSignature(body, type)) {reject(new Error('invalid_image')); return;}
                resolve({body, type, url: url.href});
            });
        });
        const timer = setTimeout(() => req.destroy(new Error('source_timeout')), 12000);
        req.on('error', reject); req.on('close', () => clearTimeout(timer)); req.end();
    });
}

function imageSignature(body: Buffer, type: string): boolean {
    if (type === 'image/jpeg') return body.length > 3 && body[0] === 255 && body[1] === 216 && body[2] === 255;
    if (type === 'image/png') return body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    return body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP';
}

export function pageImageChoices(html: string, base: string): string[] {
    // A bounded, inert extraction. No page scripts, cookies, login or <base> navigation.
    const result = new Set<string>();
    for (const tag of html.match(/<(?:meta|img)\b[^>]{0,8192}>/gi) || []) {
        const attrs: Record<string, string> = {};
        for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))
            attrs[match[1].toLowerCase()] = (match[2] ?? match[3] ?? match[4]).replace(/&amp;/g, '&');
        const raw = /^<img/i.test(tag) ? attrs.src : /^(?:og:image(?::url)?|twitter:image(?::src)?)$/i.test(attrs.property || attrs.name || '') ? attrs.content : '';
        if (!raw) continue;
        try { result.add(publicImageUrl(new URL(raw, base).href).href); } catch { /* Skip unsupported links. */ }
        if (result.size >= 8) break;
    }
    return [...result];
}
