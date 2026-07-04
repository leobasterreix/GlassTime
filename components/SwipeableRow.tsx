"use client";

import { useRef, useState } from "react";

const THRESHOLD = 88;
const TAP_SLOP = 6;

export default function SwipeableRow({
  children,
  onTap,
  onSwipeRight,
  onSwipeLeft,
  rightIcon = "✓",
  leftIcon = "🗑",
}: {
  children: React.ReactNode;
  onTap?: () => void;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightIcon?: string;
  leftIcon?: string;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState<"left" | "right" | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const active = useRef(false);
  const axis = useRef<"x" | "y" | null>(null);
  // Miroir synchrone de dragX : évite de dépendre du timing de re-render de
  // React pour lire la position au relâchement (setState seul est asynchrone).
  const dragXRef = useRef(0);

  function setDrag(x: number) {
    dragXRef.current = x;
    setDragX(x);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (removing) return;
    start.current = { x: e.clientX, y: e.clientY };
    active.current = true;
    axis.current = null;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!active.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!axis.current) {
      if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis.current === "x") setDragging(true);
    }
    if (axis.current === "y") return; // laisse défiler la page verticalement
    let next = dx;
    if (next > 0 && !onSwipeRight) next = Math.min(next, 24);
    if (next < 0 && !onSwipeLeft) next = Math.max(next, -24);
    setDrag(next);
  }

  function handlePointerUp() {
    if (!active.current) return;
    active.current = false;
    setDragging(false);
    const wasTap = axis.current !== "x";
    axis.current = null;
    if (wasTap) return;
    const x = dragXRef.current;
    if (x >= THRESHOLD && onSwipeRight) {
      setRemoving("right");
      setTimeout(() => onSwipeRight(), 160);
    } else if (x <= -THRESHOLD && onSwipeLeft) {
      setRemoving("left");
      setTimeout(() => onSwipeLeft(), 160);
    } else {
      setDrag(0);
    }
  }

  function handleClick() {
    // Un clic natif (souris, sans drag détecté) équivaut à un tap.
    if (dragXRef.current === 0) onTap?.();
  }

  return (
    <div className="swipe-row">
      {onSwipeRight && <div className={`swipe-action right${dragX > 0 ? " visible" : ""}`}>{rightIcon}</div>}
      {onSwipeLeft && <div className={`swipe-action left${dragX < 0 ? " visible" : ""}`}>{leftIcon}</div>}
      <div
        className={`swipe-content${removing ? ` swipe-out-${removing}` : ""}`}
        style={
          removing
            ? undefined
            : {
                transform: `translateX(${dragX}px)`,
                transition: dragging ? "none" : "transform 0.25s cubic-bezier(.2,.8,.2,1)",
              }
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        {children}
      </div>
    </div>
  );
}
