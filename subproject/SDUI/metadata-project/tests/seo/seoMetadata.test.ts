import sitemap from '@/app/sitemap';
import { serializeJsonLd } from '@/components/seo/JsonLd';

describe('SEO metadata', () => {
    it('publishes only canonical marketing routes in the sitemap', () => {
        const urls = sitemap().map((entry) => new URL(entry.url).pathname);
        expect(urls).toEqual(['/', '/travel/seoul-kpop', '/travel/seoul-food']);
    });

    it('escapes markup in JSON-LD values', () => {
        expect(serializeJsonLd({ '@context': 'https://schema.org', name: '</script>' })).not.toContain('</script>');
        expect(serializeJsonLd({ '@context': 'https://schema.org', name: '</script>' })).toContain('\\u003c/script>');
    });
});
