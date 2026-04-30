/**
 * Variants et transitions Motion partagés.
 *
 * Centraliser ici évite que chaque page redéclare ses propres durées /
 * easings et garantit un vocabulaire d'animation cohérent sur tout le site.
 *
 * Convention :
 * - Durées courtes (≤ 0.4 s) — site institutionnel, animations discrètes.
 * - Easings doux ([0.22, 1, 0.36, 1] = "ease-out-quint").
 * - Toutes ces valeurs sont automatiquement neutralisées par
 *   `<MotionConfig reducedMotion="user">` (App.tsx) si l'utilisateur a
 *   activé `prefers-reduced-motion: reduce`.
 */

import type { Variants, Transition, TargetAndTransition } from 'motion/react';

const EASE_OUT_QUINT: Transition['ease'] = [0.22, 1, 0.36, 1];

/**
 * Transition appliquée aux changements de route (App.tsx → AnimatedRoutes).
 * Court fade + léger slide vertical, mode "wait" géré par AnimatePresence.
 */
export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: EASE_OUT_QUINT } satisfies Transition,
};

/**
 * Apparition simple — élément qui monte légèrement en se révélant.
 * À combiner avec `whileInView` + `viewport={{ once: true }}` pour les
 * sections qui se révèlent au scroll.
 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT_QUINT },
  },
};

/**
 * Variantes pour un parent qui déclenche en cascade ses enfants.
 * Utiliser conjointement avec `staggerItem` sur chaque enfant.
 *
 * Exemple :
 *   <motion.ul variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
 *     {items.map(i => <motion.li key={i.id} variants={staggerItem}>...</motion.li>)}
 *   </motion.ul>
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

/**
 * Variante d'enfant pour une grille / liste révélée en stagger.
 * Mêmes valeurs que `fadeInUp` pour rester cohérent visuellement.
 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT_QUINT },
  },
};

/**
 * Slide-up depuis le bas — utilisé pour bannières et toasts qui apparaissent
 * en bas de l'écran (CookieBanner, notifications).
 */
export const slideUpFromBottom: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_OUT_QUINT },
  },
  exit: {
    opacity: 0,
    y: 32,
    transition: { duration: 0.25, ease: 'easeIn' },
  },
};

/**
 * Hover lift — léger élévation au survol, à utiliser en `whileHover` sur
 * les cartes (NewsPostCard, PartnerCard).
 */
export const hoverLift: TargetAndTransition = {
  y: -4,
  transition: { duration: 0.2, ease: EASE_OUT_QUINT },
};

/**
 * Réglage `viewport` standardisé pour les `whileInView`.
 * `once: true` = animation jouée une seule fois (n'pas re-trigger au scroll).
 * `amount: 0.2` = se déclenche dès qu'au moins 20 % de l'élément est visible.
 */
export const inViewOnce = { once: true, amount: 0.2 } as const;
