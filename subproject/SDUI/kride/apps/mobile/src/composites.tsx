import type React from 'react';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import {
  useOnboardingStore,
  type SduiLeafProps,
  type TravelDuration,
  type TravelPurpose,
} from '@kride/core';
import { CardImageLeaf, CardLabelLeaf, CheckIndicatorLeaf } from './leaves';

/**
 * Mobile composite / interactive leaves (P4, 2nd pass). Faithful RN ports of the
 * web K-Ride composite components, sharing the core onboarding store.
 * Deferred (need a slider/gesture dependency): RANGE_INPUT, DUAL_RANGE_SLIDER.
 */

const LABEL_TO_DURATION: Record<string, TravelDuration> = {
  '당일치기': 'day',
  '1박 2일': 'onenight',
  '2박 3일': 'twonight',
};

export const DurationButtonLeaf: React.FC<SduiLeafProps> = ({ meta, data, onAction }) => {
  const duration = useOnboardingStore((s) => s.duration);
  const setDuration = useOnboardingStore((s) => s.setDuration);
  const label = meta?.labelText || meta?.label_text || data?.label || '';
  const value = LABEL_TO_DURATION[label] || label;
  const selected = duration === value;
  return (
    <Pressable
      onPress={() => {
        // V53 wires these buttons to LINK (navigation), so the store write must
        // happen here or KRIDE_FOCUS later reads no duration at all.
        if (LABEL_TO_DURATION[label]) setDuration(LABEL_TO_DURATION[label]);
        onAction?.(meta, { value });
      }}
      className={`rounded-full border-2 border-kride px-8 py-4 ${selected ? 'bg-kride' : 'bg-transparent'}`}
    >
      <Text className={`text-lg font-bold ${selected ? 'text-white' : 'text-kride'}`}>{String(label)}</Text>
    </Pressable>
  );
};

/** Static stand-in for the web's animated TYPEWRITER_TEXT title. */
export const TypewriterTextLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const text = (typeof data === 'string' && data) || meta?.labelText || meta?.label_text || '';
  if (!text) return null;
  return <Text className="text-2xl font-bold text-white">{String(text)}</Text>;
};

/**
 * KRIDE_NEXT_BTN — mirrors the web KrideNextButton: optional gating through
 * componentProps.checkKey/minCount (unset in V53, so visible by default) and a
 * plain onAction dispatch that lets the LINK action navigate.
 */
export const KrideNextButtonLeaf: React.FC<SduiLeafProps & { formData?: Record<string, unknown> }> = ({
  meta,
  formData,
  onAction,
}) => {
  const props = meta?.componentProps || meta?.component_props || {};
  const checkKey: string = props.checkKey ?? '';
  const minCount: number = props.minCount ?? 1;
  const items = checkKey ? (formData as any)?.[checkKey] : null;
  const visible = !checkKey || (Array.isArray(items) && items.length >= minCount);
  if (!visible) return null;

  let label = String(meta?.labelText || meta?.label_text || '다음');
  if (label.includes('AI') && (label.includes('상담') || label.includes('챗'))) {
    label = '라이와 코스 상담';
  }

  return (
    <Pressable
      accessibilityRole="button"
      className="mt-6 min-h-12 w-full items-center justify-center rounded-xl bg-kride px-4 py-3"
      onPress={() => onAction?.(meta, {})}
    >
      <Text className="text-center font-bold text-white">{label}</Text>
    </Pressable>
  );
};

const PURPOSE_LABELS: Record<TravelPurpose, string> = {
  food: '맛집 탐방', kculture: 'K-컬처', nature: '자연 힐링', history: '역사 문화', shopping: '쇼핑', rest: '휴식',
};
const PURPOSE_EMOJI: Record<string, string> = {
  food: '🍜', kculture: '🎤', nature: '🌿', history: '🏛️', shopping: '🛍️', rest: '🛁',
};

export const PurposeCardLeaf: React.FC<SduiLeafProps> = ({ meta, data, onAction }) => {
  const purposes = useOnboardingStore((s) => s.purposes);
  const togglePurpose = useOnboardingStore((s) => s.togglePurpose);
  const key = (data?.purposeKey || meta?.cssClass || meta?.css_class || '') as TravelPurpose;
  const label = PURPOSE_LABELS[key] || meta?.labelText || meta?.label_text || '';
  const selected = purposes.includes(key);
  return (
    <Pressable
      onPress={() => { togglePurpose(key); onAction?.(meta, { value: key }); }}
      className={`w-full flex-row items-center gap-3 rounded-xl border-2 px-5 py-4 ${selected ? 'border-kride bg-red-900' : 'border-gray-700 bg-gray-900'}`}
    >
      <Text className="text-2xl">{PURPOSE_EMOJI[key] || '📍'}</Text>
      <Text className={`text-base font-medium ${selected ? 'text-white' : 'text-gray-300'}`}>{String(label)}</Text>
    </Pressable>
  );
};

export const SelectionCardLeaf: React.FC<SduiLeafProps> = ({ id, meta, data, onAction }) => {
  const selectedArtists = useOnboardingStore((s) => s.selectedArtists);
  const selectedRegions = useOnboardingStore((s) => s.selectedRegions);
  const toggleArtist = useOnboardingStore((s) => s.toggleArtist);
  const toggleRegion = useOnboardingStore((s) => s.toggleRegion);
  const circle = String(meta?.cssClass || meta?.css_class || '').includes('circle');
  const selected = circle
    ? selectedArtists.some((a) => a.id === data?.id)
    : selectedRegions.some((r) => r.id === data?.id);
  const maxReached = circle ? selectedArtists.length >= 5 : selectedRegions.length >= 5;
  const disabled = maxReached && !selected;
  const onPress = () => {
    if (disabled) return;
    if (circle) toggleArtist(data); else toggleRegion(data);
    onAction?.(meta, data);
  };
  return (
    <Pressable onPress={onPress} disabled={disabled} className={`items-center gap-1 ${disabled ? 'opacity-40' : ''}`}>
      <View className={`h-24 w-24 overflow-hidden ${circle ? 'rounded-full' : 'rounded-lg'}`}>
        <CardImageLeaf id={id} meta={{ ...meta, cssClass: circle ? 'circle' : 'square' }} data={data} />
        <CheckIndicatorLeaf id={id} meta={meta} data={{ ...data, selected }} />
      </View>
      <CardLabelLeaf id={id} meta={meta} data={data} />
    </Pressable>
  );
};

export const RangeTrackLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const minPercent = Number(data?.minPercent ?? meta?.minPercent ?? 0);
  const maxPercent = Number(data?.maxPercent ?? meta?.maxPercent ?? 100);
  return (
    <View className="h-2 w-full rounded-full bg-gray-700">
      <View
        className="absolute h-2 rounded-full bg-kride"
        style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }}
      />
    </View>
  );
};

const numberValue = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Native replacement for the web `<input type="range">` leaf. */
export const RangeInputLeaf: React.FC<SduiLeafProps> = ({ id = '', meta, data, onChange, onAction }) => {
  const minimum = numberValue(meta?.min ?? data?.min, 0);
  const maximum = numberValue(meta?.max ?? data?.max, 100);
  const step = numberValue(meta?.step ?? data?.step, 1);
  const value = Math.min(maximum, Math.max(minimum, numberValue(data?.value ?? meta?.value, minimum)));
  const commit = (next: number) => {
    onChange?.(id, next);
    onAction?.(meta, { value: next });
  };
  return (
    <Slider
      minimumValue={minimum}
      maximumValue={maximum}
      step={step}
      value={value}
      minimumTrackTintColor="#e50914"
      maximumTrackTintColor="#4b5563"
      thumbTintColor="#e50914"
      onSlidingComplete={commit}
    />
  );
};

/**
 * Two coordinated native sliders. It keeps the lower handle at or below the
 * upper handle and emits the same `{ min, max }` payload as the web leaf.
 */
export const DualRangeSliderLeaf: React.FC<SduiLeafProps> = ({ id = '', meta, data, onChange, onAction }) => {
  const setBudget = useOnboardingStore((s) => s.setBudget);
  const minimum = numberValue(meta?.min ?? data?.min, 0);
  const maximum = numberValue(meta?.max ?? data?.max, 100);
  const step = numberValue(meta?.step ?? data?.step, 1);
  const initialMin = Math.min(maximum, Math.max(minimum, numberValue(data?.minValue ?? data?.min ?? meta?.minValue, minimum)));
  const initialMax = Math.max(initialMin, Math.min(maximum, numberValue(data?.maxValue ?? data?.max ?? meta?.maxValue, maximum)));
  const [range, setRange] = useState({ min: initialMin, max: initialMax });
  const commit = (next: { min: number; max: number }) => {
    setRange(next);
    // INTRO5's slider has no action_type, so the store write happens here for
    // KRIDE_FOCUS to read (same reason as DurationButtonLeaf above).
    setBudget(next);
    onChange?.(id, next);
    onAction?.(meta, next);
  };
  return (
    <View className="gap-2">
      <Slider
        minimumValue={minimum}
        maximumValue={range.max}
        step={step}
        value={range.min}
        minimumTrackTintColor="#e50914"
        maximumTrackTintColor="#4b5563"
        thumbTintColor="#e50914"
        onSlidingComplete={(min) => commit({ min, max: range.max })}
      />
      <Slider
        minimumValue={range.min}
        maximumValue={maximum}
        step={step}
        value={range.max}
        minimumTrackTintColor="#e50914"
        maximumTrackTintColor="#4b5563"
        thumbTintColor="#e50914"
        onSlidingComplete={(max) => commit({ min: range.min, max })}
      />
      <View className="flex-row justify-between">
        <Text className="text-sm text-white">{range.min.toLocaleString('ko-KR')}</Text>
        <Text className="text-sm text-white">{range.max.toLocaleString('ko-KR')}</Text>
      </View>
    </View>
  );
};

export const CollapseHeaderLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const text = data?.label || meta?.labelText || meta?.label_text || '';
  return (
    <View className="w-full flex-row items-center justify-between bg-gray-900 px-4 py-3">
      <Text className="font-semibold text-white">{String(text)}</Text>
      <Text className="text-white">▾</Text>
    </View>
  );
};

export const CollapseBodyLeaf: React.FC<SduiLeafProps> = ({ children }) => (
  <View className="gap-2 bg-gray-950 px-4 py-2">{children}</View>
);

const DURATION_TO_DAYS: Record<TravelDuration, number> = { day: 1, onenight: 2, twonight: 3 };
type Place = { name: string; description?: string };
type DayPlan = { morning: { places: Place[] }; afternoon: { places: Place[] } };

export const ItineraryPanelLeaf: React.FC<SduiLeafProps> = ({ data }) => {
  const duration: TravelDuration = data?.duration ?? 'day';
  const itinerary: DayPlan[] = data?.itinerary ?? [];
  const dayCount = DURATION_TO_DAYS[duration];
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <View className="gap-4">
      {Array.from({ length: dayCount }, (_, dayIdx) => {
        const plan: DayPlan = itinerary[dayIdx] ?? { morning: { places: [] }, afternoon: { places: [] } };
        return (
          <View key={dayIdx} className="overflow-hidden rounded-xl border border-gray-800">
            <Text className="bg-gray-900 px-4 py-2 font-bold text-white">{`Day ${dayIdx + 1}`}</Text>
            {(['morning', 'afternoon'] as const).map((slot) => {
              const key = `day${dayIdx}-${slot}`;
              const isOpen = open[key] ?? true;
              const places = plan[slot]?.places ?? [];
              return (
                <View key={key}>
                  <Pressable onPress={() => toggle(key)} className="flex-row items-center justify-between bg-gray-900 px-4 py-3">
                    <Text className="font-semibold text-white">{slot === 'morning' ? '오전' : '오후'}</Text>
                    <Text className="text-white">{isOpen ? '▴' : '▾'}</Text>
                  </Pressable>
                  {isOpen ? (
                    <View className="gap-2 bg-gray-950 px-4 py-2">
                      {places.map((place, i) => (
                        <View key={i} className="flex-row items-start gap-3 py-2">
                          <View className="h-6 w-6 items-center justify-center rounded-full bg-kride">
                            <Text className="text-xs font-bold text-white">{i + 1}</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-medium text-white" numberOfLines={1}>{place.name}</Text>
                            {place.description ? <Text className="text-xs text-gray-400" numberOfLines={1}>{place.description}</Text> : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};
