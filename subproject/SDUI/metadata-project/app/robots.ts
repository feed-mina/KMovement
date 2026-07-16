import type { MetadataRoute } from 'next';
import { isSearchIndexingEnabled, siteConfig } from '@/lib/seo/siteConfig';

export default function robots(): MetadataRoute.Robots {
    const indexable = isSearchIndexingEnabled();
    return {
        rules: indexable
            ? { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/partner/', '/jobs/', '/holy/'] }
            : { userAgent: '*', disallow: '/' },
        sitemap: indexable ? `${siteConfig.url}/sitemap.xml` : undefined,
        host: indexable ? siteConfig.url : undefined,
    };
}
