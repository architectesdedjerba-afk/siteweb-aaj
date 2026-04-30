/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useRef, type ReactNode, type CSSProperties } from "react";

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Translate distance in px from center. Positive = element moves
   *  upward as the viewport scrolls down past it. */
  amount?: number;
}

export const Parallax = ({ children, className, style, amount = 80 }: ParallaxProps) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [amount, -amount]);

  return (
    <motion.div ref={ref} className={className} style={{ y, ...style }}>
      {children}
    </motion.div>
  );
};
