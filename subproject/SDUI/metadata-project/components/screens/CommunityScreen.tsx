'use client';

import CommunityPage from "@/components/community/CommunityPage";
import type { ScreenControllerProps } from "./types";

// 커뮤니티 화면 컨트롤러 — 기존 CommunityPage로 위임한다.
export default function CommunityScreen({ screenId, refId }: ScreenControllerProps) {
    return <CommunityPage screenId={screenId} refId={refId} />;
}
