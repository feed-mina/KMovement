import sitemap from '@/app/sitemap';
import { serializeJsonLd } from '@/components/seo/JsonLd';
import { foodAreas, kpopAreas } from '@/lib/seo/travelContent';

describe('SEO metadata', () => {
    it('publishes both hubs and every 시·도 page in the sitemap', () => {
        const urls = sitemap().map((entry) => new URL(entry.url).pathname);
        expect(urls[0]).toBe('/');
        expect(urls).toContain('/travel/kpop');
        expect(urls).toContain('/travel/food');
        expect(urls).toHaveLength(3 + foodAreas.length + kpopAreas.length);
        foodAreas.forEach((area) => expect(urls).toContain(`/travel/food/${area.slug}`));
        kpopAreas.forEach((area) => expect(urls).toContain(`/travel/kpop/${area.slug}`));
    });

    it('drops the retired 서울 전용 routes from the sitemap', () => {
        const urls = sitemap().map((entry) => new URL(entry.url).pathname);
        expect(urls).not.toContain('/travel/seoul-food');
        expect(urls).not.toContain('/travel/seoul-kpop');
    });

    it('ranks 시·도 pages below the hubs', () => {
        const entries = sitemap();
        const priorityOf = (path: string) => entries.find((entry) => entry.url.endsWith(path))?.priority;
        expect(priorityOf('/travel/food')).toBe(0.8);
        expect(priorityOf('/travel/kpop')).toBe(0.8);
        expect(priorityOf('/travel/food/seoul')).toBe(0.7);
        expect(priorityOf('/travel/kpop/seoul')).toBe(0.7);
    });

    it('escapes markup in JSON-LD values', () => {
        expect(serializeJsonLd({ '@context': 'https://schema.org', name: '</script>' })).not.toContain('</script>');
        expect(serializeJsonLd({ '@context': 'https://schema.org', name: '</script>' })).toContain('\\u003c/script>');
    });
});
