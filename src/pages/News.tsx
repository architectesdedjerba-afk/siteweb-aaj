/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Calendar, ChevronRight, Loader2, CalendarX } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useFirestoreCollection } from "../lib/useFirestoreCollection";
import type { NewsItem } from "../types";
import {
  PageTransition,
  Reveal,
  Stagger,
  StaggerItem,
  GradientReveal,
  TiltCard,
  MagneticButton,
} from "../components/motion";

// Fallback data when collection is empty
const FALLBACK: NewsItem[] = [
  { title: "Colloque International d'Architecture", date: "2026-10-22", type: "Future", content: "Discussion sur la préservation des Menzel." },
  { title: "Atelier de Restauration du Patrimoine", date: "2026-11-15", type: "Future", content: "Discussion sur la préservation des Menzel." },
  { title: "Conférence Patrimoine", date: "2026-05-15", type: "Future", content: "Discussion sur la préservation des Menzel." },
  { title: "Exposition Archi Jerba", date: "2026-06-10", type: "Future", content: "Vernissage des projets de fin d'études." },
  { title: "Atelier Urbanisme", date: "2026-03-20", type: "Past", content: "Rapport sur la gestion des côtes." },
];

type Filter = "all" | "Future" | "Past";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "Future", label: "À venir" },
  { key: "Past", label: "Archives" },
];

export const NewsPage = () => {
  const { data: firestoreNews, loading } = useFirestoreCollection<NewsItem>("news");
  const events = firestoreNews.length > 0 ? firestoreNews : FALLBACK;
  const [filter, setFilter] = useState<Filter>("all");

  const futureEvents = events.filter((e) => e.type === "Future");
  const pastEvents = events.filter((e) => e.type === "Past");
  const visibleFuture = filter === "all" || filter === "Future" ? futureEvents : [];
  const visiblePast = filter === "all" || filter === "Past" ? pastEvents : [];
  const isEmpty = !loading && visibleFuture.length === 0 && visiblePast.length === 0;

  return (
    <PageTransition>
      <div className="aaj-dark-surface min-h-screen pt-24">
        <header className="relative max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-24 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-3 justify-center mb-6">
              <span className="w-10 h-px bg-aaj-cyan" aria-hidden="true" />
              <span className="text-[10px] uppercase tracking-[5px] text-aaj-cyan font-black">
                Agenda
              </span>
              <span className="w-10 h-px bg-aaj-cyan" aria-hidden="true" />
            </div>
          </Reveal>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95] text-balance">
            <GradientReveal
              as="span"
              text="Évènements"
              className="inline-block aaj-text-gradient-vibrant"
            />
          </h1>
          <Reveal delay={0.5} className="mt-8 max-w-xl mx-auto">
            <p className="text-base md:text-lg text-white/70 leading-relaxed">
              Actualités et rencontres professionnelles de l'association.
            </p>
          </Reveal>
        </header>

        <section className="max-w-7xl mx-auto px-6 md:px-10 py-12 md:py-20">
          {loading ? (
            <div className="flex justify-center py-20" aria-live="polite">
              <Loader2 className="animate-spin text-aaj-cyan" size={32} aria-label="Chargement" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 space-y-12">
                <Reveal>
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer">
                    {FILTERS.map((f) => {
                      const active = filter === f.key;
                      const count =
                        f.key === "all"
                          ? events.length
                          : f.key === "Future"
                            ? futureEvents.length
                            : pastEvents.length;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setFilter(f.key)}
                          className={`inline-flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-[2.5px] rounded-full transition-all ${
                            active
                              ? "bg-aaj-cyan text-aaj-night shadow-[0_0_30px_rgba(0,229,255,0.4)]"
                              : "border border-white/15 text-white/60 hover:border-aaj-cyan hover:text-white"
                          }`}
                        >
                          {f.label}
                          <span className={`text-[9px] ${active ? "text-aaj-night/60" : "text-white/40"}`}>
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Reveal>

                {isEmpty && (
                  <Reveal>
                    <div className="flex flex-col items-center text-center py-20 rounded-2xl border border-dashed border-white/15 aaj-glass">
                      <CalendarX size={40} className="text-white/30 mb-6" aria-hidden="true" />
                      <h2 className="text-lg font-black uppercase tracking-tight text-white mb-2">
                        Aucun évènement
                      </h2>
                      <p className="text-white/50 text-sm font-medium uppercase tracking-widest">
                        Revenez bientôt — de nouvelles rencontres sont en préparation.
                      </p>
                    </div>
                  </Reveal>
                )}

                {visibleFuture.length > 0 && (
                  <div>
                    <Reveal>
                      <h2 className="text-[11px] uppercase tracking-[3px] text-white/50 font-black mb-8 flex items-center gap-4">
                        Prochains évènements{" "}
                        <span className="flex-1 h-px bg-white/10" aria-hidden="true" />
                      </h2>
                    </Reveal>
                    <Stagger className="space-y-4">
                      {visibleFuture.map((e, idx) => (
                        <StaggerItem key={e.id ?? idx}>
                          <TiltCard
                            max={4}
                            className="rounded-2xl aaj-glass p-6 md:p-8 hover:border-aaj-cyan/40 transition-colors group"
                          >
                            <article className="flex gap-6 items-start">
                              <div
                                className="shrink-0 min-w-[68px] h-[68px] rounded-xl bg-aaj-cyan/10 border border-aaj-cyan/30 flex flex-col items-center justify-center"
                                aria-hidden="true"
                              >
                                <span className="block font-display text-2xl font-bold text-aaj-cyan leading-none">
                                  {new Date(e.date).getDate()}
                                </span>
                                <span className="block text-[10px] uppercase tracking-widest font-bold text-aaj-cyan/80 mt-1">
                                  {new Date(e.date).toLocaleDateString("fr-FR", { month: "short" })}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg md:text-xl font-bold text-white group-hover:text-aaj-cyan transition-colors mb-2">
                                  {e.title}
                                </h3>
                                <p className="text-sm text-white/60 leading-relaxed mb-4">
                                  {e.content}
                                </p>
                                <button
                                  type="button"
                                  className="text-aaj-cyan text-[10px] font-black uppercase tracking-[3px] inline-flex items-center gap-2 hover:gap-3 transition-all aaj-link-underline"
                                >
                                  En savoir plus <ChevronRight size={14} aria-hidden="true" />
                                </button>
                              </div>
                            </article>
                          </TiltCard>
                        </StaggerItem>
                      ))}
                    </Stagger>
                  </div>
                )}

                {visiblePast.length > 0 && (
                  <div className="pt-8">
                    <Reveal>
                      <h2 className="text-[11px] uppercase tracking-[3px] text-white/50 font-black mb-8 flex items-center gap-4">
                        Archives <span className="flex-1 h-px bg-white/10" aria-hidden="true" />
                      </h2>
                    </Reveal>
                    <Stagger className="space-y-2" stagger={0.05}>
                      {visiblePast.map((e, idx) => (
                        <StaggerItem key={e.id ?? idx}>
                          <article className="px-6 py-4 rounded-xl border border-white/10 bg-white/[0.02] flex justify-between items-center gap-4 hover:border-white/20 transition-colors">
                            <div className="flex items-center gap-6 text-sm min-w-0">
                              <time
                                className="text-white/40 font-bold font-mono text-xs shrink-0 tabular-nums"
                                dateTime={e.date}
                              >
                                {e.date}
                              </time>
                              <h4 className="font-bold text-white/80 uppercase text-xs tracking-wider truncate">
                                {e.title}
                              </h4>
                            </div>
                            <span className="text-[9px] uppercase tracking-[2px] font-black text-white/40 border border-white/15 px-3 py-1 rounded-full shrink-0">
                              Terminé
                            </span>
                          </article>
                        </StaggerItem>
                      ))}
                    </Stagger>
                  </div>
                )}
              </div>

              <aside>
                <Reveal>
                  <div className="rounded-2xl aaj-glass p-8 sticky top-32">
                    <h2 className="text-sm font-bold mb-6 flex items-center gap-3 uppercase tracking-widest text-white">
                      <Calendar size={18} className="text-aaj-cyan" aria-hidden="true" />
                      Calendrier AAJ
                    </h2>
                    <p className="text-white/60 text-xs mb-8 leading-relaxed font-medium">
                      Suivez notre calendrier pour ne manquer aucune rencontre professionnelle
                      importante.
                    </p>
                    <div className="space-y-4">
                      <div className="w-full h-px bg-white/10" aria-hidden="true" />
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-black">
                        <span className="text-white/70">Inscriptions</span>
                        <span className="text-aaj-cyan">Ouvertes</span>
                      </div>
                      <div className="w-full h-px bg-white/10" aria-hidden="true" />
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-black">
                        <span className="text-white/70">À venir</span>
                        <span className="text-aaj-amber">{futureEvents.length}</span>
                      </div>
                      <div className="w-full h-px bg-white/10" aria-hidden="true" />
                    </div>
                    <MagneticButton as="div" strength={0.2} className="mt-8 block">
                      <Link
                        to="/inscription-evenement"
                        className="w-full block text-center bg-aaj-cyan text-aaj-night py-4 rounded-full text-[11px] font-black uppercase tracking-[3px] hover:bg-white transition-colors"
                      >
                        S'inscrire
                      </Link>
                    </MagneticButton>
                  </div>
                </Reveal>
              </aside>
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
};
