import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import type { ReaderPage } from '../lib/reader';
import type { ReadingMode } from './PdfReader';

type Props = {
  pages: ReaderPage[];
  page: number;
  command: { page: number } | null;
  mode: ReadingMode;
  onPage: (page: number) => void;
  onTap: (x: number, width: number) => void;
};

export default function ComicReader(props: Props) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  return (
    <View
      style={styles.canvas}
      onLayout={({ nativeEvent: { layout: { width, height } } }) =>
        setViewport((previous) => previous.width === width && previous.height === height ? previous : { width, height })
      }
    >
      {viewport.width > 0 && viewport.height > 0 && (
        <ComicList key={`${props.mode}-${viewport.width}-${viewport.height}`} {...props} {...viewport} />
      )}
    </View>
  );
}

function ComicList({ pages, page, command, mode, onPage, onTap, width, height }: Props & { width: number; height: number }) {
  const vertical = mode === 'vertical';
  const manga = mode === 'manga';
  const list = useRef<FlatList<ReaderPage>>(null);
  const toIndex = (value: number) => manga ? pages.length - value : value - 1;
  const startIndex = useRef(toIndex(page));
  const lastCommand = useRef(command);
  const callback = useRef(onPage);
  callback.current = onPage;
  const data = useMemo(() => manga ? [...pages].reverse() : pages, [manga, pages]);
  const imageWidth = vertical ? Math.min(width, 1040) : width;
  const layouts = useMemo(() => {
    let offset = 0;
    return data.map((item, index) => {
      const length = vertical ? Math.ceil(imageWidth / item.aspectRatio) + 3 : width;
      const layout = { index, offset, length };
      offset += length;
      return layout;
    });
  }, [data, imageWidth, vertical, width]);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50, waitForInteraction: true }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const index = viewableItems[0]?.index;
    if (index != null) callback.current(manga ? pages.length - index : index + 1);
  }).current;

  useEffect(() => {
    if (!command || command === lastCommand.current) return;
    lastCommand.current = command;
    const index = manga ? pages.length - command.page : command.page - 1;
    list.current?.scrollToOffset({ offset: layouts[index].offset, animated: true });
  }, [command, layouts, manga, pages.length]);

  return (
    <FlatList
      ref={list}
      style={styles.canvas}
      data={data}
      keyExtractor={(item) => item.uri}
      initialScrollIndex={startIndex.current}
      getItemLayout={(_, index) => layouts[index]}
      horizontal={!vertical}
      pagingEnabled={!vertical}
      decelerationRate={vertical ? 'normal' : 'fast'}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      initialNumToRender={3}
      maxToRenderPerBatch={4}
      windowSize={5}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      onScrollBeginDrag={() => list.current?.recordInteraction()}
      onMomentumScrollEnd={(event) => {
        if (!vertical) {
          const index = Math.max(0, Math.min(pages.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
          onPage(manga ? pages.length - index : index + 1);
        }
      }}
      renderItem={({ item, index }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Página ${manga ? pages.length - index : index + 1}. Mostrar controles`}
          onPress={({ nativeEvent }) => onTap(nativeEvent.locationX, imageWidth)}
          style={[
            styles.page,
            { width: imageWidth, height: vertical ? layouts[index].length : height, paddingBottom: vertical ? 3 : 0 },
          ]}
        >
          <Image
            accessible={false}
            source={{ uri: item.uri }}
            resizeMode="contain"
            style={styles.image}
          />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  page: { alignSelf: 'center', backgroundColor: '#100E16' },
  image: { width: '100%', height: '100%' },
});
