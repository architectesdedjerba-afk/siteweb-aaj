/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Desktop-only magnetic cursor. Two layered elements:
 *  - Outer ring (slow follow, expands on link hover)
 *  - Inner dot (instant follow, shrinks on link hover)
 *
 * Hidden on touch / coarse-pointer devices. Adds `aaj-cursor-active`
 * class to <html> while mounted so all native cursors get hidden.
 */
export const CustomCursor = () => {
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);

  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const ringX = useSpring(mx, { stiffness: 250, damping: 30, mass: 0.5 });
  const ringY = useSpring(my, { stiffness: 250, damping: 30, mass: 0.5 });
  const dotX = useSpring(mx, { stiffness: 600, damping: 40 });
  const dotY = useSpring(my, { stiffness: 600, damping: 40 });

  useEffect(() => {
    if (reduce) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine) return;
    setEnabled(true);
    document.documentElement.classList.add("aaj-cursor-active");

    const move = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    const over = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const interactive = target.closest(
        "a, button, [role='button'], input, textarea, select, label, [data-cursor='hover']"
      );
      setHovering(Boolean(interactive));
    };

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseover", over, { passive: true });

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      document.documentElement.classList.remove("aaj-cursor-active");
    };
  }, [reduce, mx, my]);

  if (!enabled) return null;

  return (
    <>
      <motion.div
        aria-hidden="true"
        className="fixed top-0 left-0 z-[300] pointer-events-none rounded-full mix-blend-difference"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
          width: hovering ? 64 : 32,
          height: hovering ? 64 : 32,
          border: "1px solid rgba(255,255,255,0.9)",
          transition: "width 0.25s cubic-bezier(0.22,1,0.36,1), height 0.25s cubic-bezier(0.22,1,0.36,1)",
        }}
      />
      <motion.div
        aria-hidden="true"
        className="fixed top-0 left-0 z-[300] pointer-events-none rounded-full bg-white mix-blend-difference"
        style={{
          x: dotX,
          y: dotY,
          translateX: "-50%",
          translateY: "-50%",
          width: hovering ? 6 : 4,
          height: hovering ? 6 : 4,
        }}
      />
    </>
  );
};
