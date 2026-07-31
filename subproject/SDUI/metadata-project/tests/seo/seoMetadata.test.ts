import sitemap from '@/app/sitemap';
import { serializeJsonLd } from '@/components/seo/JsonLd';
import { foodAreas } from '@/lib/seo/travelContent';

describe('SEO metadata', () => {
    it('publishes the hub and every 시·도 food page in the sitemap', () => {
        const urls = sitemap().map((entry) => new URL(entry.url).pathname);
        expect(urls.slice(0, 3)).toEqual(['/', '/travel/seoul-kpop', '/travel/food']);
        expect(urls).toHaveLength(3 + foodAreas.length);
        foodAreas.forEach((area) => {
            expect(urls).toContain(`/travel/food/${area.slug}`);
        });
    });

    it('drops the retired 서울 맛집 route from the sitemap', () => {
        const urls = sitemap().map((entry) => new URL(entry.url).pathname);
        expect(urls).not.toContain('/travel/seoul-food');
    });

    it('ranks 시·도 pages below the hub', () => {
        const entries = sitemap();
        const hub = entries.find((entry) => entry.url.endsWith('/travel/food'));
        const area = entries.find((entry) => entry.url.endsWith('/travel/food/seoul'));
        expect(hub?.priority).toBe(0.8);
        expect(area?.priority).toBe(0.7);
    });

    it('escapes markup in JSON-LD values', () => {
        expect(serializeJsonLd({ '@context': 'https://schema.org', name: '</script>' })).not.toContain('</script>');
        expect(serializeJsonLd({ '@context': 'https://schema.org', name: '</script>' })).toContain('\\u003c/script>');
    });
});
