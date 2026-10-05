import { registerComponent } from '@/components/constants/componentMap';
import { registerScreenPaths } from '@/components/constants/screenMap';
import { registerScreenAccess } from '@/components/screens/screenAccess';
import { KpopArtistCard, KpopEventCard } from './KpopCards';
import { KpopAiResultCard, KpopUploadConsent } from './KpopAnalysis';
import { KpopProductSearch, KpopSavedItemList } from './KpopProducts';
import { registerScreen } from '@/components/screens/registry';
import ArtistCatalogScreen from './ArtistCatalogScreen';
import EventCatalogScreen from './EventCatalogScreen';
import PublicProductCatalogScreen from './PublicProductCatalogScreen';

let registered = false;

export function registerKpopPlugin(): void {
    if (registered) return;
    registered = true;
    registerScreen({match: id => id === 'KPOP_EXPLORE' || id === 'KPOP_ARTIST_DETAIL', controller: ArtistCatalogScreen});
    registerScreen({match: id => id === 'KPOP_EVENTS' || id === 'KPOP_EVENT_DETAIL', controller: EventCatalogScreen});
    registerScreen({match: id => id === 'KPOP_PRODUCTS', controller: PublicProductCatalogScreen});

    registerComponent('ARTIST_CARD', KpopArtistCard);
    registerComponent('EVENT_CARD', KpopEventCard);
    registerComponent('UPLOAD_CONSENT', KpopUploadConsent);
    registerComponent('AI_RESULT_CARD', KpopAiResultCard);
    registerComponent('PRODUCT_SEARCH', KpopProductSearch);
    registerComponent('SAVED_ITEM_LIST', KpopSavedItemList);
    registerScreenPaths({
        '/KPOP_EXPLORE': 'KPOP_EXPLORE',
        '/KPOP_EVENTS': 'KPOP_EVENTS',
        '/KPOP_ARTIST_DETAIL': 'KPOP_ARTIST_DETAIL',
        '/KPOP_EVENT_DETAIL': 'KPOP_EVENT_DETAIL',
        '/KPOP_AI_FIND': 'KPOP_AI_FIND',
        '/KPOP_AI_RESULT': 'KPOP_AI_RESULT',
        '/KPOP_PRODUCTS': 'KPOP_PRODUCTS',
        '/KPOP_SAVED_ITEMS': 'KPOP_SAVED_ITEMS',
    });

    registerScreenAccess(
        (id) => ['KPOP_AI_FIND', 'KPOP_AI_RESULT', 'KPOP_SAVED_ITEMS'].includes(id),
        { requireAuth: true, loginAlert: true }
    );
}
