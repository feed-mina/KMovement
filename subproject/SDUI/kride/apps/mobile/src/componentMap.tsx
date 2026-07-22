import type React from 'react';
import { StyleSheet } from 'react-native';
import type { ComponentRegistry, SduiLeafProps } from '@kride/core';
import KrideMap from './components/KrideMap';
import { ActionButtonLeaf, EmailSelectLeaf, InputLeaf, PasswordLeaf } from './formLeaves';
import {
  CardImageLeaf,
  CardLabelLeaf,
  CheckIndicatorLeaf,
  DurationLabelLeaf,
  PurposeIconLeaf,
  RangeLabelLeaf,
  RouteNodeLeaf,
} from './leaves';
import {
  CollapseBodyLeaf,
  CollapseHeaderLeaf,
  DurationButtonLeaf,
  ItineraryPanelLeaf,
  PurposeCardLeaf,
  DualRangeSliderLeaf,
  RangeInputLeaf,
  RangeTrackLeaf,
  SelectionCardLeaf,
} from './composites';

/** MAP_VIEW leaf — leaflet MapView on web becomes react-native-maps here. */
const MapViewLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const source = data ?? meta ?? {};
  const center = source.center ?? source.mapCenter;
  const markers = source.markers ?? source.mapMarkers ?? [];
  return <KrideMap center={center} markers={markers} style={styles.mapLeaf} />;
};

const styles = StyleSheet.create({
  mapLeaf: {
    borderRadius: 16,
    height: 256,
  },
});

/**
 * Mobile-owned registry. Platform-neutral base leaves (GROUP/TEXT/BUTTON) are
 * merged by the engine from `createBaseComponentMap(rnPrimitives)`; this map adds
 * mobile-specific leaves on top. Unmapped component_types render null (safe).
 */
export const mobileComponentMap: ComponentRegistry = {
  MAP_VIEW: MapViewLeaf,
  // P4 P0 form controls used by login/register screens.
  INPUT: InputLeaf,
  PASSWORD: PasswordLeaf,
  EMAIL_SELECT: EmailSelectLeaf,
  LINK_BUTTON: ActionButtonLeaf,
  SNS_BUTTON: ActionButtonLeaf,
  // display atoms (P4, 1st pass)
  CARD_IMAGE: CardImageLeaf,
  CARD_LABEL: CardLabelLeaf,
  CHECK_INDICATOR: CheckIndicatorLeaf,
  DURATION_LABEL: DurationLabelLeaf,
  PURPOSE_ICON: PurposeIconLeaf,
  RANGE_LABEL: RangeLabelLeaf,
  ROUTE_NODE: RouteNodeLeaf,
  // composite / interactive (P4, 2nd pass)
  SELECTION_CARD: SelectionCardLeaf,
  PURPOSE_CARD: PurposeCardLeaf,
  DURATION_BUTTON: DurationButtonLeaf,
  ITINERARY_PANEL: ItineraryPanelLeaf,
  RANGE_TRACK: RangeTrackLeaf,
  RANGE_INPUT: RangeInputLeaf,
  DUAL_RANGE_SLIDER: DualRangeSliderLeaf,
  COLLAPSE_HEADER: CollapseHeaderLeaf,
  COLLAPSE_BODY: CollapseBodyLeaf,
};
