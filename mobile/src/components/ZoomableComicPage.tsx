import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GestureDetector, useCompetingGestures, useExclusiveGestures, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture,
  type NativeGesture,
} from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { libraryInk } from '../config/colors';
import type { ReaderPage } from '../lib/reader';

const maximumScale = 4;
const zoomThreshold = 1.03;

type Props = {
  image: ReaderPage; number: number; width: number; height: number; vertical: boolean; fade: boolean; zoomed: boolean;
  zoomOwner: SharedValue<number>; scrollEnabled: SharedValue<boolean>; scrollGesture?: NativeGesture;
  onTap: (x: number, width: number) => void; onZoomChange: (zoomed: boolean) => void;
};

export function ZoomableComicPage({ image, number, width, height, vertical, fade, zoomed, zoomOwner, scrollGesture,
  scrollEnabled, onTap, onZoomChange }: Props) {
  const centerX = width / 2;
  const centerY = height / 2;
  const fitWidth = Math.min(width, height * image.aspectRatio);
  const fitHeight = Math.min(height, width / image.aspectRatio);
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const panEnabled = useSharedValue(false);
  const pinching = useSharedValue(false);
  const baseline = useSharedValue({ scale: 1, x: 0, y: 0 });
  const origin = useSharedValue({ x: 0, y: 0 });
  const opacity = useSharedValue(fade ? 0 : 1);

  useEffect(() => { if (!fade) opacity.value = 1; }, [fade, opacity]);

  function limit(value: number, scaled: number, frame: number) {
    'worklet';
    const bound = Math.max(0, (scaled - frame) / 2);
    return Math.max(-bound, Math.min(bound, value));
  }

  function update(nextScale: number, nextX: number, nextY: number, animate = false) {
    'worklet';
    const constrainedX = limit(nextX, nextScale * fitWidth, width);
    const constrainedY = limit(nextY, nextScale * fitHeight, height);
    scale.value = animate ? withTiming(nextScale, { duration: 170 }) : nextScale;
    x.value = animate ? withTiming(constrainedX, { duration: 170 }) : constrainedX;
    y.value = animate ? withTiming(constrainedY, { duration: 170 }) : constrainedY;
  }

  function lock(locked: boolean) {
    'worklet';
    zoomOwner.value = locked ? number : 0;
    scrollEnabled.value = !locked;
    panEnabled.value = locked;
    scheduleOnRN(onZoomChange, locked);
  }

  useAnimatedReaction(() => zoomOwner.value, (owner, previous) => {
    if (previous === number && owner !== number) {
      panEnabled.value = false;
      update(1, 0, 0);
    }
  });

  const pinch = usePinchGesture({
    simultaneousWith: scrollGesture,
    onBegin: () => { if (zoomOwner.value === 0 || zoomOwner.value === number) scrollEnabled.value = false; },
    onActivate: (event) => {
      if (zoomOwner.value && zoomOwner.value !== number) return;
      pinching.value = true;
      cancelAnimation(scale);
      cancelAnimation(x);
      cancelAnimation(y);
      baseline.value = { scale: scale.value, x: x.value, y: y.value };
      origin.value = { x: event.focalX - centerX, y: event.focalY - centerY };
    },
    onUpdate: (event) => {
      if (!pinching.value) return;
      const start = baseline.value;
      const next = Math.max(1, Math.min(maximumScale, start.scale * event.scale));
      const ratio = next / start.scale;
      update(next, event.focalX - centerX - (origin.value.x - start.x) * ratio,
        event.focalY - centerY - (origin.value.y - start.y) * ratio);
    },
    onFinalize: () => {
      if (!pinching.value) {
        scrollEnabled.value = zoomOwner.value === 0;
        return;
      }
      pinching.value = false;
      const enlarged = scale.value > zoomThreshold;
      if (!enlarged) update(1, 0, 0, true);
      lock(enlarged);
    },
  });

  const pan = usePanGesture({
    enabled: panEnabled,
    maxPointers: 1,
    minDistance: 5,
    onUpdate: ({ changeX, changeY }) => {
      if (!pinching.value) update(scale.value, x.value + changeX, y.value + changeY);
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2, maxDelay: 230, maxDistance: 14,
    onDeactivate: (event) => {
      if (event.canceled || (zoomOwner.value && zoomOwner.value !== number)) return;
      if (zoomOwner.value === number) {
        update(1, 0, 0, true);
        lock(false);
      } else {
        const next = 2.5;
        update(next, (centerX - event.x) * (next - 1), (centerY - event.y) * (next - 1), true);
        lock(true);
      }
    },
  });
  const singleTap = useTapGesture({
    maxDistance: 12,
    onDeactivate: (event) => {
      if (!event.canceled) scheduleOnRN(onTap, zoomOwner.value ? centerX : event.x, width);
    },
  });
  const taps = useExclusiveGestures(doubleTap, singleTap);
  const zoomOrTap = useCompetingGestures(pinch, taps);
  const gesture = useSimultaneousGestures(zoomOrTap, pan);
  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture} touchAction={zoomed ? 'none' : vertical ? 'pan-y' : 'pan-x'}>
      <View accessible accessibilityRole="button" accessibilityLabel={`Página ${number}. Mostrar controles`}
        accessibilityHint="Use pinça ou dois toques para ajustar o zoom"
        accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={() => onTap(centerX, width)}
        style={[s.page, { width, height }]}>
        <Animated.Image accessible={false} source={{ uri: image.uri }} resizeMode="contain" fadeDuration={0}
          onLoadEnd={() => { opacity.value = fade ? withTiming(1, { duration: 180 }) : 1; }} style={[s.image, animated]} />
      </View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  page: { alignSelf: 'center', overflow: 'hidden', backgroundColor: libraryInk.canvas },
  image: { width: '100%', height: '100%' },
});
