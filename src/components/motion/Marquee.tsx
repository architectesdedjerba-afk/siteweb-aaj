/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from "react";

interface MarqueeProps {
  children: ReactNode;
  className?: string;
  /** Animation duration in seconds. Default 40s. Smaller = faster. */
  duration?: number;
  /** Reverse direction (right-to-left becomes left-to-right). */
  reverse?: boolean;
  /** Pause on hover. Default true. */
  pauseOnHover?: boolean;
}

/**
 * Pure-CSS infinite marquee. Children are duplicated so the track can
 * loop seamlessly via translateX(-50%). Pair the children with a fixed
 * gap so spacing reads consistently across the seam.
 */
export const Marquee = ({
  children,
  className,
  duration = 40,
  reverse = false,
  pauseOnHover = true,
}: MarqueeProps) => {
  return (
    <div
      className={`aaj-marquee ${className ?? ""}`}
      style={pauseOnHover ? undefined : { ["--marquee-pause" as any]: "running" }}
    >
      <div
        className="aaj-marquee-track aaj-will-animate"
        style={{
          animationDuration: `${duration}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div aria-hidden="true" className="flex shrink-0 items-center">
          {children}
        </div>
      </div>
    </div>
  );
};
