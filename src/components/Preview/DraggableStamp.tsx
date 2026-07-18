import React, { useState, useRef, useEffect } from 'react';
import type { StampPlacement } from '../../types';

interface DraggableStampProps {
  stampUrl: string;
  placement: StampPlacement;
  onChange: (placement: StampPlacement) => void;
  readOnly?: boolean; // If true (e.g. printing or previewing), hide handles and disable interaction
}

export const DraggableStamp: React.FC<DraggableStampProps> = ({ stampUrl, placement, onChange, readOnly = false }) => {
  const [localPlacement, setLocalPlacement] = useState<StampPlacement>(placement);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync prop changes to local state if it updates from outside
  useEffect(() => {
    setLocalPlacement(placement);
  }, [placement]);

  const handlePointerDown = (e: React.PointerEvent, action: 'move' | 'resize-br' | 'rotate') => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startPlacement = { ...localPlacement };

    // Get the scale factor from the nearest element with transform: scale(...)
    // This is necessary because PreviewPane scales the .invoice-doc element
    let scale = 1;
    let node = containerRef.current?.parentElement;
    while (node) {
      const style = window.getComputedStyle(node);
      if (style.transform && style.transform !== 'none') {
        const matrix = new DOMMatrixReadOnly(style.transform);
        scale *= matrix.a; // 'a' is the scaleX factor in the 2D matrix
      }
      node = node.parentElement;
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;

      let newPlacement = { ...startPlacement };

      if (action === 'move') {
        newPlacement.x = startPlacement.x + dx;
        newPlacement.y = startPlacement.y + dy;
      } else if (action === 'resize-br') {
        // Change width and height while preserving aspect ratio.
        const aspect = startPlacement.width / startPlacement.height;
        const newWidth = Math.max(30, startPlacement.width + dx);
        const newHeight = newWidth / aspect;
        newPlacement.width = newWidth;
        newPlacement.height = newHeight;
      } else if (action === 'rotate') {
        // Calculate rotation based on center of the stamp
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
          const startAngle = Math.atan2(startY - centerY, startX - centerX);
          const deltaRotation = (angle - startAngle) * (180 / Math.PI);
          newPlacement.rotation = (startPlacement.rotation + deltaRotation) % 360;
        }
      }

      setLocalPlacement(newPlacement);
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      // Dispatch final change to parent so it saves to DB
      setLocalPlacement((finalPlacement) => {
        onChange(finalPlacement);
        return finalPlacement;
      });
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
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
        zIndex: 50,
      }}
      onPointerDown={(e) => handlePointerDown(e, 'move')}
    >
      <img
        src={stampUrl}
        alt="Cachet"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none', // Prevents image dragging ghost
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
              border: '1px dashed var(--accent)',
              pointerEvents: 'none',
              opacity: 0.5,
            }}
          />
          {/* Rotate Handle */}
          <div
            className="stamp-handle rotate-handle"
            onPointerDown={(e) => handlePointerDown(e, 'rotate')}
            style={{
              position: 'absolute',
              top: '-20px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '12px',
              height: '12px',
              background: 'var(--accent)',
              borderRadius: '50%',
              cursor: 'crosshair',
              boxShadow: '0 0 0 2px white',
            }}
          />
          {/* Connection line to rotate handle */}
          <div
            className="stamp-handle-line"
            style={{
              position: 'absolute',
              top: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '1px',
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
              bottom: '-6px',
              right: '-6px',
              width: '12px',
              height: '12px',
              background: 'var(--accent)',
              borderRadius: '50%',
              cursor: 'nwse-resize',
              boxShadow: '0 0 0 2px white',
            }}
          />
        </>
      )}
    </div>
  );
};
