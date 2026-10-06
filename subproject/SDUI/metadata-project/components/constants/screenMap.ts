export const SCREEN_MAP: Record<string, string> = {
    "/": "MAIN_PAGE",
    "/MAIN_PAGE": "MAIN_PAGE",
    "/kpop": "KPOP_EXPLORE",
    "/KPOP": "KPOP_EXPLORE",
    "/LOGIN_PAGE": "LOGIN_PAGE",
    "/SET_TIME_PAGE": "SET_TIME_PAGE" ,
    "/TUTORIAL_PAGE" : "TUTORIAL_PAGE",
    "/CONTENT_LIST": "CONTENT_LIST",
    "/CONTENT_WRITE": "CONTENT_WRITE",
    "/CONTENT_DETAIL" : "CONTENT_DETAIL",
    "/CONTENT_MODIFY" : "CONTENT_MODIFY",
    "/COMMUNITY_LIST": "COMMUNITY_LIST",
    "/COMMUNITY_WRITE": "COMMUNITY_WRITE",
    "/COMMUNITY_DETAIL": "COMMUNITY_DETAIL",
    "/COMMUNITY_MODIFY": "COMMUNITY_MODIFY",
    "/MY_PAGE": "MY_PAGE",
    // "/DASHBOARD_PAGE": "DASHBOARD_PAGE",
    "/AI_ENGLISH_CHAT_PAGE": "AI_ENGLISH_CHAT_PAGE",
    "/AI_JAPANESE_CHAT_PAGE": "AI_JAPANESE_CHAT_PAGE",
    "/AI_KOREAN_CHAT_PAGE": "AI_KOREAN_CHAT_PAGE",
    "/MEMBERSHIP_SHOP_PAGE": "MEMBERSHIP_SHOP_PAGE",
    "/GOOGLE_CALLBACK": "GOOGLE_CALLBACK",
    "/ADMIN_DASHBOARD": "ADMIN_DASHBOARD",
    "/THEME_SETTINGS": "THEME_SETTINGS",
};

// 도메인 플러그인이 URL→screenId 매핑을 런타임 주입한다(코어 하드코딩 제거).
// 지연 로드된 라우트가 등록되면 부모의 화면 해석도 다시 계산한다.
let pathsVersion=0;
const pathListeners=new Set<()=>void>();
export const getScreenPathsVersion=()=>pathsVersion;
export function subscribeScreenPaths(listener:()=>void){pathListeners.add(listener);return()=>{pathListeners.delete(listener)}}
export function registerScreenPaths(paths: Record<string, string>): void {
    if(!Object.entries(paths).some(([path,id])=>SCREEN_MAP[path]!==id))return;
    Object.assign(SCREEN_MAP, paths);
    pathsVersion++;
    pathListeners.forEach(listener=>listener());
}

export const DEFAULT_SCREEN_ID = "MAIN_PAGE";
