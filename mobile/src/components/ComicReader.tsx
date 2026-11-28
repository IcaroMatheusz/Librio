import { useEffect, useMemo, useRef, useState } from 'react';
import { type FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlatList as GestureFlatList, type NativeGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { Lucide } from '@react-native-vector-icons/lucide';
import type { ReaderPage } from '../lib/reader';
import type { ChapterDirection } from '../lib/chapterNavigation';
import { useLibraryTheme } from '../design/libraryTheme';
import type { ReadingMode } from './PdfReader';
import { ZoomableComicPage } from './ZoomableComicPage';

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
  const { colors } = useLibraryTheme();
  const vertical = mode === 'vertical';
  const manga = mode === 'manga';
  const list = useRef<FlatList<Item>>(null);
  const leading = manga ? hasNext : hasPrevious;
  const toIndex = (value: number) => Number(leading) + (manga ? pages.length - value : value - 1);
  const startIndex = useRef(toIndex(page));
  const lastCommand = useRef(command);
  const touched = useRef(false);
  const requestedPage = useRef<number | null>(null);
  const [scrollGesture, setScrollGesture] = useState<NativeGesture>();
  const [zoomed, setZoomed] = useState(false);
  const scrollEnabled = useSharedValue(true);
  const zoomOwner = useSharedValue(0);

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
    if (!scrollEnabled.value) return;
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
    setZoomed(false);
    zoomOwner.value = 0;
    scrollEnabled.value = true;
    const index = Number(leading) + (manga ? pages.length - command.page : command.page - 1);
    list.current?.scrollToOffset({ offset: layouts[index].offset, animated: true });
  }, [command, layouts, leading, manga, pages.length, scrollEnabled, zoomOwner]);

  return (
    <GestureFlatList<Item>
      ref={list}
      enabled={scrollEnabled}
      scrollEnabled={!zoomed}
      onGestureUpdate_CAN_CAUSE_INFINITE_RERENDER={setScrollGesture}
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
        if (zoomed) return;
        touched.current = true;
        requestedPage.current = null;
        list.current?.recordInteraction();
      }}
      onMomentumScrollEnd={(event) => {
        if (vertical || zoomed || !scrollEnabled.value) return;
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
            <Pressable accessibilityRole="button" accessibilityLabel={label} style={[s.transition, { backgroundColor: colors.surface }, frame]} onPress={() => onChapter(item.direction)}>
              <Lucide name={before ? 'list-start' : 'list-end'} color={colors.accent} size={27} accessible={false} />
              <Text style={[s.transitionText, { color: colors.text }]}>{label}</Text>
            </Pressable>
          );
        }
        return (
          <ZoomableComicPage image={item.image} number={item.number} {...frame} vertical={vertical} fade={fade}
            onTap={onTap} onZoomChange={setZoomed} zoomed={zoomed} zoomOwner={zoomOwner}
            scrollEnabled={scrollEnabled} scrollGesture={scrollGesture} />
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  canvas: { flex: 1 },
  transition: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 12 },
  transitionText: { fontSize: 15, fontWeight: '800' },
});
