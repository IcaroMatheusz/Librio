import type { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useLibraryTheme } from '../design/libraryTheme';

export function LoadingIndicator({ label }: { label: string }) {
  const { colors } = useLibraryTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityLiveRegion="polite" style={s.status}>
      <ActivityIndicator color={colors.accent} />
      <Text style={[s.label, { color: colors.secondary }]}>{label}</Text>
    </View>
  );
}

export function Skeleton({ children }: PropsWithChildren) {
  const reduced = useReducedMotion();
  return <Animated.View accessible={false} entering={reduced ? undefined : FadeIn.duration(150)} style={s.skeleton}>{children}</Animated.View>;
}

export function SkeletonBlock({ width = '100%', height, radius = 8 }: {
  width?: ViewStyle['width']; height: number; radius?: number;
}) {
  const { colors } = useLibraryTheme();
  return <View style={{ width, height, borderRadius: radius, backgroundColor: colors.inset }} />;
}

const s = StyleSheet.create({
  status: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, minHeight: 32 },
  label: { fontSize: 13, flexShrink: 1 },
  skeleton: { gap: 12 },
});
