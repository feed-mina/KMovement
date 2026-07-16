export function countItineraryPlaces(value: unknown): number {
    if (!value || typeof value !== 'object') return 0;
    const data = value as Record<string, unknown>;
    const itineraryValue = data.itinerary;
    const itinerary = Array.isArray(itineraryValue)
        ? itineraryValue
        : itineraryValue && typeof itineraryValue === 'object' && Array.isArray((itineraryValue as Record<string, unknown>).days)
            ? (itineraryValue as Record<string, unknown>).days as unknown[]
            : Array.isArray(data.days)
                ? data.days
                : [];
    const itineraryPlaces = itinerary.reduce((count, day) => {
        if (!day || typeof day !== 'object') return count;
        const record = day as Record<string, unknown>;
        const directPlaces = Array.isArray(record.places) ? record.places.length : Array.isArray(record.items) ? record.items.length : 0;
        const slotPlaces = ['morning', 'afternoon', 'evening'].reduce((slotCount, slot) => {
            const value = record[slot];
            if (Array.isArray(value)) return slotCount + value.length;
            if (value && typeof value === 'object') {
                const slotRecord = value as Record<string, unknown>;
                if (Array.isArray(slotRecord.places)) return slotCount + slotRecord.places.length;
                if (Array.isArray(slotRecord.items)) return slotCount + slotRecord.items.length;
            }
            return slotCount;
        }, 0);
        return count + directPlaces + slotPlaces;
    }, 0);
    const markers = data.mapData && typeof data.mapData === 'object'
        ? (data.mapData as Record<string, unknown>).markers
        : data.markers;
    return Math.max(itineraryPlaces, Array.isArray(markers) ? markers.length : 0);
}
