import { registerScreen } from "./registry";
import { registerScreenAccess } from "./screenAccess";
import CommunityScreen from "./CommunityScreen";
import ContentListScreen from "./ContentListScreen";
import GoogleCallbackScreen from "./GoogleCallbackScreen";

// 코어 화면 컨트롤러 등록.
// import 시점에 1회 실행되어 레지스트리를 채운다(모듈 평가 = 렌더 이전).
registerScreen({ match: (id) => id.startsWith("COMMUNITY_"), controller: CommunityScreen });
registerScreen({ match: (id) => id === "CONTENT_LIST", controller: ContentListScreen });
registerScreen({ match: (id) => id === "GOOGLE_CALLBACK", controller: GoogleCallbackScreen });

// 코어 접근제어 규칙
const AUTH_SCREENS = [
    "MY_PAGE",
    "CONTENT_LIST",
    "CONTENT_WRITE",
    "CONTENT_DETAIL",
    "CONTENT_MODIFY",
    "USER_LIST",
    "AI_ENGLISH_CHAT_PAGE",
    "AI_JAPANESE_CHAT_PAGE",
    "AI_KOREAN_CHAT_PAGE",
    "ADMIN_DASHBOARD",
    "THEME_SETTINGS",
];
registerScreenAccess((id) => AUTH_SCREENS.includes(id), { requireAuth: true });

const ADMIN_SCREENS = ["ADMIN_DASHBOARD", "USER_LIST", "THEME_SETTINGS"];
registerScreenAccess((id) => ADMIN_SCREENS.includes(id), { requireRole: "ROLE_ADMIN" });

// ── 도메인 플러그인 배선 ──
// 엔진 오픈코어 추출 시: 아래 2줄 + components/plugins/travel 폴더 제거.
import { registerTravelPlugin } from "@/components/plugins/travel/register";
registerTravelPlugin();
