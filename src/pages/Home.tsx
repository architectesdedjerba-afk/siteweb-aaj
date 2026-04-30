/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Users, Award, Landmark, Calendar, Sparkles, ArrowUpRight } from "lucide-react";
import heroImage from "../img/logo.png";
import { DEFAULT_PAGE_HOME, loadPageHome, type PageHomeContent } from "../lib/pageContent";
import {
  PageTransition,
  ParticleField,
  SplitText,
  Reveal,
  Stagger,
  StaggerItem,
  GradientReveal,
  Marquee,
  MagneticButton,
  TiltCard,
  Parallax,
  useGsapContext,
  gsap,
  ScrollTrigger,
} from "../components/motion";

const STAT_ICONS = [Users, Award, Landmark, Calendar];

export const HomePage = () => {
  const [content, setContent] = useState<PageHomeContent>(DEFAULT_PAGE_HOME);
  const heroRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadPageHome().then((c) => {
      if (!cancelled) setContent(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hero parallax — image lifts faster than text on scroll
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroImgY = useTransform(heroProgress, [0, 1], [0, -120]);
  const heroTextY = useTransform(heroProgress, [0, 1], [0, -40]);
  const heroFade = useTransform(heroProgress, [0, 1], [1, 0]);

  // GSAP ScrollTrigger: stat counter scrub + section pin reveal
  useGsapContext(
    pageRef,
    () => {
      // Animate stat numbers with a counter effect on enter
      const statNodes = document.querySelectorAll<HTMLElement>(
        "[data-aaj-counter]"
      );
      statNodes.forEach((el) => {
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
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none reset",
          },
          onUpdate: () => {
            el.textContent = `${Math.round(obj.v)}${suffix}`;
          },
        });
      });

      // Reveal each pane section on entry
      gsap.utils.toArray<HTMLElement>("[data-aaj-fade-section]").forEach((s) => {
        gsap.fromTo(
          s,
          { autoAlpha: 0, y: 60 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: s,
              start: "top 80%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Pin-style horizontal hint on the marquee row
      ScrollTrigger.refresh();
    },
    [content]
  );

  return (
    <PageTransition>
      <div ref={pageRef} className="aaj-dark-surface min-h-screen">
        {/* ============================================================ */}
        {/* HERO — particles + kinetic title + parallax logo */}
        {/* ============================================================ */}
        <section
          ref={heroRef}
          className="relative min-h-[100vh] pt-24 pb-16 overflow-hidden"
        >
          <ParticleField className="z-0" density={100} />

          <motion.div
            style={{ opacity: heroFade }}
            aria-hidden="true"
            className="absolute inset-0 aaj-hero-vignette pointer-events-none z-[1]"
          />

          <div className="relative z-[2] max-w-7xl mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center min-h-[calc(100vh-96px)]">
            <motion.div
              style={{ y: heroTextY }}
              className="lg:col-span-7 flex flex-col justify-center aaj-will-animate"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="inline-flex items-center gap-3 mb-8"
              >
                <span className="w-10 h-px bg-aaj-cyan" aria-hidden="true" />
                <span className="text-[10px] uppercase tracking-[5px] text-aaj-cyan font-black">
                  {content.hero.eyebrow}
                </span>
              </motion.div>

              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl xl:text-[7.5rem] leading-[0.92] font-bold tracking-tighter text-balance">
                <span className="block text-white">
                  <SplitText text={content.hero.titleLine1} />
                </span>
                <GradientReveal
                  as="span"
                  text={content.hero.titleHighlight}
                  delay={0.4}
                  className="block aaj-text-gradient-vibrant"
                />
                <span className="block text-white">
                  <SplitText text={content.hero.titleLine3} delay={0.7} />
                </span>
              </h1>

              <Reveal delay={0.9} className="mt-10 max-w-lg">
                <p className="text-base md:text-lg text-white/70 leading-relaxed font-light">
                  {content.hero.subtitle}
                </p>
              </Reveal>

              <Reveal delay={1.1} className="mt-12 flex flex-wrap items-center gap-5">
                <MagneticButton as="div" strength={0.35}>
                  <Link
                    to="/aaj"
                    className="group relative inline-flex items-center gap-3 bg-aaj-cyan text-aaj-night px-8 py-4 text-[11px] font-black uppercase tracking-[3px] rounded-full hover:bg-white transition-colors"
                  >
                    {content.hero.ctaLabel}
                    <ArrowRight
                      size={16}
                      aria-hidden="true"
                      className="group-hover:translate-x-1 transition-transform"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full"
                      style={{ boxShadow: "0 0 40px rgba(0,229,255,0.5)" }}
                    />
                  </Link>
                </MagneticButton>

                <MagneticButton as="div" strength={0.25}>
                  <Link
                    to="/evennements"
                    className="inline-flex items-center gap-3 text-white/70 hover:text-white px-6 py-4 text-[11px] font-black uppercase tracking-[3px] border border-white/20 rounded-full hover:border-aaj-cyan transition-all"
                  >
                    Voir l'agenda
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </MagneticButton>
              </Reveal>

              <Reveal delay={1.3} className="mt-16 flex items-center gap-8">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-[3px] text-white/40 font-bold mb-1">
                    Estd
                  </span>
                  <span className="font-display text-2xl font-bold text-white">2010</span>
                </div>
                <div className="w-px h-10 bg-white/20" aria-hidden="true" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-[3px] text-white/40 font-bold mb-1">
                    Adhérents
                  </span>
                  <span className="font-display text-2xl font-bold text-white">120+</span>
                </div>
                <div className="w-px h-10 bg-white/20" aria-hidden="true" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-[3px] text-white/40 font-bold mb-1">
                    Île
                  </span>
                  <span className="font-display text-2xl font-bold text-white">Djerba</span>
                </div>
              </Reveal>
            </motion.div>

            <motion.div
              style={{ y: heroImgY }}
              className="lg:col-span-5 relative aaj-will-animate hidden lg:flex items-center justify-center"
            >
              <div className="relative w-full max-w-md aspect-square">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(0,229,255,0.25) 0%, transparent 60%)",
                    filter: "blur(40px)",
                  }}
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute inset-8 rounded-full border border-white/10"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute inset-16 rounded-full border border-aaj-cyan/30"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                />
                <img
                  src={heroImage}
                  alt="Logo de l'Association des Architectes de Jerba"
                  className="absolute inset-0 w-full h-full object-contain p-20 brightness-0 invert"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.6 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3"
            aria-hidden="true"
          >
            <span className="text-[9px] uppercase tracking-[4px] text-white/40 font-bold">
              Scroll
            </span>
            <motion.div
              className="w-px h-12 bg-gradient-to-b from-aaj-cyan to-transparent"
              animate={{ scaleY: [0.4, 1, 0.4], originY: 0 }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </section>

        {/* ============================================================ */}
        {/* MARQUEE — kinetic word band */}
        {/* ============================================================ */}
        <section className="relative border-y border-white/10 py-8 bg-aaj-deep/40">
          <Marquee duration={45}>
            {[
              "Excellence",
              "Patrimoine",
              "Innovation",
              "Communauté",
              "Architecture",
              "Djerba",
            ].map((word, i) => (
              <span
                key={i}
                className="text-3xl md:text-5xl font-display font-bold uppercase tracking-tighter px-10 whitespace-nowrap select-none"
              >
                <span className="text-white">{word}</span>
                <span className="text-aaj-cyan mx-6">✦</span>
              </span>
            ))}
          </Marquee>
        </section>

        {/* ============================================================ */}
        {/* STATS — counter on scroll */}
        {/* ============================================================ */}
        <section
          data-aaj-fade-section
          className="relative max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32"
        >
          <Reveal direction="up" className="mb-16 max-w-2xl">
            <div className="inline-flex items-center gap-3 mb-6">
              <span className="w-8 h-px bg-aaj-cyan" aria-hidden="true" />
              <span className="text-[10px] uppercase tracking-[4px] text-aaj-cyan font-black">
                En chiffres
              </span>
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-white tracking-tighter leading-[1] text-balance">
              Une décennie au service de{" "}
              <span className="aaj-text-gradient-vibrant">l'architecture</span>
            </h2>
          </Reveal>

          <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            {content.stats.map(({ value, label }, i) => {
              const Icon = STAT_ICONS[i % STAT_ICONS.length];
              return (
                <StaggerItem key={i} className="bg-aaj-deep p-8 md:p-10 group">
                  <div className="flex flex-col h-full">
                    <Icon
                      size={20}
                      className="text-aaj-cyan mb-6 group-hover:scale-110 transition-transform"
                      aria-hidden="true"
                    />
                    <div
                      data-aaj-counter={value}
                      className="font-display text-5xl md:text-6xl font-bold text-white tracking-tighter mb-3 leading-none"
                    >
                      {value}
                    </div>
                    <span className="text-[10px] uppercase tracking-[2px] text-white/50 font-bold leading-relaxed">
                      {label}
                    </span>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>

        {/* ============================================================ */}
        {/* EVENTS + PARTNERS — split, with tilt cards */}
        {/* ============================================================ */}
        <section
          data-aaj-fade-section
          className="max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-12"
        >
          <div>
            <Reveal direction="up">
              <div className="flex items-baseline justify-between mb-12">
                <div>
                  <div className="inline-flex items-center gap-3 mb-4">
                    <Sparkles size={14} className="text-aaj-cyan" aria-hidden="true" />
                    <span className="text-[10px] uppercase tracking-[4px] text-aaj-cyan font-black">
                      Agenda
                    </span>
                  </div>
                  <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tighter">
                    {content.eventsTitle}
                  </h2>
                </div>
                <Link
                  to="/evennements"
                  className="hidden md:inline-flex items-center gap-2 text-[10px] uppercase tracking-[3px] font-black text-white/60 hover:text-aaj-cyan transition-colors aaj-link-underline"
                >
                  Tout voir <ArrowUpRight size={12} aria-hidden="true" />
                </Link>
              </div>
            </Reveal>

            <Stagger className="space-y-4">
              {content.events.map((ev, i) => (
                <StaggerItem key={i}>
                  <Link
                    to="/evennements"
                    className="group flex gap-6 items-center p-6 rounded-2xl aaj-glass hover:aaj-glow-cyan hover:border-aaj-cyan/40 transition-all"
                  >
                    <div className="shrink-0 w-16 h-16 rounded-xl bg-aaj-cyan/10 border border-aaj-cyan/30 flex flex-col items-center justify-center">
                      <span className="font-display text-2xl font-bold text-aaj-cyan leading-none">
                        {ev.d}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-aaj-cyan/80 tracking-widest mt-1">
                        {ev.m}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base md:text-lg font-bold text-white group-hover:text-aaj-cyan transition-colors line-clamp-1">
                        {ev.t}
                      </h3>
                      <p className="text-[11px] uppercase tracking-widest text-white/50 font-bold mt-2">
                        {ev.loc}
                      </p>
                    </div>
                    <ArrowRight
                      size={18}
                      aria-hidden="true"
                      className="shrink-0 text-white/30 group-hover:text-aaj-cyan group-hover:translate-x-1 transition-all"
                    />
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>

            <Reveal delay={0.1} className="mt-8">
              <Link
                to="/evennements"
                className="md:hidden inline-flex items-center gap-2 text-[10px] uppercase tracking-[3px] font-black text-aaj-cyan"
              >
                {content.eventsCta} <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </Reveal>
          </div>

          <div>
            <Reveal direction="up">
              <div className="flex items-baseline justify-between mb-12">
                <div>
                  <div className="inline-flex items-center gap-3 mb-4">
                    <Sparkles size={14} className="text-aaj-amber" aria-hidden="true" />
                    <span className="text-[10px] uppercase tracking-[4px] text-aaj-amber font-black">
                      Réseau
                    </span>
                  </div>
                  <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tighter">
                    {content.sponsorsTitle}
                  </h2>
                </div>
              </div>
            </Reveal>

            <Stagger className="grid grid-cols-3 gap-4 mb-8">
              {content.sponsors.map((s, i) => (
                <StaggerItem key={i}>
                  <TiltCard
                    className="aspect-square rounded-2xl aaj-glass flex flex-col items-center justify-center text-center p-4 hover:border-aaj-amber/40 transition-colors"
                    max={10}
                  >
                    <span className="text-[9px] uppercase tracking-[3px] font-black text-white/40 mb-2">
                      Tier 0{i + 1}
                    </span>
                    <span className="font-display text-xl md:text-2xl font-bold text-white">
                      {s.name}
                    </span>
                    <div className="mt-3 w-8 h-px bg-aaj-amber" aria-hidden="true" />
                  </TiltCard>
                </StaggerItem>
              ))}
            </Stagger>

            <Reveal>
              <p className="text-sm text-white/60 leading-relaxed mb-8 max-w-md">
                {content.sponsorsBlurb}
              </p>
              <MagneticButton as="div">
                <Link
                  to="/partenaires"
                  className="inline-flex items-center gap-3 px-7 py-3.5 text-[11px] font-black uppercase tracking-[3px] text-aaj-night bg-aaj-amber rounded-full hover:bg-white transition-colors"
                >
                  {content.sponsorsCta}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </MagneticButton>
            </Reveal>
          </div>
        </section>

        {/* ============================================================ */}
        {/* CTA — closing — full bleed dark with parallax glow */}
        {/* ============================================================ */}
        <section
          data-aaj-fade-section
          className="relative overflow-hidden border-t border-white/10"
        >
          <div className="absolute inset-0 z-0">
            <Parallax amount={60} className="h-full">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 50%, rgba(0,229,255,0.15) 0%, transparent 50%)",
                }}
              />
            </Parallax>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 py-32 md:py-40">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-end">
              <div className="md:col-span-8">
                <Reveal>
                  <div className="inline-flex items-center gap-3 mb-8">
                    <span className="w-12 h-px bg-aaj-cyan" aria-hidden="true" />
                    <span className="text-[10px] uppercase tracking-[5px] text-aaj-cyan font-black">
                      {content.cta.eyebrow}
                    </span>
                  </div>
                </Reveal>
                <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-white tracking-tighter leading-[0.95] text-balance">
                  <SplitText text={content.cta.title} by="word" stagger={0.04} />
                </h2>
              </div>
              <div className="md:col-span-4">
                <Reveal direction="up" delay={0.3}>
                  <MagneticButton as="div" strength={0.4}>
                    <Link
                      to="/devenir-partenaire"
                      className="group relative w-full inline-flex items-center justify-between gap-3 bg-white text-aaj-night px-8 py-6 text-[11px] font-black uppercase tracking-[3px] rounded-full hover:bg-aaj-cyan transition-colors"
                    >
                      {content.cta.buttonLabel}
                      <ArrowUpRight
                        size={20}
                        aria-hidden="true"
                        className="group-hover:rotate-45 transition-transform duration-500"
                      />
                    </Link>
                  </MagneticButton>
                </Reveal>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
};
