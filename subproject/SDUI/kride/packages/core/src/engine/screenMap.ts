export const SCREEN_IDS = {
  INTRO1: "KRIDE_INTRO1",
  INTRO2: "KRIDE_INTRO2",
  INTRO3: "KRIDE_INTRO3",
  INTRO4: "KRIDE_INTRO4",
  INTRO5: "KRIDE_INTRO5",
  MY_LIST: "KRIDE_MY_LIST",
  FOCUS: "KRIDE_FOCUS",
  KPOP_EXPLORE: "KPOP_EXPLORE",
  KPOP_ARTIST_DETAIL: "KPOP_ARTIST_DETAIL",
  KPOP_EVENTS: "KPOP_EVENTS",
  KPOP_EVENT_DETAIL: "KPOP_EVENT_DETAIL",
  KPOP_AI_FIND: "KPOP_AI_FIND",
  KPOP_AI_RESULT: "KPOP_AI_RESULT",
  KPOP_PRODUCTS: "KPOP_PRODUCTS",
  KPOP_SAVED_ITEMS: "KPOP_SAVED_ITEMS",
} as const;

export type ScreenId = (typeof SCREEN_IDS)[keyof typeof SCREEN_IDS];

export const PATH_TO_SCREEN: Record<string, ScreenId> = {
  "/browse": SCREEN_IDS.INTRO1,
  "/movies": SCREEN_IDS.INTRO2,
  "/latest": SCREEN_IDS.INTRO3,
  "/intro4": SCREEN_IDS.INTRO4,
  "/intro5": SCREEN_IDS.INTRO5,
  "/my-list": SCREEN_IDS.MY_LIST,
  "/focus": SCREEN_IDS.FOCUS,
  // SDUI metadata (V51/V53) emits `/view/INTRO1`-style action_urls whose
  // `/view` prefix routers strip. Without these entries the mobile app pushes
  // `/INTRO1`, fetches the nonexistent screen id INTRO1, and renders blank.
  "/INTRO1": SCREEN_IDS.INTRO1,
  "/INTRO2": SCREEN_IDS.INTRO2,
  "/INTRO3": SCREEN_IDS.INTRO3,
  "/INTRO4": SCREEN_IDS.INTRO4,
  "/INTRO5": SCREEN_IDS.INTRO5,
  "/MY_LIST": SCREEN_IDS.MY_LIST,
  "/FOCUS": SCREEN_IDS.FOCUS,
  "/kpop": SCREEN_IDS.KPOP_EXPLORE,
  "/kpop/artists": SCREEN_IDS.KPOP_ARTIST_DETAIL,
  "/kpop/events": SCREEN_IDS.KPOP_EVENTS,
  "/kpop/event": SCREEN_IDS.KPOP_EVENT_DETAIL,
  "/kpop/ai": SCREEN_IDS.KPOP_AI_FIND,
  "/kpop/ai/result": SCREEN_IDS.KPOP_AI_RESULT,
  "/kpop/products": SCREEN_IDS.KPOP_PRODUCTS,
  "/kpop/saved": SCREEN_IDS.KPOP_SAVED_ITEMS,
};
