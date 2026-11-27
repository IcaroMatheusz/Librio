import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Lucide } from '@react-native-vector-icons/lucide';
import type { ReaderPage } from '../lib/reader';
import type { ChapterDirection } from '../lib/chapterNavigation';
import { palette } from '../config/colors';
import type { ReadingMode } from './PdfReader';

type Props = {
  pages: ReaderPage[];
  page: number;
  command: { page: number } | null;
  mode: ReadingMode;
  fade: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onPage: (page: number) => void;
  onTap: (x: number, width: number) => void;
  onChapter: (direction: ChapterDirection) => void;
};

type Item = { image: ReaderPage; number: number } | { direction: ChapterDirection };

export default function ComicReader(props: Props) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  return (
    <View style={s.canvas} onLayout={({ nativeEvent: { layout: { width, height } } }) =>
      setViewport((previous) => previous.width === width && previous.height === height ? previous : { width, height })
    }>
      {viewport.width > 0 && viewport.height > 0 && (
        <ComicList key={`${props.mode}-${viewport.width}-${viewport.height}`} {...props} {...viewport} />
      )}
    </View>
  );
}

function ComicList({ pages, page, command, mode, fade, hasPrevious, hasNext, onPage, onTap, onChapter, width, height }: Props & { width: number; height: number }) {
  const vertical = mode === 'vertical';
  const manga = mode === 'manga';
  const list = useRef<FlatList<Item>>(null);
  const leading = manga ? hasNext : hasPrevious;
  const toIndex = (value: number) => Number(leading) + (manga ? pages.length - value : value - 1);
  const startIndex = useRef(toIndex(page));
  const lastCommand = useRef(command);
  const touched = useRef(false);
  const requestedPage = useRef<number | null>(null);

  const data = useMemo<Item[]>(() => {
    const items = pages.map((image, index) => ({ image, number: index + 1 }));
    const ordered: Item[] = manga ? items.reverse() : items;
    if (manga ? hasNext : hasPrevious) ordered.unshift({ direction: manga ? 1 : -1 });
    if (manga ? hasPrevious : hasNext) ordered.push({ direction: manga ? -1 : 1 });
    return ordered;
  }, [hasNext, hasPrevious, manga, pages]);

  const callbacks = useRef({ onPage, onChapter, data });
  callbacks.current = { onPage, onChapter, data };
  const imageWidth = vertical ? Math.min(width, 1040) : width;
  const layouts = useMemo(() => {
    let offset = 0;
    return data.map((item, index) => {
      const imageHeight = 'image' in item ? Math.ceil(imageWidth / item.image.aspectRatio) + 3 : height;
      const atChapterEdge = 'image' in item && ((item.number === 1 && hasPrevious) || (item.number === pages.length && hasNext));
      const length = vertical ? Math.max(imageHeight, atChapterEdge ? height : 0) : width;
      const layout = { index, offset, length };
      offset += length;
      return layout;
    });
  }, [data, hasNext, hasPrevious, height, imageWidth, pages.length, vertical, width]);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 68, waitForInteraction: true }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const index = viewableItems[0]?.index;
    const item = index != null ? callbacks.current.data[index] : undefined;
    if (!item) return;
    if ('image' in item) {
      if (requestedPage.current !== null && requestedPage.current !== item.number) return;
      requestedPage.current = null;
      callbacks.current.onPage(item.number);
    } else if (touched.current) callbacks.current.onChapter(item.direction);
  }).current;

  useEffect(() => {
    if (!command || command === lastCommand.current) return;
    lastCommand.current = command;
    touched.current = false;
    requestedPage.current = command.page;
    const index = Number(leading) + (manga ? pages.length - command.page : command.page - 1);
    list.current?.scrollToOffset({ offset: layouts[index].offset, animated: true });
  }, [command, layouts, leading, manga, pages.length]);

  return (
    <FlatList
      ref={list}
      style={s.canvas}
      data={data}
      keyExtractor={(item) => 'image' in item ? item.image.uri : `chapter-${item.direction}`}
      initialScrollIndex={startIndex.current}
      getItemLayout={(_, index) => layouts[index]}
      horizontal={!vertical}
      pagingEnabled={!vertical}
      disableIntervalMomentum={!vertical}
      decelerationRate={vertical ? 'normal' : 'fast'}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      initialNumToRender={3}
      maxToRenderPerBatch={4}
      windowSize={5}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      onScrollBeginDrag={() => {
        touched.current = true;
        requestedPage.current = null;
        list.current?.recordInteraction();
      }}
      onMomentumScrollEnd={(event) => {
        if (vertical) return;
        const index = Math.max(0, Math.min(data.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
        const item = data[index];
        if ('image' in item) {
          if (requestedPage.current !== null && requestedPage.current !== item.number) return;
          requestedPage.current = null;
          onPage(item.number);
        }
        else if (touched.current) onChapter(item.direction);
      }}
      renderItem={({ item, index }) => {
        const frame = { width: imageWidth, height: vertical ? layouts[index].length : height };
        if ('direction' in item) {
          const before = item.direction === -1;
          const label = before ? 'Capítulo anterior' : 'Próximo capítulo';
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={label} style={[s.transition, frame]} onPress={() => onChapter(item.direction)}>
              <Lucide name={before ? 'list-start' : 'list-end'} color={palette.violet} size={27} accessible={false} />
              <Text style={s.transitionText}>{label}</Text>
            </Pressable>
          );
        }
        return (
          <Pressable accessibilityRole="button" accessibilityLabel={`Página ${item.number}. Mostrar controles`}
            onPress={({ nativeEvent }) => onTap(nativeEvent.locationX, imageWidth)}
            style={[s.page, frame, vertical && s.verticalPage]}>
            <ComicImage uri={item.image.uri} fade={fade} />
          </Pressable>
        );
      }}
    />
  );
}

function ComicImage({ uri, fade }: { uri: string; fade: boolean }) {
  const opacity = useSharedValue(fade ? 0 : 1);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => { if (!fade) opacity.value = 1; }, [fade, opacity]);

  return <Animated.Image accessible={false} source={{ uri }} resizeMode="contain" fadeDuration={0}
    onLoadEnd={() => { opacity.value = fade ? withTiming(1, { duration: 180 }) : 1; }}
    style={[s.image, animated]} />;
}

const s = StyleSheet.create({
  canvas: { flex: 1 },
  page: { alignSelf: 'center', backgroundColor: palette.reader },
  verticalPage: { paddingBottom: 3 },
  image: { width: '100%', height: '100%' },
  transition: { alignSelf: 'center', backgroundColor: palette.reader, alignItems: 'center', justifyContent: 'center', gap: 12 },
  transitionText: { color: palette.violetLight, fontSize: 15, fontWeight: '800' },
});
