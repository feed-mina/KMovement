import { registerComponent } from '@/components/constants/componentMap';
import { registerScreenPaths } from '@/components/constants/screenMap';
import { KpopArtistCard, KpopEventCard } from './KpopCards';
import { KpopAiResultCard, KpopUploadConsent } from './KpopAnalysis';
import { KpopProductSearch, KpopSavedItemList } from './KpopProducts';

let registered = false;

export function registerKpopPlugin(): void {
    if (registered) return;
    registered = true;

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
}
