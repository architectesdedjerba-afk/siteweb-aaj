/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

interface RevealOnScrollProps {
  children: ReactNode;
  /** Délai avant l'entrée en secondes */
  delay?: number;
  /** Direction d'entrée */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  /** Décalage initial en pixels */
  offset?: number;
  /** Durée de l'animation */
  duration?: number;
  /** Marge du viewport pour déclencher l'animation */
  amount?: number;
  className?: string;
  /** Rend une seule fois au premier passage (défaut true) */
  once?: boolean;
}

/**
 * Conteneur qui révèle son contenu quand il entre dans le viewport.
 * Respecte prefers-reduced-motion — rendu sans animation si l'utilisateur préfère.
 *
 * Exemple :
 *   <RevealOnScroll delay={0.1} direction="up">
 *     <Card />
 *   </RevealOnScroll>
 */
export const RevealOnScroll = ({
  children,
  delay = 0,
  direction = 'up',
  offset = 24,
  duration = 0.6,
  amount = 0.2,
  className,
  once = true,
}: RevealOnScrollProps) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const initialOffset = {
    up: { y: offset, x: 0 },
    down: { y: -offset, x: 0 },
    left: { x: offset, y: 0 },
    right: { x: -offset, y: 0 },
    none: { x: 0, y: 0 },
  }[direction];

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...initialOffset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};
