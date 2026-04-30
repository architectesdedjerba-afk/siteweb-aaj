/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { useRef, type ButtonHTMLAttributes, type ReactNode, type CSSProperties } from "react";

interface MagneticProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Pixel pull strength toward cursor (max). Default 0.35 of width. */
  strength?: number;
  /** Tag — defaults to button. Pass "span" or "a" via `as` if needed. */
  as?: "button" | "span" | "a" | "div";
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  ariaLabel?: string;
}

export const MagneticButton = ({
  children,
  className,
  style,
  strength = 0.3,
  as = "button",
  href,
  onClick,
  type,
  ariaLabel,
}: MagneticProps) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 250, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 250, damping: 18, mass: 0.4 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * strength);
    y.set((e.clientY - cy) * strength);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  const props = {
    ref: ref as any,
    onMouseMove: onMove,
    onMouseLeave: onLeave,
    onClick,
    style: { x: springX, y: springY, ...style },
    className,
    "aria-label": ariaLabel,
  };

  if (as === "a") {
    return (
      <motion.a {...(props as any)} href={href}>
        {children}
      </motion.a>
    );
  }
  if (as === "span") return <motion.span {...(props as any)}>{children}</motion.span>;
  if (as === "div") return <motion.div {...(props as any)}>{children}</motion.div>;
  return (
    <motion.button {...(props as any)} type={type ?? "button"}>
      {children}
    </motion.button>
  );
};
