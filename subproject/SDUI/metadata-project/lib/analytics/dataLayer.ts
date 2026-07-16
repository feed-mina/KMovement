import { readAnalyticsConsent } from './consent';
import type { AnalyticsEventMap, AnalyticsEventName } from './events';

const FORBIDDEN_PARAMETER = /(email|phone|token|password|message|chat|address|latitude|longitude|user_?name)/i;
const MAX_STRING_LENGTH = 100;

type Primitive = string | number | boolean;

function sanitizeParameters(parameters: Record<string, unknown>) {
    return Object.entries(parameters).reduce<Record<string, Primitive>>((safe, [key, value]) => {
        if (FORBIDDEN_PARAMETER.test(key)) return safe;
        if (typeof value === 'string') safe[key] = value.slice(0, MAX_STRING_LENGTH);
        if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
        if (typeof value === 'boolean') safe[key] = value;
        return safe;
    }, {});
}

export function trackEvent<Name extends AnalyticsEventName>(
    event: Name,
    parameters: AnalyticsEventMap[Name],
) {
    if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_GTM_ID) return false;
    if (readAnalyticsConsent() !== 'granted') return false;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...sanitizeParameters(parameters) });
    return true;
}
