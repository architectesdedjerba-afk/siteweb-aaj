/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Initial site loader. Shown once per session via sessionStorage so
 * subsequent route navigations don't re-trigger it.
 */
export const LoadingScreen = () => {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.sessionStorage.getItem("aaj_loaded_once") === "1";
    if (seen || reduce) {
      setShow(false);
      document.body.classList.remove("aaj-loading");
      return;
    }

    document.body.classList.add("aaj-loading");
    const t = window.setTimeout(() => {
      setShow(false);
      document.body.classList.remove("aaj-loading");
      window.sessionStorage.setItem("aaj_loaded_once", "1");
    }, 1600);
    return () => window.clearTimeout(t);
  }, [reduce]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="aaj-loader"
          className="fixed inset-0 z-[400] flex items-center justify-center bg-aaj-night"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.7, 0, 0.84, 0] } }}
        >
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(0,229,255,0.15) 0%, transparent 60%)",
              }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            />
          </div>

          <div className="relative flex flex-col items-center gap-6">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-[10px] uppercase tracking-[6px] font-black text-white/50"
            >
              Association des Architectes
            </motion.span>
            <motion.div
              className="overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: "auto" }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="font-display text-7xl md:text-9xl font-bold text-white tracking-tighter">
                AA<span className="text-aaj-cyan aaj-text-glow-cyan">J</span>
              </span>
            </motion.div>
            <motion.div
              className="h-[2px] bg-gradient-to-r from-transparent via-aaj-cyan to-transparent"
              initial={{ width: 0 }}
              animate={{ width: 240 }}
              transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          <motion.div
            className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[4px] text-white/30 font-bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.4 }}
          >
            Djerba — Tunisie
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
