export const SCREEN_IDS = {
  INTRO1: "KRIDE_INTRO1",
  INTRO2: "KRIDE_INTRO2",
  INTRO3: "KRIDE_INTRO3",
  INTRO4: "KRIDE_INTRO4",
  INTRO5: "KRIDE_INTRO5",
  MY_LIST: "KRIDE_MY_LIST",
  FOCUS: "KRIDE_FOCUS",
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
};
