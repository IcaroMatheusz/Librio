import { useCallback, useEffect, useImperativeHandle, useRef, type ComponentPropsWithRef, type ComponentRef } from 'react';
import { Platform, ScrollView, TextInput } from 'react-native';

type ScrollHost = NonNullable<ReturnType<ComponentRef<typeof ScrollView>['getNativeScrollRef']>>;

function focusedBounds(viewport: ScrollHost) {
  if (Platform.OS === 'web') {
    const field = document.activeElement;
    return field instanceof HTMLInputElement && (viewport as unknown as HTMLElement).contains(field)
      ? field.getBoundingClientRect() : null;
  }
  const field = TextInput.State.currentlyFocusedInput();
  return field && viewport.contains(field) ? field.getBoundingClientRect() : null;
}

// Recheck after layout: a password or suggestion keyboard can change height
// even when focus moves without closing the keyboard first.
export function FormScrollView({ ref, onFocus, onLayout, onContentSizeChange, onKeyboardDidShow, ...props }: ComponentPropsWithRef<typeof ScrollView>) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const frame = useRef<number | null>(null);
  useImperativeHandle(ref, () => scroll.current!, []);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  const revealField = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const viewport = scroll.current?.getNativeScrollRef();
      if (!viewport) return;
      const input = focusedBounds(viewport);
      if (!input?.height) return;
      const bounds = viewport.getBoundingClientRect();
      if (!bounds.height) return;
      const margin = 12;
      const below = input.bottom - bounds.bottom + margin;
      const above = input.top - bounds.top - margin;
      const delta = below > 0 ? below : Math.min(0, above);
      if (delta) scroll.current?.scrollTo({ y: Math.max(0, viewport.scrollTop + delta), animated: false });
    });
  }, []);

  return <ScrollView {...props} ref={scroll} keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
    onFocus={event => { onFocus?.(event); revealField(); }}
    onLayout={event => { onLayout?.(event); revealField(); }}
    onContentSizeChange={(width, height) => { onContentSizeChange?.(width, height); revealField(); }}
    onKeyboardDidShow={event => { onKeyboardDidShow?.(event); revealField(); }} />;
}
