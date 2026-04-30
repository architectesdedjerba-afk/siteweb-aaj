/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Star, ShieldCheck, ArrowUpRight } from "lucide-react";
import {
  DEFAULT_PAGE_PARTNERS,
  loadPagePartners,
  type PagePartnersContent,
  type PartnerIconKey,
} from "../lib/pageContent";
import {
  PageTransition,
  Reveal,
  Stagger,
  StaggerItem,
  GradientReveal,
  TiltCard,
  MagneticButton,
} from "../components/motion";

const ICONS: Record<PartnerIconKey, typeof Trophy> = {
  trophy: Trophy,
  star: Star,
  shield: ShieldCheck,
};

const TIER_GRADIENTS = [
  "from-aaj-cyan/30 via-aaj-cyan/10 to-transparent",
  "from-aaj-amber/30 via-aaj-amber/10 to-transparent",
  "from-aaj-electric/30 via-aaj-electric/10 to-transparent",
];

export const PartnersPage = () => {
  const [content, setContent] = useState<PagePartnersContent>(DEFAULT_PAGE_PARTNERS);

  useEffect(() => {
    let cancelled = false;
    loadPagePartners().then((c) => {
      if (!cancelled) setContent(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageTransition>
      <div className="aaj-dark-surface min-h-screen pt-24">
        <header className="relative max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-3 justify-center mb-8">
              <span className="w-10 h-px bg-aaj-amber" aria-hidden="true" />
              <span className="text-[10px] uppercase tracking-[5px] text-aaj-amber font-black">
                {content.header.eyebrow}
              </span>
              <span className="w-10 h-px bg-aaj-amber" aria-hidden="true" />
            </div>
          </Reveal>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95] text-balance">
            <GradientReveal
              as="span"
              text={content.header.title}
              className="inline-block aaj-text-gradient-vibrant"
            />
          </h1>
          <Reveal delay={0.5} className="mt-10 max-w-2xl mx-auto">
            <p className="text-base md:text-lg text-white/70 leading-relaxed">
              {content.header.subtitle}
            </p>
          </Reveal>
        </header>

        <section className="max-w-7xl mx-auto px-6 md:px-10 py-12 md:py-20">
          <Reveal>
            <h2 className="text-[11px] uppercase tracking-[3px] text-white/50 font-black mb-12 flex items-center gap-4">
              {content.categoriesTitle}{" "}
              <span className="flex-1 h-px bg-white/10" aria-hidden="true" />
            </h2>
          </Reveal>

          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.categories.map((cat, idx) => {
              const featured = idx === content.featuredIndex;
              const Icon = ICONS[cat.iconKey] ?? Trophy;
              const gradient = TIER_GRADIENTS[idx % TIER_GRADIENTS.length];
              return (
                <StaggerItem key={idx}>
                  <TiltCard
                    max={6}
                    className={`relative h-full flex flex-col rounded-3xl overflow-hidden border transition-all ${
                      featured
                        ? "border-aaj-cyan/50 md:-translate-y-3 aaj-glow-cyan"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    {featured && (
                      <div className="absolute top-0 inset-x-0 z-10 bg-aaj-cyan text-aaj-night text-center py-2 text-[9px] uppercase tracking-[3px] font-black">
                        ✦ Recommandé ✦
                      </div>
                    )}
                    <div
                      className={`relative bg-gradient-to-br ${gradient} aaj-glass p-10 text-center flex flex-col items-center ${
                        featured ? "pt-12" : ""
                      }`}
                    >
                      <div className="w-14 h-14 rounded-full bg-white/5 border border-white/15 flex items-center justify-center mb-6">
                        <Icon className="w-6 h-6 text-white" aria-hidden="true" />
                      </div>
                      <span className="block text-[10px] uppercase tracking-[3px] font-black text-white/60 mb-3">
                        {cat.name}
                      </span>
                      <p className="font-display text-3xl font-bold text-white tracking-tighter">
                        {cat.price}
                      </p>
                    </div>
                    <div className="p-8 flex-1 flex flex-col bg-aaj-deep/60">
                      <ul className="space-y-4 mb-10 flex-1">
                        {cat.benefits.map((benefit, bIdx) => (
                          <li
                            key={bIdx}
                            className="text-[12px] flex gap-3 text-white/70 font-medium leading-relaxed"
                          >
                            <span className="text-aaj-cyan font-black shrink-0" aria-hidden="true">
                              /
                            </span>{" "}
                            {benefit}
                          </li>
                        ))}
                      </ul>
                      <MagneticButton as="div" strength={0.2}>
                        <Link
                          to="/devenir-partenaire"
                          className={`group w-full inline-flex items-center justify-center gap-2 py-4 rounded-full text-[10px] font-black uppercase tracking-[2.5px] transition-all ${
                            featured
                              ? "bg-aaj-cyan text-aaj-night hover:bg-white"
                              : "border border-white/20 text-white hover:bg-white hover:text-aaj-night hover:border-white"
                          }`}
                        >
                          Nous Contacter
                          <ArrowUpRight
                            size={14}
                            aria-hidden="true"
                            className="group-hover:rotate-45 transition-transform duration-300"
                          />
                        </Link>
                      </MagneticButton>
                    </div>
                  </TiltCard>
                </StaggerItem>
              );
            })}
          </Stagger>

          {/* Trust grid */}
          <div className="mt-32">
            <Reveal>
              <h2 className="text-[11px] uppercase tracking-[3px] text-white/50 font-black mb-12 flex items-center gap-4">
                {content.trustTitle}{" "}
                <span className="flex-1 h-px bg-white/10" aria-hidden="true" />
              </h2>
            </Reveal>
            <Stagger className="grid grid-cols-2 md:grid-cols-5 gap-4" stagger={0.05}>
              {Array.from({ length: content.trustPlaceholders }).map((_, i) => (
                <StaggerItem key={i}>
                  <div
                    className="aspect-[3/2] aaj-glass rounded-2xl flex items-center justify-center hover:border-aaj-cyan/40 hover:bg-white/[0.04] transition-all"
                    aria-hidden="true"
                  >
                    <span className="text-[9px] uppercase tracking-[3px] font-black text-white/30">
                      À venir
                    </span>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>

          {/* Closing CTA */}
          <Reveal className="mt-32">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 p-12 md:p-16 text-center">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-aaj-cyan/15 via-transparent to-aaj-amber/15"
              />
              <div className="relative">
                <h3 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tighter mb-6 text-balance">
                  {content.cta.title}
                </h3>
                <p className="text-white/60 mb-10 max-w-xl mx-auto text-base leading-relaxed">
                  {content.cta.description}
                </p>
                <MagneticButton as="div" strength={0.3}>
                  <Link
                    to="/devenir-partenaire"
                    className="inline-flex items-center gap-3 bg-aaj-amber text-aaj-night px-10 py-5 rounded-full text-[11px] font-black uppercase tracking-[3px] hover:bg-white transition-colors shadow-[0_0_40px_rgba(255,195,113,0.4)]"
                  >
                    {content.cta.buttonLabel}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </MagneticButton>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </PageTransition>
  );
};
