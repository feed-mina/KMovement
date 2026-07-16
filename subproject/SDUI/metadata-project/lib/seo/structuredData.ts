import { siteConfig } from './siteConfig';

export type JsonLd = Record<string, unknown>;

export function websiteJsonLd(): JsonLd {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        inLanguage: 'ko-KR',
    };
}

export function webApplicationJsonLd(): JsonLd {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: siteConfig.name,
        url: siteConfig.url,
        applicationCategory: 'TravelApplication',
        operatingSystem: 'Web',
        description: siteConfig.description,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
    };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): JsonLd {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: new URL(item.path, siteConfig.url).toString(),
        })),
    };
}

export function itemListJsonLd(name: string, items: Array<{ name: string; description: string }>): JsonLd {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name,
        numberOfItems: items.length,
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
                '@type': 'TouristAttraction',
                name: item.name,
                description: item.description,
            },
        })),
    };
}
