export interface AnalyticsEventMap {
    page_view: { page_path: string; page_title: string; screen_name: string };
    itinerary_start: { entry_point: string };
    preferences_complete: { region: string; purpose: string; duration: string };
    itinerary_generated: { place_count: number; duration: string; source: string };
    itinerary_error: { error_type: string; source: string };
    /** 첫 요청이 끊겨 자동으로 한 번 다시 건 경우. 콜드 스타트 빈도를 보기 위한 것. */
    itinerary_retry: { source: string };
    view_item_list: { item_list_name: string; item_count: number; category: string; region: string };
    select_item: { item_id: string; item_category: string; item_list_name: string };
    save_place: { item_id: string; item_category: string };
    share: { method: string; content_type: string; item_id: string };
    map_open: { map_provider: string; item_id: string };
    login: { method: string };
    sign_up: { method: string };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;
