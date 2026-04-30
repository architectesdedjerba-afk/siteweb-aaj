/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ElementType } from "react";

interface SplitTextProps {
  text: string;
  as?: ElementType;
  className?: string;
  charClassName?: string;
  delay?: number;
  duration?: number;
  stagger?: number;
  once?: boolean;
  /** Split by 'char' (default) or 'word'. Words preserve word integrity for line-breaking. */
  by?: "char" | "word";
}

export const SplitText = ({
  text,
  as: Component = "span",
  className,
  charClassName,
  delay = 0,
  duration = 0.7,
  stagger = 0.025,
  once = true,
  by = "char",
}: SplitTextProps) => {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduce ? 0 : stagger,
        delayChildren: reduce ? 0 : delay,
      },
    },
  };

  const item: Variants = {
    hidden: { y: "110%", opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: reduce ? 0 : duration, ease: [0.22, 1, 0.36, 1] },
    },
  };

  const tokens = by === "word" ? text.split(/(\s+)/) : Array.from(text);
  const MotionComp = motion(Component as any);

  return (
    <MotionComp
      className={className}
      style={{ display: "inline-block" }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.3 }}
      variants={container}
      aria-label={text}
    >
      {tokens.map((token, i) => {
        const isWhitespace = /^\s+$/.test(token);
        if (isWhitespace) {
          return (
            <span key={i} aria-hidden="true" style={{ display: "inline-block", whiteSpace: "pre" }}>
              {token}
            </span>
          );
        }
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}
          >
            <motion.span
              variants={item}
              style={{ display: "inline-block", willChange: "transform, opacity" }}
              className={charClassName}
            >
              {token === " " ? " " : token}
            </motion.span>
          </span>
        );
      })}
    </MotionComp>
  );
};
