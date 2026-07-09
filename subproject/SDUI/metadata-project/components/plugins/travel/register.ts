import { registerScreen } from "@/components/screens/registry";
import { registerScreenAccess } from "@/components/screens/screenAccess";
import { registerFormPersistence } from "@/components/screens/persistence";
import { registerComponent } from "@/components/constants/componentMap";
import { registerScreenPaths } from "@/components/constants/screenMap";
import KrideFocusScreen from "./KrideFocusScreen";
import DurationButton from "@/components/fields/kride/DurationButton";
import SelectionCard from "@/components/fields/kride/SelectionCard";
import PurposeCard from "@/components/fields/kride/PurposeCard";
import DualRangeSlider from "@/components/fields/kride/DualRangeSlider";
import KrideMapView from "@/components/fields/kride/MapView";
import ItineraryPanel from "@/components/fields/kride/ItineraryPanel";
import KrideNextButton from "@/components/fields/kride/KrideNextButton";
import KrideWarningToast from "@/components/fields/kride/KrideWarningToast";
import TypewriterText from "@/components/fields/kride/TypewriterText";
import KrideChatComponent from "@/components/fields/kride/chat/KrideChatComponent";

// 여행(K-RIDE) 도메인 플러그인.
// 엔진 오픈코어 추출 시: bootstrap.ts의 registerTravelPlugin() 호출 1줄 +
// components/plugins/travel 폴더만 제거하면 순수 엔진이 남는다.
let registered = false;

export function registerTravelPlugin(): void {
    if (registered) return;
    registered = true;

    // 여행 전용 컴포넌트 타입 (코어 componentMap에서 이관)
    registerComponent("DURATION_BUTTON", DurationButton);
    registerComponent("SELECTION_CARD", SelectionCard, { needsFormData: true });
    registerComponent("PURPOSE_CARD", PurposeCard, { needsFormData: true });
    registerComponent("DUAL_RANGE_SLIDER", DualRangeSlider, { needsFormData: true });
    registerComponent("MAP_VIEW", KrideMapView);
    registerComponent("ITINERARY_PANEL", ItineraryPanel);
    registerComponent("KRIDE_NEXT_BTN", KrideNextButton, { needsFormData: true });
    registerComponent("KRIDE_WARNING", KrideWarningToast);
    registerComponent("TYPEWRITER_TEXT", TypewriterText);
    registerComponent("KRIDE_CHAT", KrideChatComponent);

    // 여행 URL→screenId 매핑 (코어 screenMap에서 이관)
    registerScreenPaths({
        "/INTRO1": "KRIDE_INTRO1",
        "/INTRO2": "KRIDE_INTRO2",
        "/INTRO3": "KRIDE_INTRO3",
        "/INTRO4": "KRIDE_INTRO4",
        "/INTRO5": "KRIDE_INTRO5",
        "/MY_LIST": "KRIDE_MY_LIST",
        "/FOCUS": "KRIDE_FOCUS",
        "/CHAT": "KRIDE_CHAT",
    });

    // FOCUS 화면 컨트롤러
    registerScreen({ match: (id) => id === "KRIDE_FOCUS", controller: KrideFocusScreen });

    // 접근제어: 로그인 필요 + 리다이렉트 전 alert
    registerScreenAccess(
        (id) => id === "KRIDE_MY_LIST" || id === "KRIDE_CHAT",
        { requireAuth: true, loginAlert: true }
    );

    // 온보딩 멀티스텝 폼 영속화 (기존 kride_form 키 유지)
    registerFormPersistence({
        predicate: (id) => id.startsWith("KRIDE_"),
        storageKey: "kride_form",
    });
}
