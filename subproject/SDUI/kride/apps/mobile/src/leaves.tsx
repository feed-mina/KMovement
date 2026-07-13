import { Image, Text, View } from 'react-native';
import type { SduiLeafProps } from '@kride/core';

/**
 * Mobile display leaves (P4, 1st pass) — direct RN ports of the web atoms.
 * Display-only; stateful/interactive leaves (SELECTION_CARD, sliders, COLLAPSE_*,
 * ITINERARY_PANEL) are deferred to a later pass that needs the shared onboarding
 * store and a gesture/slider library.
 */

export const CardImageLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const src = data?.imageUrl || meta?.imageUrl;
  const circle = String(meta?.cssClass || meta?.css_class || '').includes('circle');
  return (
    <View className={`aspect-square w-full overflow-hidden ${circle ? 'rounded-full' : 'rounded-lg'}`}>
      {src ? <Image source={{ uri: src }} className="h-full w-full" resizeMode="cover" /> : null}
    </View>
  );
};

export const CardLabelLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const text = data?.name || meta?.labelText || meta?.label_text || '';
  return <Text className="mt-1 w-full text-center text-sm text-white" numberOfLines={1}>{String(text)}</Text>;
};

export const DurationLabelLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const text = data?.label || meta?.labelText || meta?.label_text || '';
  return <Text className="text-base font-semibold text-white">{String(text)}</Text>;
};

const PURPOSE_EMOJI: Record<string, string> = {
  food: '🍜', kculture: '🎤', nature: '🌿', history: '🏛️', shopping: '🛍️', rest: '🛁',
};

export const PurposeIconLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const key = data?.purposeKey || meta?.cssClass || meta?.css_class || '';
  const emoji = PURPOSE_EMOJI[key] || '📍';
  return <Text className="text-2xl">{emoji}</Text>;
};

export const RouteNodeLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const index = Number(meta?.index ?? data?.index ?? 0);
  const name = data?.name || data?.placeName || data?.place_name || '';
  const desc = data?.description || data?.address || '';
  return (
    <View className="flex-row items-start gap-3 py-2">
      <View className="h-6 w-6 items-center justify-center rounded-full bg-kride">
        <Text className="text-xs font-bold text-white">{index + 1}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-white" numberOfLines={1}>{String(name)}</Text>
        {desc ? <Text className="text-xs text-gray-400" numberOfLines={1}>{String(desc)}</Text> : null}
      </View>
    </View>
  );
};

export const RangeLabelLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const value = Number(data?.value ?? meta?.value ?? 0);
  return <Text className="text-sm font-medium text-white">{`₩${value.toLocaleString('ko-KR')}`}</Text>;
};

export const CheckIndicatorLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const selected = data?.selected ?? meta?.selected ?? false;
  if (!selected) return null;
  return (
    <View className="absolute inset-0 items-center justify-center rounded-lg border-4 border-kride">
      <View className="rounded-full bg-kride p-1">
        <Text className="text-xs font-bold text-white">✓</Text>
      </View>
    </View>
  );
};
