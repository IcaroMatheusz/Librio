import { useState, type PropsWithChildren } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { palette } from './atoms';

export const wallpapers = {
  library: require('../../assets/nightwing_wallpaper.jpg'),
  profile: require('../../assets/daredevil_wallpaper.jpg'),
  volumes: require('../../assets/fullmetal_wallpaper.jpg'),
  auth: require('../../assets/bleach_wallpaper.jpg'),
};

export function WallpaperHero({ source, children, tall = false, focalPoint = 0.66 }: PropsWithChildren<{ source: ImageSourcePropType; tall?: boolean; focalPoint?: number }>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const dimensions = Image.resolveAssetSource?.(source);
  const ratio = dimensions?.height && dimensions.width ? dimensions.height / dimensions.width : 2;
  const coveredHeight = Math.max(size.height, size.width * ratio);
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={[styles.hero, tall && styles.tall]}
      onLayout={({ nativeEvent: { layout: { width, height } } }) => setSize({ width, height })}>
      <Image
        accessible={false}
        source={source}
        resizeMode="cover"
        style={[styles.image, { height: coveredHeight, top: (size.height - coveredHeight) * focalPoint }]}
      />
      <View style={styles.tint} />
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: palette.borderLight, minHeight: 212, justifyContent: 'flex-end', backgroundColor: palette.surface },
  tall: { minHeight: 255 },
  image: { position: 'absolute', width: '100%' },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(16, 13, 26, .27)' },
  content: { padding: 20, gap: 7, backgroundColor: 'rgba(15, 13, 22, .84)' },
});
