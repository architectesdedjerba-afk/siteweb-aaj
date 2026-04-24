/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { Users, Award, Landmark, Calendar } from "lucide-react";
import bureauImg from "../img/bureau2527.jpg";
import localImg from "../img/AAJ Local.jpg";

interface HistoryEntry {
  period: string;
  president: string;
}

interface AboutSection {
  title: string;
  content?: string;
  items?: string[];
  history?: HistoryEntry[];
}

const STATS = [
  { value: "120+", label: "Architectes adhérents", Icon: Users },
  { value: "15", label: "Années d'engagement", Icon: Award },
  { value: "30+", label: "Projets patrimoniaux", Icon: Landmark },
  { value: "50+", label: "Évènements organisés", Icon: Calendar },
];

export const AboutPage = () => {
  const sections: AboutSection[] = [
    {
      title: "Notre Mission",
      content: "L'Association des Architectes de Jerba (AAJ) œuvre pour la promotion de l'excellence architecturale et la préservation de l'identité unique de l'île. Nous croyons en une architecture durable qui dialogue avec l'histoire tout en répondant aux défis de demain."
    },
    {
      title: "Nos Objectifs",
      items: [
        "Protéger le patrimoine architectural jerbien (Menzels, Mosquées, Souks).",
        "Soutenir les jeunes architectes dans leur insertion professionnelle.",
        "Organiser des workshops et colloques internationaux.",
        "Collaborer avec les autorités pour un urbanisme maîtrisé."
      ]
    },
    {
      title: "L'Exécutif Actuel",
      content: "L'association est dirigée par un bureau de professionnels passionnés, élus par leurs pairs, engagés pour le rayonnement de Djerba."
    },
    {
      title: "Historique des Bureaux",
      content: "Depuis sa création, plusieurs bureaux exécutifs se sont succédé, chacun apportant sa pierre à l'édifice de l'association.",
      history: [
        { period: "2024 - Présent", president: "Bureau Actuel" },
        { period: "2021 - 2023", president: "Mandat Précédent" },
        { period: "2018 - 2020", president: "Mandat Historique" }
      ]
    }
  ];

  return (
    <div className="pt-16 min-h-screen bg-white">
      <header className="border-b border-aaj-border py-20 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">Manifeste</span>
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black mb-6 uppercase tracking-tighter leading-none">À Propos de l'AAJ</h1>
          <p className="text-aaj-gray text-sm md:text-base max-w-2xl mx-auto font-medium uppercase tracking-widest leading-relaxed">Engagement, Patrimoine et Innovation.</p>
        </div>
      </header>

      <section className="border-b border-aaj-border max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 border-l border-aaj-border">
          {STATS.map(({ value, label, Icon }, i) => (
            <div
              key={i}
              className="p-8 lg:p-10 border-r border-aaj-border flex flex-col items-center text-center"
            >
              <Icon size={20} className="text-aaj-royal mb-4" aria-hidden="true" />
              <div className="text-3xl lg:text-4xl font-black text-aaj-dark tracking-tighter mb-2">
                {value}
              </div>
              <span className="text-[9px] uppercase tracking-[2px] text-aaj-gray font-bold">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 max-w-7xl mx-auto px-6 border-b border-aaj-border">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          <div className="flex flex-col justify-center space-y-16">
            {sections.filter(s => s.title === "Notre Mission" || s.title === "Nos Objectifs").map((section, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                viewport={{ once: true }}
              >
                <h2 className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-6 flex items-center gap-4">
                  {section.title} <span className="h-px flex-1 bg-aaj-border"></span>
                </h2>
                {section.content && (
                  <p className="text-sm lg:text-base text-aaj-gray font-medium leading-relaxed uppercase tracking-wide">
                    {section.content}
                  </p>
                )}
                {section.items && (
                  <ul className="space-y-4 mt-6">
                    {section.items.map((item, i) => (
                      <li key={i} className="text-[11px] font-bold uppercase tracking-widest text-aaj-dark flex gap-4">
                        <span className="text-aaj-royal">/</span> {item}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ))}
          </div>
          <div className="aspect-[4/5] bg-slate-50 border border-aaj-border overflow-hidden rounded relative">
             <img 
              src={localImg} 
              alt="AAJ Local" 
              className="w-full h-full object-cover saturate-[0.3] group-hover:saturate-100 transition-all duration-1000 opacity-60"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center p-12 text-center">
               <p className="text-[12px] font-black uppercase tracking-[6px] text-aaj-dark leading-loose drop-shadow-sm">
                 <span className="text-aaj-royal">L'architecture</span> <br/> est l'expression <br/> de la culture.
               </p>
            </div>
          </div>
        </div>
      </section>

      {/* New Bureau Section - Full Image, Text Above */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="mb-16">
          <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">Gouvernance</span>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none mb-8">Le Bureau Exécutif Actuel</h2>
          <p className="text-sm lg:text-base text-aaj-gray font-medium leading-relaxed uppercase tracking-wide max-w-3xl">
            {sections.find(s => s.title === "L'Exécutif Actuel")?.content}
          </p>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
          className="border border-aaj-border overflow-hidden rounded group bg-white shadow-2xl shadow-slate-200/50"
        >
          <img 
            src={bureauImg} 
            alt="Le Bureau Exécutif Actuel de l'AAJ" 
            className="w-full h-auto saturate-[0.5] group-hover:saturate-100 transition-all duration-1000"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </section>

      {/* History Timeline Section */}
      <section className="py-24 border-t border-aaj-border bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
            <div className="max-w-xl">
              <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">Héritage</span>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none mb-6">
                Chronologie <br/> des Bureaux
              </h2>
              <p className="text-aaj-gray text-sm font-medium uppercase tracking-widest leading-relaxed">
                Une succession de visions et d'engagements qui ont façonné l'histoire de l'association depuis sa fondation.
              </p>
            </div>
            <div className="w-12 h-12 border border-aaj-border flex items-center justify-center text-aaj-royal">
              <span className="font-black">AAJ</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-aaj-border">
            {sections.find(s => s.title === "Historique des Bureaux")?.history?.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="p-10 border-r border-b border-aaj-border group hover:bg-white transition-colors"
              >
                <span className="text-aaj-royal font-black text-2xl mb-8 block opacity-40 group-hover:opacity-100 transition-opacity">/ 0{idx + 1}</span>
                <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-gray mb-2">Période</h3>
                <p className="text-xl font-black text-aaj-dark uppercase tracking-tighter mb-8">{item.period}</p>
                
                <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-gray mb-2">Administration</h3>
                <p className="text-sm font-bold text-aaj-royal uppercase tracking-widest">{item.president}</p>
              </motion.div>
            ))}
            
            {/* Legend card */}
            <div className="p-10 border-r border-b border-aaj-border bg-aaj-dark text-white flex flex-col justify-end">
              <p className="text-[10px] font-black uppercase tracking-[4px] leading-relaxed">
                Chaque bureau travaille bénévolement pour la pérennité de notre patrimoine insulaire.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-aaj-dark text-white py-24">
        <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-8 text-white">L'AAJ engagée au service de l'architecture et du patrimoine de l'ile</h2>
            <div className="w-20 h-1 bg-aaj-royal mx-auto"></div>
        </div>
      </section>
    </div>
  );
};
