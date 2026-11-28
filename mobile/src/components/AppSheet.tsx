import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FormScrollView } from './FormScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { LibraryButton, LibraryIconButton, libraryMetrics, libraryType, useLibraryTheme } from '../design/libraryTheme';

export function AppSheet({ title, visible, onClose, onShow, children }: PropsWithChildren<{
  title: string; visible: boolean; onClose: () => void; onShow?: () => void;
}>) {
  const { colors } = useLibraryTheme();
  const wide = useWindowDimensions().width >= 768;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal transparent visible={visible} animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose} onShow={onShow}
      statusBarTranslucent navigationBarTranslucent={Platform.OS !== 'android'} supportedOrientations={['portrait', 'landscape']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={[s.stage, {
        backgroundColor: colors.scrim, justifyContent: wide ? 'center' : 'flex-end',
        paddingTop: insets.top + 12, paddingLeft: insets.left, paddingRight: insets.right,
      }]}>
        <Pressable accessible={false} importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: colors.raised, paddingBottom: wide ? 20 : Math.max(insets.bottom, 8) + 8 }, wide && s.wide]}>
          {!wide && <View style={[s.handle, { backgroundColor: colors.controlBorder }]} />}
          <View style={s.heading}>
            <Text accessibilityRole="header" style={[libraryType.section, s.flex, { color: colors.text }]}>{title}</Text>
            <LibraryIconButton label="Fechar" icon="x" onPress={onClose} />
          </View>
          <FormScrollView style={s.scroll} contentContainerStyle={s.content}>{children}</FormScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type Decision = { label: string; run: () => void };
type Notice = { title: string; detail?: string; decision?: Decision };
const Feedback = createContext<(title: string, detail?: string, decision?: Decision) => void>(() => {});
export function useFeedback() { return useContext(Feedback); }

export function FeedbackProvider({ children }: PropsWithChildren) {
  const { colors } = useLibraryTheme();
  const [queue, setQueue] = useState<Notice[]>([]);
  const show = useCallback((title: string, detail?: string, decision?: Decision) => {
    setQueue(items => [...items, { title, detail, decision }]);
  }, []);
  const notice = queue[0];
  const close = () => setQueue(items => items.slice(1));
  return <Feedback.Provider value={show}>
    {children}
    {notice && <AppSheet title={notice.title} visible onClose={close}>
      {!!notice.detail && <Text style={[libraryType.body, { color: colors.secondary }]}>{notice.detail}</Text>}
      {notice.decision ? <View style={s.actions}>
        <LibraryButton label="Cancelar" variant="secondary" onPress={close} style={s.flex} />
        <LibraryButton label={notice.decision.label} variant="danger" onPress={() => { close(); notice.decision?.run(); }} style={s.flex} />
      </View> : <LibraryButton label="Entendi" onPress={close} />}
    </AppSheet>}
  </Feedback.Provider>;
}

const s = StyleSheet.create({
  stage: { flex: 1 }, flex: { flex: 1 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '100%', alignSelf: 'center', overflow: 'hidden', paddingTop: 10,
    borderTopLeftRadius: libraryMetrics.radius.sheet, borderTopRightRadius: libraryMetrics.radius.sheet },
  wide: { borderRadius: libraryMetrics.radius.sheet },
  handle: { alignSelf: 'center', width: 32, height: 3, borderRadius: 2, marginBottom: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
  scroll: { flexShrink: 1, flexGrow: 0 }, content: { gap: 12, paddingHorizontal: 20, paddingBottom: 6 },
  actions: { flexDirection: 'row', gap: 8 },
});
