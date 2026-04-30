/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode, ElementType } from "react";

type Direction = "up" | "down" | "left" | "right" | "none";

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  direction?: Direction;
  delay?: number;
  duration?: number;
  distance?: number;
  once?: boolean;
  amount?: number;
  className?: string;
  style?: React.CSSProperties;
}

const offsetFor = (dir: Direction, distance: number) => {
  switch (dir) {
    case "up":    return { y: distance, x: 0 };
    case "down":  return { y: -distance, x: 0 };
    case "left":  return { x: distance, y: 0 };
    case "right": return { x: -distance, y: 0 };
    default:      return { x: 0, y: 0 };
  }
};

export const Reveal = ({
  children,
  as: Component = "div",
  direction = "up",
  delay = 0,
  duration = 0.9,
  distance = 28,
  once = true,
  amount = 0.2,
  className,
  style,
}: RevealProps) => {
  const reduce = useReducedMotion();
  const offset = offsetFor(direction, distance);

  const variants: Variants = {
    hidden: { opacity: 0, ...offset },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: reduce ? 0 : duration,
        delay: reduce ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  const MotionComp = motion(Component as any);

  return (
    <MotionComp
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={variants}
    >
      {children}
    </MotionComp>
  );
};

interface StaggerProps {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  stagger?: number;
  once?: boolean;
  amount?: number;
  className?: string;
}

export const Stagger = ({
  children,
  as: Component = "div",
  delay = 0,
  stagger = 0.08,
  once = true,
  amount = 0.2,
  className,
}: StaggerProps) => {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduce ? 0 : stagger,
        delayChildren: reduce ? 0 : delay,
      },
    },
  };
  const MotionComp = motion(Component as any);
  return (
    <MotionComp
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={variants}
    >
      {children}
    </MotionComp>
  );
};

/**
 * GradientReveal — single-block fade-up that preserves a parent
 * `background-clip: text` gradient. Use this instead of SplitText when
 * the text has a CSS gradient — SplitText wraps each char in an
 * inline-block / transformed span, which breaks gradient inheritance.
 */
interface GradientRevealProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  as?: ElementType;
}

export const GradientReveal = ({
  text,
  className,
  delay = 0,
  duration = 0.9,
  as: Component = "span",
}: GradientRevealProps) => {
  const reduce = useReducedMotion();
  const MotionComp = motion(Component as any);
  return (
    <MotionComp
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        duration: reduce ? 0 : duration,
        delay: reduce ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {text}
    </MotionComp>
  );
};

interface StaggerItemProps {
  children: ReactNode;
  as?: ElementType;
  direction?: Direction;
  distance?: number;
  className?: string;
}

export const StaggerItem = ({
  children,
  as: Component = "div",
  direction = "up",
  distance = 24,
  className,
}: StaggerItemProps) => {
  const offset = offsetFor(direction, distance);
  const variants: Variants = {
    hidden: { opacity: 0, ...offset },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
    },
  };
  const MotionComp = motion(Component as any);
  return (
    <MotionComp className={className} variants={variants}>
      {children}
    </MotionComp>
  );
};
