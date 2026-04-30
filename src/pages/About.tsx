/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { Users, Award, Landmark, Calendar } from "lucide-react";
import bureauImg from "../img/bureau2527.jpg";
import localImg from "../img/AAJ Local.jpg";
import { DEFAULT_PAGE_ABOUT, loadPageAbout, type PageAboutContent } from "../lib/pageContent";
import {
  PageTransition,
  SplitText,
  Reveal,
  Stagger,
  StaggerItem,
  GradientReveal,
  TiltCard,
  Parallax,
  useGsapContext,
  gsap,
} from "../components/motion";

const STAT_ICONS = [Users, Award, Landmark, Calendar];

export const AboutPage = () => {
  const [content, setContent] = useState<PageAboutContent>(DEFAULT_PAGE_ABOUT);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadPageAbout().then((c) => {
      if (!cancelled) setContent(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Stat counter scrub via GSAP ScrollTrigger
  useGsapContext(
    pageRef,
    () => {
      document.querySelectorAll<HTMLElement>("[data-aaj-counter]").forEach((el) => {
        const raw = el.dataset.aajCounter ?? "0";
        const numericMatch = raw.match(/(\d+)/);
        if (!numericMatch) return;
        const target = parseInt(numericMatch[1], 10);
        const suffix = raw.replace(numericMatch[1], "");
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reset" },
          onUpdate: () => {
            el.textContent = `${Math.round(obj.v)}${suffix}`;
          },
        });
      });
    },
    [content]
  );

  return (
    <PageTransition>
      <div ref={pageRef} className="aaj-dark-surface min-h-screen pt-24">
        {/* HERO */}
        <header className="relative max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-3 justify-center mb-8">
              <span className="w-10 h-px bg-aaj-cyan" aria-hidden="true" />
              <span className="text-[10px] uppercase tracking-[5px] text-aaj-cyan font-black">
                {content.header.eyebrow}
              </span>
              <span className="w-10 h-px bg-aaj-cyan" aria-hidden="true" />
            </div>
          </Reveal>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95] text-balance">
            <GradientReveal
              as="span"
              text={content.header.title}
              className="block aaj-text-gradient-vibrant"
            />
          </h1>
          <Reveal delay={0.5} className="mt-10 max-w-2xl mx-auto">
            <p className="text-base md:text-lg text-white/70 leading-relaxed">
              {content.header.subtitle}
            </p>
          </Reveal>
        </header>

        {/* STATS BAR */}
        <section className="max-w-7xl mx-auto px-6 md:px-10 mb-32">
          <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            {content.stats.map(({ value, label }, i) => {
              const Icon = STAT_ICONS[i % STAT_ICONS.length];
              return (
                <StaggerItem key={i} className="bg-aaj-deep p-8 md:p-10 group">
                  <Icon size={20} className="text-aaj-cyan mb-6" aria-hidden="true" />
                  <div
                    data-aaj-counter={value}
                    className="font-display text-5xl md:text-6xl font-bold text-white tracking-tighter mb-3 leading-none"
                  >
                    {value}
                  </div>
                  <span className="text-[10px] uppercase tracking-[2px] text-white/50 font-bold">
                    {label}
                  </span>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>

        {/* MISSION + OBJECTIVES split */}
        <section className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div className="space-y-16 lg:sticky lg:top-32">
            <Reveal>
              <div className="inline-flex items-center gap-3 mb-6">
                <span className="w-8 h-px bg-aaj-cyan" aria-hidden="true" />
                <span className="text-[10px] uppercase tracking-[4px] text-aaj-cyan font-black">
                  {content.mission.title}
                </span>
              </div>
              <p className="font-display text-2xl md:text-3xl lg:text-4xl text-white leading-tight tracking-tight font-light text-balance">
                {content.mission.content}
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="inline-flex items-center gap-3 mb-8">
                <span className="w-8 h-px bg-aaj-amber" aria-hidden="true" />
                <span className="text-[10px] uppercase tracking-[4px] text-aaj-amber font-black">
                  {content.objectives.title}
                </span>
              </div>
              <Stagger className="space-y-3">
                {content.objectives.items.map((item, i) => (
                  <StaggerItem
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-xl aaj-glass hover:border-aaj-amber/30 transition-colors group"
                  >
                    <span className="font-display text-aaj-amber font-bold text-sm shrink-0 mt-0.5">
                      0{i + 1}
                    </span>
                    <span className="text-sm md:text-base text-white/80 leading-relaxed">
                      {item}
                    </span>
                  </StaggerItem>
                ))}
              </Stagger>
            </Reveal>
          </div>

          <Reveal>
            <Parallax amount={50}>
              <TiltCard max={5} className="aspect-[4/5] rounded-3xl overflow-hidden relative group">
                <img
                  src={localImg}
                  alt="AAJ Local"
                  className="w-full h-full object-cover saturate-0 group-hover:saturate-100 transition-all duration-700 brightness-50 group-hover:brightness-75"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-aaj-night via-aaj-night/40 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-10">
                  <p className="text-base md:text-lg font-bold text-white uppercase tracking-[3px] leading-loose text-balance">
                    {content.imageQuote}
                  </p>
                  <div className="mt-4 w-12 h-px bg-aaj-cyan" aria-hidden="true" />
                </div>
              </TiltCard>
            </Parallax>
          </Reveal>
        </section>

        {/* BUREAU image — wide, parallax */}
        <section className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32">
          <Reveal className="mb-12 max-w-3xl">
            <div className="inline-flex items-center gap-3 mb-6">
              <span className="w-8 h-px bg-aaj-cyan" aria-hidden="true" />
              <span className="text-[10px] uppercase tracking-[4px] text-aaj-cyan font-black">
                {content.bureau.eyebrow}
              </span>
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-white tracking-tighter leading-[1] mb-8 text-balance">
              {content.bureau.title}
            </h2>
            <p className="text-base text-white/60 leading-relaxed">
              {content.bureau.description}
            </p>
          </Reveal>

          <Reveal>
            <div className="relative rounded-3xl overflow-hidden border border-white/10 group">
              <Parallax amount={30}>
                <img
                  src={bureauImg}
                  alt="Le Bureau Exécutif Actuel de l'AAJ"
                  className="w-full h-auto saturate-50 group-hover:saturate-100 transition-all duration-1000 brightness-90"
                  referrerPolicy="no-referrer"
                />
              </Parallax>
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-aaj-night/60 to-transparent" aria-hidden="true" />
            </div>
          </Reveal>
        </section>

        {/* HISTORY TIMELINE */}
        <section className="relative border-t border-white/10 bg-aaj-deep/50">
          <div className="max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
              <Reveal className="max-w-xl">
                <div className="inline-flex items-center gap-3 mb-6">
                  <span className="w-8 h-px bg-aaj-amber" aria-hidden="true" />
                  <span className="text-[10px] uppercase tracking-[4px] text-aaj-amber font-black">
                    {content.history.eyebrow}
                  </span>
                </div>
                <h2 className="font-display text-4xl md:text-6xl font-bold text-white tracking-tighter leading-[0.95] mb-6 text-balance">
                  {content.history.title}
                </h2>
                <p className="text-base text-white/60 leading-relaxed">
                  {content.history.description}
                </p>
              </Reveal>
            </div>

            <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {content.history.items.map((item, idx) => (
                <StaggerItem key={idx}>
                  <TiltCard
                    max={6}
                    className="aaj-glass rounded-2xl p-8 md:p-10 hover:border-aaj-cyan/40 transition-colors h-full"
                  >
                    <div className="flex items-baseline justify-between mb-8">
                      <span className="font-display text-aaj-cyan font-bold text-3xl tracking-tighter">
                        / 0{idx + 1}
                      </span>
                      <span className="text-[9px] uppercase tracking-[3px] text-white/40 font-bold">
                        Mandat
                      </span>
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-[3px] text-white/40 mb-2">
                      Période
                    </h3>
                    <p className="font-display text-2xl font-bold text-white tracking-tighter mb-8">
                      {item.period}
                    </p>
                    <h3 className="text-[10px] font-black uppercase tracking-[3px] text-white/40 mb-2">
                      Administration
                    </h3>
                    <p className="text-sm font-bold text-aaj-cyan uppercase tracking-widest">
                      {item.president}
                    </p>
                  </TiltCard>
                </StaggerItem>
              ))}

              <StaggerItem>
                <div className="rounded-2xl p-10 bg-gradient-to-br from-aaj-cyan/20 to-transparent border border-aaj-cyan/30 flex flex-col justify-end h-full min-h-[260px]">
                  <p className="text-[11px] font-black uppercase tracking-[3px] leading-relaxed text-white/90">
                    {content.history.legend}
                  </p>
                </div>
              </StaggerItem>
            </Stagger>
          </div>
        </section>

        {/* CLOSING */}
        <section className="relative border-t border-white/10 py-24 md:py-32">
          <Reveal className="max-w-4xl mx-auto px-6 md:px-10 text-center">
            <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold text-white tracking-tighter leading-[1] text-balance">
              <SplitText text={content.closingTitle} by="word" stagger={0.05} />
            </h2>
            <div className="mt-12 mx-auto w-24 h-px bg-gradient-to-r from-transparent via-aaj-cyan to-transparent" />
          </Reveal>
        </section>
      </div>
    </PageTransition>
  );
};
