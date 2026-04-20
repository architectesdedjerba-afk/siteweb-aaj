/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Calendar, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useFirestoreCollection } from "../lib/useFirestoreCollection";
import type { NewsItem } from "../types";

// Fallback data when Firestore collection is empty
const FALLBACK: NewsItem[] = [
  { title: "Colloque International d'Architecture", date: "2026-10-22", type: "Future", content: "Discussion sur la préservation des Menzel." },
  { title: "Atelier de Restauration du Patrimoine", date: "2026-11-15", type: "Future", content: "Discussion sur la préservation des Menzel." },
  { title: "Conférence Patrimoine", date: "2026-05-15", type: "Future", content: "Discussion sur la préservation des Menzel." },
  { title: "Exposition Archi Jerba", date: "2026-06-10", type: "Future", content: "Vernissage des projets de fin d'études." },
  { title: "Atelier Urbanisme", date: "2026-03-20", type: "Past", content: "Rapport sur la gestion des côtes." },
];

export const NewsPage = () => {
  const { data: firestoreNews, loading } = useFirestoreCollection<NewsItem>("news");
  const events = firestoreNews.length > 0 ? firestoreNews : FALLBACK;

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
              <div>
                <h2 className="text-[12px] uppercase tracking-[2px] text-aaj-gray font-bold mb-8 flex items-center gap-4">
                  Prochains évènements <span className="flex-1 h-px bg-aaj-border" aria-hidden="true"></span>
                </h2>
                <div className="space-y-8">
                  {events.filter(e => e.type === "Future").map((e, idx) => (
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

              <div className="pt-10">
                <h2 className="text-[12px] uppercase tracking-[2px] text-aaj-gray font-bold mb-8 flex items-center gap-4">
                  Archives <span className="flex-1 h-px bg-aaj-border" aria-hidden="true"></span>
                </h2>
                <div className="space-y-4">
                   {events.filter(e => e.type === "Past").map((e, idx) => (
                    <article key={e.id ?? idx} className="px-6 py-4 border border-aaj-border flex justify-between items-center bg-slate-50/50 rounded">
                      <div className="flex items-center gap-6 text-sm">
                        <time className="text-aaj-gray font-bold font-mono text-xs" dateTime={e.date}>{e.date}</time>
                        <h4 className="font-bold text-aaj-dark uppercase text-xs tracking-wider">{e.title}</h4>
                      </div>
                      <span className="text-[9px] uppercase tracking-[2px] font-black text-aaj-gray bg-white border border-aaj-border px-3 py-1 rounded">Terminé</span>
                    </article>
                  ))}
                </div>
              </div>
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
                  <div className="w-full h-px bg-white/10"></div>
                  <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-black">
                    <span>Inscriptions</span>
                    <span className="text-blue-400">Ouvertes</span>
                  </div>
                  <div className="w-full h-px bg-white/10"></div>
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
