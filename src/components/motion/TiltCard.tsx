/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { useRef, type ReactNode, type CSSProperties } from "react";

interface TiltProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Maximum tilt in degrees. Default 8°. */
  max?: number;
  /** Adds the `aaj-tilt-glow` cursor-follow halo. */
  glow?: boolean;
}

export const TiltCard = ({ children, className, style, max = 8, glow = true }: TiltProps) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });
  const rotX = useTransform(sy, [-0.5, 0.5], [max, -max]);
  const rotY = useTransform(sx, [-0.5, 0.5], [-max, max]);

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current || reduce) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    x.set(px - 0.5);
    y.set(py - 0.5);
    if (glow) {
      ref.current.style.setProperty("--x", `${px * 100}%`);
      ref.current.style.setProperty("--y", `${py * 100}%`);
    }
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`${glow ? "aaj-tilt-glow " : ""}${className ?? ""}`}
      style={{
        rotateX: rotX,
        rotateY: rotY,
        transformStyle: "preserve-3d",
        transformPerspective: 900,
        ...style,
      }}
    >
      <div style={{ transform: "translateZ(20px)" }}>{children}</div>
    </motion.div>
  );
};
