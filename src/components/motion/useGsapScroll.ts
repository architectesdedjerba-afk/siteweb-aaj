/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight wrappers around GSAP + ScrollTrigger so pages can opt
 * into pinned / scrubbed scroll animations without re-registering the
 * plugin every mount. ScrollTrigger is registered exactly once.
 */

import { useEffect, useLayoutEffect, type DependencyList, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;
const ensureRegistered = () => {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
};

const useIsoEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Run a GSAP setup inside a `gsap.context()` scoped to `scope`. The
 * context is reverted on cleanup so all tweens / ScrollTriggers it
 * created are killed automatically.
 */
export const useGsapContext = (
  scope: RefObject<HTMLElement | null>,
  setup: (ctx: gsap.Context) => void,
  deps: DependencyList = []
) => {
  useIsoEffect(() => {
    ensureRegistered();
    if (!scope.current) return;
    const ctx = gsap.context(setup, scope);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

export { gsap, ScrollTrigger };
