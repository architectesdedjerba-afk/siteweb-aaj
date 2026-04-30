/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Star, ShieldCheck } from "lucide-react";
import {
  DEFAULT_PAGE_PARTNERS,
  loadPagePartners,
  type PagePartnersContent,
  type PartnerIconKey,
} from "../lib/pageContent";

const ICONS: Record<PartnerIconKey, typeof Trophy> = {
  trophy: Trophy,
  star: Star,
  shield: ShieldCheck,
};

const TIER_COLORS = ["bg-aaj-dark", "bg-aaj-royal", "bg-aaj-gray"];

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
    <div className="pt-16 min-h-screen bg-white">
      <header className="border-b border-aaj-border py-20 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">{content.header.eyebrow}</span>
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black mb-6 uppercase tracking-tighter leading-none">{content.header.title}</h1>
          <p className="text-aaj-gray text-sm md:text-base max-w-2xl mx-auto font-medium uppercase tracking-widest leading-relaxed">{content.header.subtitle}</p>
        </div>
      </header>

      <section className="py-24 max-w-7xl mx-auto px-6">
        <h2 className="text-[12px] uppercase tracking-[2px] text-aaj-gray font-bold mb-12 flex items-center gap-4">
          {content.categoriesTitle} <span className="flex-1 h-px bg-aaj-border"></span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {content.categories.map((cat, idx) => {
             const colors = TIER_COLORS[idx % TIER_COLORS.length];
             const featured = idx === content.featuredIndex;
             const Icon = ICONS[cat.iconKey] ?? Trophy;
             return (
              <div
                key={idx}
                className={`flex flex-col h-full border group hover:border-aaj-royal transition-all rounded overflow-hidden ${
                  featured ? "border-aaj-royal shadow-xl md:-translate-y-2" : "border-aaj-border"
                }`}
              >
                {featured && (
                  <div className="bg-aaj-royal text-white text-center py-2 text-[9px] uppercase tracking-[3px] font-black">
                    Recommandé
                  </div>
                )}
                <div className={`${colors} p-10 text-white text-center flex flex-col items-center`}>
                  <Icon className="mb-4 w-8 h-8 opacity-70" />
                  <span className="block text-[10px] uppercase tracking-[3px] font-black opacity-70 mb-2">{cat.name}</span>
                  <p className="text-sm font-bold">{cat.price}</p>
                </div>
                <div className="p-8 flex-1 flex flex-col bg-slate-50/30">
                  <ul className="space-y-4 mb-10 flex-1">
                    {cat.benefits.map((benefit, bIdx) => (
                      <li key={bIdx} className="text-[11px] flex gap-3 text-aaj-gray font-bold uppercase tracking-wider">
                        <span className="text-aaj-royal" aria-hidden="true">/</span> {benefit}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/devenir-partenaire"
                    className={`w-full py-4 rounded text-[10px] font-black uppercase tracking-[2px] transition-all text-center ${
                      featured
                        ? "bg-aaj-royal text-white hover:bg-aaj-dark"
                        : "border border-aaj-border hover:bg-aaj-dark hover:text-white hover:border-aaj-dark"
                    }`}
                  >
                    Nous Contacter
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-32">
          <h2 className="text-[12px] uppercase tracking-[2px] text-aaj-gray font-bold mb-12 flex items-center gap-4">
             {content.trustTitle} <span className="flex-1 h-px bg-aaj-border" aria-hidden="true"></span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {Array.from({ length: content.trustPlaceholders }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/2] bg-slate-50 flex items-center justify-center border border-aaj-border rounded hover:border-aaj-royal hover:bg-white transition-all"
                aria-hidden="true"
              >
                <span className="text-[9px] uppercase tracking-[3px] font-black text-aaj-gray-light">
                  À venir
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-32 p-12 bg-aaj-soft rounded text-center border border-aaj-royal/10">
          <h3 className="text-xl font-black text-aaj-dark mb-4 uppercase tracking-tight text-balance">{content.cta.title}</h3>
          <p className="text-aaj-gray mb-8 max-w-xl mx-auto text-sm font-medium">{content.cta.description}</p>
          <Link to="/devenir-partenaire" className="inline-block bg-aaj-royal text-white px-10 py-4 rounded text-[11px] font-black uppercase tracking-[3px] hover:bg-aaj-dark transition-all">
            {content.cta.buttonLabel}
          </Link>
        </div>
      </section>
    </div>
  );
};
