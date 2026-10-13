"use client";
import type { PointerEvent, ReactNode } from "react";
import { motion, useReducedMotion, useSpring } from "framer-motion";

export default function PointerTilt({ children, className }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  const rotateX = useSpring(0, { stiffness: 180, damping: 24 });
  const rotateY = useSpring(0, { stiffness: 180, damping: 24 });

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  const followPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.pointerType === "touch" || !window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(-0.5, Math.min(0.5, (event.clientX - bounds.left) / bounds.width - 0.5));
    const y = Math.max(-0.5, Math.min(0.5, (event.clientY - bounds.top) / bounds.height - 0.5));
    rotateX.set(-y * 16);
    rotateY.set(x * 16);
  };

  return (
    <div className={className} style={{ perspective: 1100 }} onPointerMove={followPointer} onPointerLeave={reset} onPointerCancel={reset}>
      <motion.div className="relative" style={{ rotateX: reduceMotion ? 0 : rotateX, rotateY: reduceMotion ? 0 : rotateY }}>
        {children}
      </motion.div>
    </div>
  );
}
