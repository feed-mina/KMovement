import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  ITINERARY_LOADING_STAGE_INTERVAL_MS,
  ITINERARY_LOADING_STAGES,
  nextItineraryLoadingStage,
} from '@kride/core';

export default function NativeItineraryLoadingPanel() {
  const [stageIndex, setStageIndex] = useState(0);
  const stage = ITINERARY_LOADING_STAGES[stageIndex];

  useEffect(() => {
    const timer = setInterval(() => {
      setStageIndex((current) => nextItineraryLoadingStage(current));
    }, ITINERARY_LOADING_STAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <View
      testID="native-itinerary-loading"
      accessibilityLabel={stage.message}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={styles.container}
    >
      <View style={styles.mascot}>
        <Text style={styles.mascotText}>🧭</Text>
        <ActivityIndicator color="#e50914" size="small" />
      </View>
      <Text style={styles.eyebrow}>K-RIDE AI</Text>
      <Text style={styles.title}>라이가 여행 코스를 그리고 있어요</Text>
      <Text style={styles.message}>{stage.message}</Text>

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.steps}>
        {ITINERARY_LOADING_STAGES.map((item, index) => {
          const active = index === stageIndex;
          return (
            <View key={item.id} style={[styles.step, active && styles.activeStep]}>
              <View style={[styles.stepNumber, active && styles.activeStepNumber]}>
                <Text style={[styles.stepNumberText, active && styles.activeStepNumberText]}>{index + 1}</Text>
              </View>
              <Text numberOfLines={1} style={[styles.stepText, active && styles.activeStepText]}>{item.label}</Text>
            </View>
          );
        })}
      </View>

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.skeletons}>
        {[0.72, 0.9, 0.58].map((width, index) => (
          <View key={index} style={styles.skeletonCard}>
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonLineDim, { width: `${width * 100}%` }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  mascot: {
    alignItems: 'center',
    backgroundColor: '#211014',
    borderColor: '#5b171d',
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 92,
    minWidth: 108,
  },
  mascotText: { fontSize: 38 },
  eyebrow: { color: '#ffb4ba', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 20 },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '800', lineHeight: 29, marginTop: 7, textAlign: 'center' },
  message: { color: '#a1a1aa', fontSize: 14, lineHeight: 21, marginTop: 7, minHeight: 21, textAlign: 'center' },
  steps: { flexDirection: 'row', gap: 7, marginTop: 24, width: '100%' },
  step: {
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 6,
  },
  activeStep: { backgroundColor: '#2a1013', borderColor: '#6b1b21' },
  stepNumber: { alignItems: 'center', backgroundColor: '#27272a', borderRadius: 999, height: 20, justifyContent: 'center', width: 20 },
  activeStepNumber: { backgroundColor: '#e50914' },
  stepNumberText: { color: '#a1a1aa', fontSize: 9, fontWeight: '800' },
  activeStepNumberText: { color: '#ffffff' },
  stepText: { color: '#71717a', flexShrink: 1, fontSize: 9, fontWeight: '700' },
  activeStepText: { color: '#ffffff' },
  skeletons: { gap: 8, marginTop: 18, width: '100%' },
  skeletonCard: { backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: 13, borderWidth: 1, gap: 8, padding: 12 },
  skeletonLine: { backgroundColor: '#3f3f46', borderRadius: 999, height: 8, width: '100%' },
  skeletonLineDim: { backgroundColor: '#27272a' },
});
