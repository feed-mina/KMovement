import type React from "react";

// Level 1 — SDUI 기본 Atom
// GROUP/TEXT는 core의 createBaseComponentMap(webPrimitives)가 제공하므로
// 여기서 재정의하지 않는다(중복 제거). BUTTON은 DOM id 속성 유지를 위해
// 웹 전용 override로 남긴다 — core base BUTTON은 id를 렌더링하지 않음.
const ButtonField: React.FC<any> = ({ id, meta, onAction }) => {
  const label = meta?.labelText || meta?.label_text || "";
  const cssClass = meta?.cssClass || meta?.css_class || "";
  return (
    <button
      id={id}
      className={`btn-field ${cssClass}`}
      onClick={() => onAction?.(meta)}
    >
      {label}
    </button>
  ) as React.ReactElement;
};

// Level 2 — K-Ride Atom
import CardImage from "@/components/kride/atoms/CardImage";
import CardLabel from "@/components/kride/atoms/CardLabel";
import CheckIndicator from "@/components/kride/atoms/CheckIndicator";
import RangeInput from "@/components/kride/atoms/RangeInput";
import RangeTrack from "@/components/kride/atoms/RangeTrack";
import RangeLabel from "@/components/kride/atoms/RangeLabel";
import CollapseHeader from "@/components/kride/atoms/CollapseHeader";
import CollapseBody from "@/components/kride/atoms/CollapseBody";
import RouteNode from "@/components/kride/atoms/RouteNode";
import PurposeIcon from "@/components/kride/atoms/PurposeIcon";
import DurationLabel from "@/components/kride/atoms/DurationLabel";

// Level 3 — K-Ride 복합 컴포넌트
import SelectionCard from "@/components/kride/SelectionCard";
import DurationButton from "@/components/kride/DurationButton";
import PurposeCard from "@/components/kride/PurposeCard";
import DualRangeSlider from "@/components/kride/DualRangeSlider";
import MapView from "@/components/kride/MapView";
import ItineraryPanel from "@/components/kride/ItineraryPanel";
import { ArtistCard, EventCard } from "@/components/kride/KpopCards";
import { AiResultCard, UploadConsent } from "@/components/kride/KpopAnalysis";

export const componentMap: Record<string, React.FC<any>> = {
  // GROUP/TEXT는 core base leaf가 병합 제공. 웹 전용 leaf만 여기서 override/추가.
  BUTTON: ButtonField,
  CARD_IMAGE: CardImage,
  CARD_LABEL: CardLabel,
  CHECK_INDICATOR: CheckIndicator,
  RANGE_INPUT: RangeInput,
  RANGE_TRACK: RangeTrack,
  RANGE_LABEL: RangeLabel,
  COLLAPSE_HEADER: CollapseHeader,
  COLLAPSE_BODY: CollapseBody,
  ROUTE_NODE: RouteNode,
  PURPOSE_ICON: PurposeIcon,
  DURATION_LABEL: DurationLabel,
  SELECTION_CARD: SelectionCard,
  DURATION_BUTTON: DurationButton,
  PURPOSE_CARD: PurposeCard,
  DUAL_RANGE_SLIDER: DualRangeSlider,
  MAP_VIEW: MapView,
  ITINERARY_PANEL: ItineraryPanel,
  ARTIST_CARD: ArtistCard,
  EVENT_CARD: EventCard,
  UPLOAD_CONSENT: UploadConsent,
  AI_RESULT_CARD: AiResultCard,
};
