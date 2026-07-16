import type { MetadataRoute } from 'next';
import { publicMarketingPaths, siteConfig } from '@/lib/seo/siteConfig';

export default function sitemap(): MetadataRoute.Sitemap {
    return publicMarketingPaths.map((path, index) => ({
        url: new URL(path, siteConfig.url).toString(),
        changeFrequency: index === 0 ? 'weekly' : 'monthly',
        priority: index === 0 ? 1 : 0.8,
    }));
}
