/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import heroImage from "../img/logo.png";

export const HomePage = () => {
  return (
    <div className="pt-16 min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="border-x border-aaj-border min-h-[calc(100vh-64px)]">
          {/* Hero Section - 2 Columns */}
          <section className="grid grid-cols-1 lg:grid-cols-2 border-b border-aaj-border min-h-[70vh] relative overflow-hidden">
            <div className="p-10 lg:p-14 border-b lg:border-b-0 lg:border-r border-aaj-border flex flex-col justify-center bg-white z-10">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="relative"
              >
                <span className="text-[10px] uppercase tracking-[4px] text-aaj-royal font-black mb-6 block">
                  Association des Architectes de Jerba
                </span>
                {/* Heading with overflow bleed into image space - positioned OVER the image */}
                <h1 className="text-4xl lg:text-5xl xl:text-7xl leading-[0.95] font-black mb-8 text-aaj-dark uppercase tracking-tighter lg:w-[150%] relative z-20 mix-blend-multiply lg:mix-blend-normal">
                  L'excellence <br/> 
                  <span className="text-aaj-royal">Architecturale</span> <br/>
                  à Djerba.
                </h1>
                <p className="text-sm lg:text-base leading-relaxed text-aaj-gray mb-12 max-w-sm font-medium uppercase tracking-wide">
                  L’AAJ s’engage pour une architecture qui respecte l’âme millénaire de l’île tout en embrassant l’innovation contemporaine.
                </p>
                
                <div className="flex gap-8">
                  <Link to="/aaj" className="text-[10px] font-black uppercase tracking-[3px] text-aaj-dark border-b-2 border-aaj-dark pb-1 hover:text-aaj-royal hover:border-aaj-royal transition-all">
                    L'Association
                  </Link>
                  <Link to="/evennements" className="text-[10px] font-black uppercase tracking-[3px] text-slate-400 hover:text-aaj-dark transition-all">
                    Agenda
                  </Link>
                </div>
              </motion.div>
            </div>

            <div className="h-[500px] lg:h-auto overflow-hidden relative z-0 border-l border-aaj-border">
              <img 
                src={heroImage} 
                alt="Association des Architectes de Jerba" 
                className="w-full h-full object-contain hover:scale-105 transition-all duration-1000 p-12"
                referrerPolicy="no-referrer"
              />
            </div>
          </section>

          {/* Quick Access Panes */}
          <section className="grid grid-cols-1 md:grid-cols-2">
            {/* Events Pane */}
            <div className="p-10 lg:p-14 border-b md:border-b-0 md:border-r border-aaj-border flex flex-col">
              <h2 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-12 flex items-center gap-4">
                Évènements <span className="h-px flex-1 bg-aaj-border"></span>
              </h2>
              <div className="space-y-8 flex-1">
                {[
                  { d: '22', m: 'Oct', t: "Colloque International d'Architecture", loc: "Houmt Souk — 09:00" },
                  { d: '15', m: 'Nov', t: "Patrimoine & Modernité", loc: "Centre Culturel de Jerba" }
                ].map((ev, i) => (
                  <div key={i} className="flex gap-6 group cursor-pointer">
                    <div className="min-w-[54px] h-[54px] border border-aaj-border flex flex-col items-center justify-center group-hover:bg-aaj-royal group-hover:border-aaj-royal transition-all">
                      <span className="text-xl font-black group-hover:text-white transition-colors">{ev.d}</span>
                      <span className="text-[9px] font-black uppercase group-hover:text-white/80 transition-colors">{ev.m}</span>
                    </div>
                    <div className="flex flex-col justify-center">
                      <h3 className="text-sm font-bold uppercase tracking-tight group-hover:text-aaj-royal transition-colors">{ev.t}</h3>
                      <p className="text-[11px] text-aaj-gray font-bold uppercase tracking-widest">{ev.loc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/evennements" className="mt-12 inline-flex items-center gap-3 text-[10px] font-black text-aaj-royal uppercase tracking-[3px] hover:translate-x-1 transition-transform">
                Tous les évènements <ArrowRight size={14} />
              </Link>
            </div>

            {/* Sponsoring Pane */}
            <div className="p-10 lg:p-14 flex flex-col">
              <h2 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-12 flex items-center gap-4">
                Partenariats <span className="h-px flex-1 bg-aaj-border"></span>
              </h2>
              <div className="grid grid-cols-3 gap-1 mb-10">
                {[
                  { name: 'Platine', bg: 'bg-aaj-dark' },
                  { name: 'Or', bg: 'bg-aaj-royal' },
                  { name: 'Argent', bg: 'bg-slate-400' },
                ].map((s, i) => (
                  <div key={i} className={`${s.bg} text-white aspect-square flex flex-col items-center justify-center p-2`}>
                    <span className="block text-[8px] uppercase tracking-[2px] font-black opacity-60 mb-1">{s.name}</span>
                    <div className="w-8 h-[1px] bg-white/30"></div>
                  </div>
                ))}
              </div>
              
              <p className="text-[11px] text-aaj-gray font-bold uppercase tracking-widest leading-loose mb-10">
                L'AAJ remercie ses partenaires pour leur engagement constant envers le développement de notre profession.
              </p>
              
              <Link to="/partenaires" className="mt-auto text-[10px] font-black text-aaj-royal uppercase tracking-[3px] hover:translate-x-1 transition-transform">
                Devenir Partenaire <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
