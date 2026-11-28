import { useCallback, useEffect, useRef, useState, type ComponentRef, type PropsWithChildren } from 'react';
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormScrollView } from './FormScrollView';
import { useReducedMotion } from 'react-native-reanimated';
import { LibraryButton, LibraryIconButton, libraryMetrics, libraryType, useLibraryTheme, type LibraryIcon } from '../design/libraryTheme';
import { formatBytes } from '../lib/account';
import { removeBook, updateBook, updateBookCover } from '../lib/library';
import { changeLocalCategory, changeLocalCover, localCategory, localTitle, removeLocalSelection, renameLocalCategory, restoreLocalCover } from '../lib/local';
import type { Book, LocalBook } from '../lib/types';
import type { AppUpdate } from '../lib/updates';
import { AppearancePreferences } from './AppearancePreferences';
import { useReaderSettings } from './ReaderSettings';

type LocalSheet = { kind: 'local'; book: LocalBook; cover?: string } | { kind: 'category'; category: string };
export type LibrarySheet = LocalSheet | { kind: 'cloud'; book: Book; cover?: string } | { kind: 'preferences' } | { kind: 'folders' };
type Notice = { title: string; message: string; tone: 'error' | 'success' };
type Confirmation = { title: string; message: string; label: string; action: () => Promise<void> };
type Perform = (action: () => Promise<unknown>) => Promise<void>;

export function useLibraryFeedback() {
  const [queue, setQueue] = useState<Notice[]>([]);
  const notify = useCallback((title: string, message: string, tone: Notice['tone'] = 'error') => {
    Keyboard.dismiss();
    setQueue((previous) => [...previous, { title, message, tone }]);
  }, []);
  const dismissNotice = useCallback(() => setQueue((previous) => previous.slice(1)), []);
  return { notice: queue[0], notify, dismissNotice };
}

type Props = ReturnType<typeof useLibraryFeedback> & {
  sheet: LibrarySheet | null;
  onClose: () => void;
  folders: Map<string, { name: string; count: number }>;
  cover?: string | null;
  update: AppUpdate | null;
  onDismissUpdate: () => void;
  onDownloaded: () => void;
  busy: boolean;
  perform: Perform;
};

export function LibrarySheets({ sheet, onClose, folders, cover, update, onDismissUpdate, onDownloaded, notice, notify, dismissNotice, busy, perform }: Props) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const { colors } = useLibraryTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const reducedMotion = useReducedMotion();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const overlay = notice ?? confirmation;
  const visible = !!(overlay || sheet || update);

  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [sheet, overlay, update]);

  function dismiss() {
    if (notice) dismissNotice();
    else if (confirmation) setConfirmation(null);
    else if (busy) return;
    else if (sheet) onClose();
    else if (update) onDismissUpdate();
  }

  function removeLocal(selection: Parameters<typeof removeLocalSelection>[0], name: string) {
    Keyboard.dismiss();
    setConfirmation({
      title: 'Remover da estante?', label: 'Remover da estante',
      message: `“${name}” sairá da seleção do Librio. Os arquivos originais permanecem no aparelho.`,
      action: async () => {
        await removeLocalSelection(selection);
        if (sheet?.kind !== 'folders') onClose();
      },
    });
  }

  function removeCloud(book: Book) {
    Keyboard.dismiss();
    setConfirmation({
      title: 'Excluir obra da nuvem?', label: 'Excluir da nuvem',
      message: `O arquivo de “${book.title}” será excluído do armazenamento da sua conta.`,
      action: async () => { await removeBook(book); onClose(); },
    });
  }

  const closeLabel = sheet?.kind === 'preferences' && !overlay ? 'Fechar preferências' : 'Fechar';
  const editing = sheet?.kind === 'local' || sheet?.kind === 'cloud';
  const bookCover = editing ? cover ?? sheet.cover : undefined;
  const heading = overlay?.title ?? (sheet ? sheetTitle(sheet) : `Librio ${update?.version ?? ''} disponível`);
  const detail = sheet?.kind === 'local'
    ? [sheet.book.format.toUpperCase(), sheet.book.size > 0 && formatBytes(sheet.book.size), 'No aparelho'].filter(Boolean).join(' · ')
    : sheet?.kind === 'cloud'
      ? [sheet.book.file_type.toUpperCase(), sheet.book.file_size > 0 && formatBytes(sheet.book.file_size), 'Nuvem'].filter(Boolean).join(' · ')
      : undefined;

  return (
    <Modal transparent visible={visible} animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={dismiss}
      statusBarTranslucent navigationBarTranslucent={Platform.OS !== 'android'} supportedOrientations={['portrait', 'landscape']}>
      <View style={[s.root, { backgroundColor: colors.scrim }]}>
        <Pressable accessible={false} importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={dismiss} />
        <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'web' ? undefined : 'padding'}
          style={[s.stage, wide && s.wideStage, { paddingTop: insets.top + 12, paddingLeft: insets.left, paddingRight: insets.right }]}>
          <View accessibilityViewIsModal style={[s.panel, { backgroundColor: colors.raised, borderTopLeftRadius: libraryMetrics.radius.sheet,
            borderTopRightRadius: libraryMetrics.radius.sheet, paddingBottom: wide ? 20 : Math.max(insets.bottom, 8) + 8 },
            wide && { borderRadius: libraryMetrics.radius.sheet }]}>
            {!wide && <View accessible={false} style={[s.handle, { backgroundColor: colors.controlBorder }]} />}
            <View style={s.header}>
              {!overlay && !!bookCover && <Image accessible={false} source={{ uri: bookCover }} resizeMode="cover" style={s.cover} />}
              <View style={s.titleBlock}>
                <Text accessibilityRole="header" accessibilityLiveRegion="polite" numberOfLines={2} style={[s.heading, { color: colors.text }]}>{heading}</Text>
                {!overlay && !!detail && <Text style={[s.detail, { color: colors.muted }]}>{detail}</Text>}
              </View>
              <LibraryIconButton icon="x" label={closeLabel} onPress={dismiss} disabled={busy && !overlay} />
            </View>
            <FormScrollView ref={scroll} keyboardDismissMode="on-drag" style={s.scroll}
              contentContainerStyle={s.content}>
              {overlay && (
                <View style={s.group}>
                  <Text accessibilityLiveRegion="polite" style={[s.message, { color: colors.secondary }]}>{overlay.message}</Text>
                  {notice ? <LibraryButton label="Entendi" icon={notice.tone === 'success' ? 'check' : undefined} onPress={dismissNotice} /> : confirmation && (
                    <View style={s.confirmRow}>
                      <LibraryButton label="Cancelar" variant="secondary" onPress={() => setConfirmation(null)} style={s.confirmAction} />
                      <LibraryButton label={confirmation.label} icon="trash-2" variant="danger" style={s.confirmAction} disabled={busy}
                        onPress={() => { setConfirmation(null); void perform(confirmation.action); }} />
                    </View>
                  )}
                </View>
              )}
              <View style={overlay ? s.hidden : s.group} accessibilityElementsHidden={!!overlay}
                importantForAccessibility={overlay ? 'no-hide-descendants' : 'auto'}>
                {sheet?.kind === 'preferences' && <Preferences notify={notify} />}
                {sheet?.kind === 'folders' && (
                  <>
                    {folders.size === 0 && <Text style={[s.message, { color: colors.secondary }]}>As pastas importadas aparecerão aqui.</Text>}
                    {[...folders].map(([uri, folder]) => (
                      <View key={uri} style={[s.folder, { borderBottomColor: colors.border }]}>
                        <Lucide name="folder" size={20} color={colors.muted} accessible={false} />
                        <View style={s.titleBlock}>
                          <Text style={[s.rowLabel, { color: colors.text }]}>{folder.name}</Text>
                          <Text style={[s.detail, { color: colors.muted }]}>{folder.count} {folder.count === 1 ? 'obra' : 'obras'}</Text>
                        </View>
                        <LibraryIconButton icon="folder-minus" label={`Remover pasta ${folder.name}`} color={colors.danger}
                          disabled={busy} onPress={() => removeLocal({ folder: uri }, folder.name)} />
                      </View>
                    ))}
                  </>
                )}
                {sheet?.kind === 'cloud' && <CloudEditor key={sheet.book.id} book={sheet.book} busy={busy} perform={perform}
                  onClose={onClose} remove={() => removeCloud(sheet.book)} />}
                {(sheet?.kind === 'local' || sheet?.kind === 'category') && <LocalEditor
                  key={sheet.kind === 'local' ? `book:${sheet.book.uri}` : `category:${sheet.category}`}
                  sheet={sheet} busy={busy} perform={perform} onClose={onClose} remove={removeLocal} />}
                {!sheet && !!update && (
                  <>
                    <Text style={[s.message, { color: colors.secondary }]}>Baixe o APK para instalar a nova versão no seu aparelho.</Text>
                    <LibraryButton label="Baixar atualização" icon="download" onPress={() => {
                      void Linking.openURL(update.downloadUrl).then(onDownloaded).catch(() => notify('Download indisponível', 'Confira sua conexão e tente novamente.'));
                    }} />
                    <LibraryButton label="Agora não" variant="quiet" onPress={onDismissUpdate} />
                  </>
                )}
                {busy && (editing || sheet?.kind === 'folders' || sheet?.kind === 'category') && (
                  <ActivityIndicator accessibilityRole="progressbar" accessibilityLabel="Atualizando a estante" color={colors.accent} />
                )}
              </View>
            </FormScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function sheetTitle(sheet: LibrarySheet) {
  switch (sheet.kind) {
    case 'local': return localTitle(sheet.book.name);
    case 'category': return 'Editar categoria';
    case 'cloud': return 'Editar obra';
    case 'folders': return 'Pastas selecionadas';
    case 'preferences': return 'Preferências de leitura';
  }
}

function Preferences({ notify }: Pick<Props, 'notify'>) {
  const { fade, setFade } = useReaderSettings();
  return <AppearancePreferences fade={fade} onFade={value => setFade(value, () => notify('Preferência não salva', 'Tente novamente para salvar sua escolha.'))} />;
}

type EditorProps = { busy: boolean; perform: Perform; onClose: () => void };

function CloudEditor({ book, busy, perform, onClose, remove }: EditorProps & { book: Book; remove: () => void }) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? '');
  return (
    <>
      <Field label="Título" value={title} onChangeText={setTitle} maxLength={200} busy={busy} />
      <Field label="Autor" value={author} onChangeText={setAuthor} maxLength={160} busy={busy} />
      <LibraryButton label="Salvar" icon="check" disabled={busy || !title.trim()} onPress={() => void perform(async () => {
        await updateBook(book.id, title, author); onClose();
      })} />
      <RowGroup>
        <MenuRow label="Alterar capa" icon="image" disabled={busy} onPress={() => void perform(() => updateBookCover(book))} />
        <MenuRow label="Excluir da nuvem" icon="trash-2" danger disabled={busy} onPress={remove} />
      </RowGroup>
    </>
  );
}

function LocalEditor({ sheet, busy, perform, onClose, remove }: EditorProps & {
  sheet: LocalSheet; remove: (selection: Parameters<typeof removeLocalSelection>[0], name: string) => void;
}) {
  const [category, setCategory] = useState(sheet.kind === 'local' ? localCategory(sheet.book) : sheet.category);
  function saveCategory() {
    void perform(async () => {
      if (sheet.kind === 'local') await changeLocalCategory(sheet.book.uri, category);
      else await renameLocalCategory(sheet.category, category);
      onClose();
    });
  }
  return (
    <>
      <Field label={sheet.kind === 'local' ? 'Categoria da obra' : 'Nome da categoria'} accessibilityLabel="Nome da categoria"
        value={category} onChangeText={setCategory} maxLength={100} busy={busy} />
      <LibraryButton label="Salvar categoria" icon="check" disabled={busy || !category.trim()} onPress={saveCategory} />
      <RowGroup>
        {sheet.kind === 'local' && (
          <>
            <MenuRow label="Escolher capa" icon="image" disabled={busy} onPress={() => void perform(async () => {
              await changeLocalCover(sheet.book.uri); onClose();
            })} />
            {!!sheet.book.customCover && <MenuRow label="Restaurar capa automática" icon="rotate-ccw" disabled={busy}
              onPress={() => void perform(async () => { await restoreLocalCover(sheet.book.uri); onClose(); })} />}
          </>
        )}
        <MenuRow label="Remover da estante" icon="book-minus" danger disabled={busy} onPress={() => {
          if (sheet.kind === 'local') remove({ uri: sheet.book.uri }, localTitle(sheet.book.name));
          else remove({ category: sheet.category }, sheet.category);
        }} />
      </RowGroup>
    </>
  );
}

function Field({ label, accessibilityLabel = label, value, onChangeText, maxLength, busy }: {
  label: string; accessibilityLabel?: string; value: string; onChangeText: (value: string) => void; maxLength: number; busy: boolean;
}) {
  const { colors } = useLibraryTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: colors.secondary }]}>{label}</Text>
      <TextInput accessibilityLabel={accessibilityLabel} value={value} onChangeText={onChangeText} maxLength={maxLength} editable={!busy}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={colors.accent}
        style={[s.input, { color: colors.text, backgroundColor: colors.inset, borderColor: focused ? colors.accent : colors.controlBorder }]} />
    </View>
  );
}

function RowGroup({ children }: PropsWithChildren) {
  const { colors } = useLibraryTheme();
  return <View style={[s.rows, { borderTopColor: colors.border }]}>{children}</View>;
}

function MenuRow({ label, icon, danger, disabled, onPress }: {
  label: string; icon: LibraryIcon; danger?: boolean; disabled: boolean; onPress: () => void;
}) {
  const { colors } = useLibraryTheme();
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.inset }, disabled && s.disabled]}>
      <Lucide name={icon} color={danger ? colors.danger : colors.muted} size={19} accessible={false} />
      <Text style={[s.rowLabel, s.grow, { color }]}>{label}</Text>
      <Lucide name="chevron-right" color={colors.muted} size={16} accessible={false} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1, justifyContent: 'flex-end' },
  wideStage: { justifyContent: 'center', alignItems: 'center' },
  panel: { width: '100%', maxWidth: 560, maxHeight: '100%', alignSelf: 'center', paddingTop: 10, overflow: 'hidden' },
  handle: { width: 32, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
  cover: { width: 36, height: 52, borderRadius: 4 },
  titleBlock: { flex: 1, gap: 3 },
  heading: libraryType.section,
  detail: { fontSize: 13, lineHeight: 19 },
  scroll: { flexShrink: 1, flexGrow: 0 },
  content: { paddingHorizontal: 20, paddingTop: 9, paddingBottom: 6 },
  group: { gap: 16 },
  hidden: { display: 'none' },
  message: libraryType.body,
  confirmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  confirmAction: { flexGrow: 1 },
  field: { gap: 7 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: libraryMetrics.radius.control, minHeight: 45, paddingHorizontal: 12, paddingVertical: 9, fontSize: 16 },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 45, paddingVertical: 7, paddingHorizontal: 2 },
  rowLabel: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 5 },
  disabled: { opacity: 0.45 },
  grow: { flex: 1 },
});
