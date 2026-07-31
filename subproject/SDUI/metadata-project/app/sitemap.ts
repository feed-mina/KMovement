import type { MetadataRoute } from 'next';
import { publicMarketingPaths, siteConfig } from '@/lib/seo/siteConfig';

// 시·도 페이지는 허브보다 낮은 우선순위로 둔다.
function priorityOf(path: string) {
    if (path === '/') return 1;
    if (path.startsWith('/travel/food/') || path.startsWith('/travel/kpop/')) return 0.7;
    return 0.8;
}

export default function sitemap(): MetadataRoute.Sitemap {
    return publicMarketingPaths.map((path) => ({
        url: new URL(path, siteConfig.url).toString(),
        changeFrequency: path === '/' ? 'weekly' : 'monthly',
        priority: priorityOf(path),
    }));
}
