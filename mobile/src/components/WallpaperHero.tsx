import { useState, type PropsWithChildren } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { libraryGradients, libraryInk } from '../design/libraryTheme';

export function WallpaperHero({ source, children, tall = false, compact = false, focalPoint = 0.66 }: PropsWithChildren<{
  source: ImageSourcePropType; tall?: boolean; compact?: boolean; focalPoint?: number;
}>) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const dimensions = Image.resolveAssetSource?.(source);
  const [loadedRatio, setLoadedRatio] = useState(1);
  const ratio = dimensions?.height && dimensions.width ? dimensions.height / dimensions.width : loadedRatio;
  const coveredHeight = Math.max(size.height, size.width * ratio);
  return (
    <Animated.View entering={reduced ? undefined : FadeIn.duration(150)} style={[styles.hero, tall && styles.tall, compact && styles.compact]}
      onLayout={({ nativeEvent: { layout: { width, height } } }) => setSize({ width, height })}>
      <Image
        accessible={false}
        source={source}
        onLoad={({ nativeEvent }) => {
          const image = nativeEvent.source;
          if (image?.width && image.height) setLoadedRatio(image.height / image.width);
        }}
        resizeMode="cover"
        style={[styles.image, { height: coveredHeight, top: (size.height - coveredHeight) * focalPoint }]}
      />
      <View style={[styles.tint, compact && { backgroundImage: libraryGradients.heroShade }]} />
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 14, overflow: 'hidden', minHeight: 212, justifyContent: 'flex-end', backgroundColor: libraryInk.hero },
  tall: { minHeight: 255 },
  compact: { minHeight: 136 },
  image: { position: 'absolute', width: '100%' },
  tint: { ...StyleSheet.absoluteFill, backgroundImage: 'linear-gradient(180deg, rgba(23,26,39,0.04) 0%, rgba(23,26,39,0.38) 42%, rgba(23,26,39,0.96) 100%)' },
  content: { padding: 20, gap: 7 },
});
