import { useCallback, useRef, useState, type PointerEvent } from "react";
import type { Dispatch, SetStateAction } from "react";

interface PointerPosition {
  x: number;
  y: number;
}

export function usePinchZoom(
  zoom: number,
  setZoom: Dispatch<SetStateAction<number>>,
  minZoom = 0.5,
  maxZoom = 3,
) {
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const initialDistanceRef = useRef(0);
  const initialZoomRef = useRef(zoom);
  const pinchZoomRef = useRef(zoom);
  const didPinchRef = useRef(false);
  const clickResetTimeoutRef = useRef<number | null>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "touch") return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (pointersRef.current.size !== 2) return;
      const [first, second] = Array.from(pointersRef.current.values());
      initialDistanceRef.current = Math.hypot(
        second.x - first.x,
        second.y - first.y,
      );
      initialZoomRef.current = zoom;
      pinchZoomRef.current = zoom;
      didPinchRef.current = false;
      if (clickResetTimeoutRef.current !== null) {
        window.clearTimeout(clickResetTimeoutRef.current);
        clickResetTimeoutRef.current = null;
      }
    },
    [zoom],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!pointersRef.current.has(event.pointerId)) return;
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (pointersRef.current.size !== 2 || initialDistanceRef.current === 0) {
        return;
      }

      const [first, second] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const nextZoom = Math.min(
        maxZoom,
        Math.max(
          minZoom,
          initialZoomRef.current * (distance / initialDistanceRef.current),
        ),
      );
      if (Math.abs(nextZoom - initialZoomRef.current) > 0.02) {
        didPinchRef.current = true;
      }
      pinchZoomRef.current = nextZoom;
      setPreviewScale(nextZoom / initialZoomRef.current);
    },
    [maxZoom, minZoom],
  );

  const handlePointerEnd = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!pointersRef.current.has(event.pointerId)) return;
      pointersRef.current.delete(event.pointerId);

      if (initialDistanceRef.current === 0) return;
      setZoom(pinchZoomRef.current);
      initialDistanceRef.current = 0;
      setPreviewScale(1);

      if (didPinchRef.current) {
        clickResetTimeoutRef.current = window.setTimeout(() => {
          didPinchRef.current = false;
          clickResetTimeoutRef.current = null;
        }, 500);
      }
    },
    [setZoom],
  );

  const consumePinchClick = useCallback(() => {
    if (!didPinchRef.current) return false;
    didPinchRef.current = false;
    if (clickResetTimeoutRef.current !== null) {
      window.clearTimeout(clickResetTimeoutRef.current);
      clickResetTimeoutRef.current = null;
    }
    return true;
  }, []);

  return {
    previewScale,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: handlePointerEnd,
    handlePointerCancel: handlePointerEnd,
    consumePinchClick,
  };
}
