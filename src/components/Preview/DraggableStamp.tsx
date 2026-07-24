import React, { useState, useRef, useEffect } from 'react';
import type { StampPlacement } from '../../types';

interface DraggableStampProps {
  stampUrl: string;
  placement: StampPlacement;
  onChange: (placement: StampPlacement) => void;
  readOnly?: boolean; // If true (e.g. printing or previewing), hide handles and disable interaction
}

function getElementScale(el: HTMLElement | null): number {
  let scale = 1;
  let curr = el;
  while (curr) {
    const style = window.getComputedStyle(curr);
    const transform = style.transform || (style as any).webkitTransform;
    if (transform && transform !== 'none') {
      try {
        if (typeof DOMMatrixReadOnly !== 'undefined') {
          const matrix = new DOMMatrixReadOnly(transform);
          if (matrix.a && !isNaN(matrix.a) && matrix.a > 0) {
            scale *= matrix.a;
          }
        } else {
          const match = String(transform).match(/^matrix\(([^,]+),/);
          if (match && match[1]) {
            const parsed = parseFloat(match[1]);
            if (!isNaN(parsed) && parsed > 0) scale *= parsed;
          }
        }
      } catch {
        const match = String(transform).match(/^matrix\(([^,]+),/);
        if (match && match[1]) {
          const parsed = parseFloat(match[1]);
          if (!isNaN(parsed) && parsed > 0) scale *= parsed;
        }
      }
    }
    curr = curr.parentElement;
  }
  return scale || 1;
}

export const DraggableStamp: React.FC<DraggableStampProps> = ({ stampUrl, placement, onChange, readOnly = false }) => {
  const [localPlacement, setLocalPlacement] = useState<StampPlacement>(placement);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pinch-to-zoom state for mobile
  const touchStartRef = useRef<{
    dist: number;
    startWidth: number;
    startHeight: number;
    startX: number;
    startY: number;
    startPlacementX: number;
    startPlacementY: number;
    scale: number;
  } | null>(null);

  useEffect(() => {
    setLocalPlacement(placement);
  }, [placement]);

  // Pointer drag/resize/rotate handler (mouse + single touch pointer)
  const handlePointerDown = (e: React.PointerEvent, action: 'move' | 'resize-br' | 'rotate') => {
    if (readOnly) return;
    if (e.pointerType === 'touch' && (e.nativeEvent as any).touches?.length > 1) return;

    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startPlacement = { ...localPlacement };
    const scale = getElementScale(containerRef.current);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;

      const newPlacement = { ...startPlacement };

      if (action === 'move') {
        newPlacement.x = Math.round(startPlacement.x + dx);
        newPlacement.y = Math.round(startPlacement.y + dy);
      } else if (action === 'resize-br') {
        const aspect = startPlacement.width / startPlacement.height;
        const newWidth = Math.max(30, Math.min(600, startPlacement.width + dx));
        const newHeight = newWidth / aspect;
        newPlacement.width = Math.round(newWidth);
        newPlacement.height = Math.round(newHeight);
      } else if (action === 'rotate') {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
          const startAngle = Math.atan2(startY - centerY, startX - centerX);
          const deltaRotation = (angle - startAngle) * (180 / Math.PI);
          newPlacement.rotation = Math.round((startPlacement.rotation + deltaRotation) % 360);
        }
      }

      setLocalPlacement(newPlacement);
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      setLocalPlacement((finalPlacement) => {
        onChange(finalPlacement);
        return finalPlacement;
      });
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  // 2-Finger Pinch to Resize & Move Gesture for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (readOnly) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scale = getElementScale(containerRef.current);

      touchStartRef.current = {
        dist,
        startWidth: localPlacement.width,
        startHeight: localPlacement.height,
        startX: (t1.clientX + t2.clientX) / 2,
        startY: (t1.clientY + t2.clientY) / 2,
        startPlacementX: localPlacement.x,
        startPlacementY: localPlacement.y,
        scale,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (readOnly || !touchStartRef.current || e.touches.length !== 2) return;
    e.preventDefault();
    e.stopPropagation();

    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const { dist, startWidth, startHeight, startX, startY, startPlacementX, startPlacementY, scale } = touchStartRef.current;
    if (dist <= 0) return;

    const ratio = newDist / dist;
    const aspect = startWidth / startHeight;

    const newWidth = Math.max(30, Math.min(600, startWidth * ratio));
    const newHeight = newWidth / aspect;

    const currentMidX = (t1.clientX + t2.clientX) / 2;
    const currentMidY = (t1.clientY + t2.clientY) / 2;
    const dx = (currentMidX - startX) / scale;
    const dy = (currentMidY - startY) / scale;

    const updated = {
      ...localPlacement,
      width: Math.round(newWidth),
      height: Math.round(newHeight),
      x: Math.round(startPlacementX + dx),
      y: Math.round(startPlacementY + dy),
    };

    setLocalPlacement(updated);
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current) {
      touchStartRef.current = null;
      onChange(localPlacement);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`draggable-stamp ${readOnly ? 'read-only' : ''}`}
      style={{
        position: 'absolute',
        left: `${localPlacement.x}px`,
        top: `${localPlacement.y}px`,
        width: `${localPlacement.width}px`,
        height: `${localPlacement.height}px`,
        transform: `rotate(${localPlacement.rotation}deg)`,
        transformOrigin: 'center center',
        cursor: readOnly ? 'default' : 'move',
        touchAction: readOnly ? 'auto' : 'none',
        zIndex: 50,
      }}
      onPointerDown={(e) => handlePointerDown(e, 'move')}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <img
        src={stampUrl}
        alt="Cachet"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      {!readOnly && (
        <>
          {/* Border highlight */}
          <div
            className="stamp-border-highlight"
            style={{
              position: 'absolute',
              inset: 0,
              border: '1.5px dashed var(--accent)',
              pointerEvents: 'none',
              opacity: 0.7,
              borderRadius: '4px',
            }}
          />
          {/* Rotate Handle */}
          <div
            className="stamp-handle rotate-handle"
            onPointerDown={(e) => handlePointerDown(e, 'rotate')}
            style={{
              position: 'absolute',
              top: '-24px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '18px',
              height: '18px',
              background: 'var(--accent)',
              borderRadius: '50%',
              cursor: 'crosshair',
              boxShadow: '0 0 0 2px white, 0 2px 4px rgba(0,0,0,0.15)',
              touchAction: 'none',
            }}
          />
          <div
            className="stamp-handle-line"
            style={{
              position: 'absolute',
              top: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '1.5px',
              height: '8px',
              background: 'var(--accent)',
              pointerEvents: 'none',
            }}
          />
          {/* Resize Handle (Bottom Right) */}
          <div
            className="stamp-handle resize-handle"
            onPointerDown={(e) => handlePointerDown(e, 'resize-br')}
            style={{
              position: 'absolute',
              bottom: '-10px',
              right: '-10px',
              width: '20px',
              height: '20px',
              background: 'var(--accent)',
              borderRadius: '50%',
              cursor: 'nwse-resize',
              boxShadow: '0 0 0 2px white, 0 2px 4px rgba(0,0,0,0.15)',
              touchAction: 'none',
            }}
          />
        </>
      )}
    </div>
  );
};
