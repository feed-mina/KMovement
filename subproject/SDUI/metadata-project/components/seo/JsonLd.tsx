import type { JsonLd as JsonLdValue } from '@/lib/seo/structuredData';

export function serializeJsonLd(data: JsonLdValue | JsonLdValue[]) {
    return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default function JsonLd({ data }: { data: JsonLdValue | JsonLdValue[] }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
        />
    );
}
