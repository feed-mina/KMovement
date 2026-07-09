'use client';

// 범용 SDUI 라우터.
// 도메인 특수 로직은 전혀 알지 못한다 — screenId를 Screen Controller 레지스트리에
// 위임하고, 매칭되는 컨트롤러가 없으면 기본 SduiScreen으로 렌더한다.
import { useMetadata } from "@/components/providers/MetadataProvider";
import { resolveScreenController } from "@/components/screens/registry";
import SduiScreen from "@/components/screens/SduiScreen";
// 코어 컨트롤러 + 도메인 플러그인 등록 (import 부수효과)
import "@/components/screens/bootstrap";

export default function CommonPage() {
    const { screenId, refId } = useMetadata();
    const Controller = resolveScreenController(screenId) ?? SduiScreen;
    return <Controller screenId={screenId} refId={refId} />;
}
