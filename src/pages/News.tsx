/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Calendar, ChevronRight, Loader2, CalendarX } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useFirestoreCollection } from "../lib/useFirestoreCollection";
import type { NewsItem } from "../types";

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
    <div className="pt-16 min-h-screen bg-white">
      <header className="border-b border-aaj-border py-16 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">Agenda</span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-4 uppercase tracking-tighter">Évènements</h1>
          <p className="text-aaj-gray text-sm md:text-base max-w-xl mx-auto font-medium uppercase tracking-widest leading-relaxed">Actualités et rencontres professionnelles de l'association.</p>
        </div>
      </header>

      <section className="py-20 max-w-7xl mx-auto px-6">
        {loading ? (
          <div className="flex justify-center py-20" aria-live="polite">
            <Loader2 className="animate-spin text-aaj-royal" size={32} aria-label="Chargement" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12">
              <div className="flex flex-wrap gap-2 pb-8 border-b border-aaj-border" role="tablist" aria-label="Filtrer les évènements">
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
                      className={`inline-flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-[2px] transition-all ${
                        active
                          ? "bg-aaj-dark text-white"
                          : "border border-aaj-border text-aaj-gray hover:border-aaj-dark hover:text-aaj-dark"
                      }`}
                    >
                      {f.label}
                      <span className={`text-[9px] ${active ? "text-white/60" : "text-aaj-gray-light"}`}>
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              {isEmpty && (
                <div className="flex flex-col items-center text-center py-20 border border-dashed border-aaj-border rounded">
                  <CalendarX size={40} className="text-aaj-gray-light mb-6" aria-hidden="true" />
                  <h2 className="text-lg font-black uppercase tracking-tight text-aaj-dark mb-2">
                    Aucun évènement
                  </h2>
                  <p className="text-aaj-gray text-sm font-medium uppercase tracking-widest">
                    Revenez bientôt — de nouvelles rencontres sont en préparation.
                  </p>
                </div>
              )}

              {visibleFuture.length > 0 && (
                <div>
                  <h2 className="text-[12px] uppercase tracking-[2px] text-aaj-gray font-bold mb-8 flex items-center gap-4">
                    Prochains évènements <span className="flex-1 h-px bg-aaj-border" aria-hidden="true"></span>
                  </h2>
                  <div className="space-y-8">
                    {visibleFuture.map((e, idx) => (
                      <article key={e.id ?? idx} className="flex gap-6 items-start group">
                        <div className="min-w-[60px] h-[60px] bg-aaj-soft rounded flex flex-col items-center justify-center border border-aaj-royal/10" aria-hidden="true">
                          <span className="block text-2xl font-black text-aaj-royal leading-none">{new Date(e.date).getDate()}</span>
                          <span className="block text-[10px] uppercase tracking-widest font-bold text-aaj-dark">
                            {new Date(e.date).toLocaleDateString('fr-FR', { month: 'short' })}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold mb-2 group-hover:text-aaj-royal transition-colors uppercase tracking-tight">{e.title}</h3>
                          <p className="text-aaj-gray text-sm font-medium mb-4 leading-relaxed">{e.content}</p>
                          <button type="button" className="text-aaj-royal text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:underline">
                             En savoir plus <ChevronRight size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {visiblePast.length > 0 && (
                <div className="pt-10">
                  <h2 className="text-[12px] uppercase tracking-[2px] text-aaj-gray font-bold mb-8 flex items-center gap-4">
                    Archives <span className="flex-1 h-px bg-aaj-border" aria-hidden="true"></span>
                  </h2>
                  <div className="space-y-4">
                    {visiblePast.map((e, idx) => (
                      <article key={e.id ?? idx} className="px-6 py-4 border border-aaj-border flex justify-between items-center bg-slate-50/50 rounded gap-4">
                        <div className="flex items-center gap-6 text-sm min-w-0">
                          <time className="text-aaj-gray font-bold font-mono text-xs shrink-0" dateTime={e.date}>{e.date}</time>
                          <h4 className="font-bold text-aaj-dark uppercase text-xs tracking-wider truncate">{e.title}</h4>
                        </div>
                        <span className="text-[9px] uppercase tracking-[2px] font-black text-aaj-gray bg-white border border-aaj-border px-3 py-1 rounded shrink-0">Terminé</span>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside>
              <div className="bg-aaj-dark rounded p-8 text-white sticky top-28 border border-white/10">
                <h2 className="text-sm font-bold mb-6 flex items-center gap-3 uppercase tracking-widest">
                  <Calendar size={18} className="text-aaj-royal" aria-hidden="true" />
                  Calendrier AAJ
                </h2>
                <p className="text-white/60 text-xs mb-8 leading-relaxed font-medium">
                  Suivez notre calendrier pour ne manquer aucune rencontre professionnelle importante.
                </p>
                <div className="space-y-4">
                  <div className="w-full h-px bg-white/10" aria-hidden="true"></div>
                  <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-black">
                    <span>Inscriptions</span>
                    <span className="text-blue-400">Ouvertes</span>
                  </div>
                  <div className="w-full h-px bg-white/10" aria-hidden="true"></div>
                  <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-black">
                    <span>Prochaines rencontres</span>
                    <span className="text-aaj-royal">{futureEvents.length}</span>
                  </div>
                  <div className="w-full h-px bg-white/10" aria-hidden="true"></div>
                </div>
                <Link
                  to="/inscription-evenement"
                  className="w-full mt-10 border border-white/20 py-4 rounded text-[11px] font-black uppercase tracking-[3px] hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                  S'inscrire
                </Link>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
};
