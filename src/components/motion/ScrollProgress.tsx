/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useScroll, useSpring } from "motion/react";

export const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 300,
    damping: 40,
    mass: 0.2,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] z-[200] origin-left aaj-will-animate"
      style={{
        scaleX,
        background:
          "linear-gradient(90deg, #00E5FF 0%, #4D7FFF 50%, #FFC371 100%)",
        boxShadow: "0 0 20px rgba(0, 229, 255, 0.5)",
      }}
      aria-hidden="true"
    />
  );
};
