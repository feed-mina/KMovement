import type React from "react";

// Level 1 — SDUI 기본 Atom
const GroupComponent: React.FC<any> = ({ children }) =>
  children as React.ReactElement;

const TextField: React.FC<any> = ({ meta, data }) => {
  const text =
    typeof data === "string"
      ? data
      : data?.[meta?.componentId || meta?.component_id] ??
        meta?.labelText ??
        meta?.label_text ??
        "";
  return (
    <span className={`text-field ${meta?.cssClass || ""}`}>{text}</span>
  ) as React.ReactElement;
};

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

export const componentMap: Record<string, React.FC<any>> = {
  GROUP: GroupComponent,
  TEXT: TextField,
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
};
