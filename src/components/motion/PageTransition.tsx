/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a route's content in a motion shell that fades + lifts on
 * mount and exits with a slight scale-down. Used on every public page.
 * Coupled with <AnimatePresence mode="wait"> at the routes level.
 */
export const PageTransition = ({ children, className }: PageTransitionProps) => {
  const reduce = useReducedMotion();
  const variants: Variants = {
    initial: { opacity: 0, y: 24 },
    enter: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] },
    },
    exit: {
      opacity: 0,
      y: -16,
      transition: { duration: reduce ? 0 : 0.35, ease: [0.7, 0, 0.84, 0] },
    },
  };

  return (
    <motion.div
      className={className}
      initial="initial"
      animate="enter"
      exit="exit"
      variants={variants}
    >
      {children}
    </motion.div>
  );
};
