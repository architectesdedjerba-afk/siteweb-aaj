/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Users, Award, Landmark, Calendar } from "lucide-react";
import heroImage from "../img/logo.png";

const STATS = [
  { value: "120+", label: "Architectes adhérents", Icon: Users },
  { value: "15", label: "Années d'engagement", Icon: Award },
  { value: "30+", label: "Projets patrimoniaux", Icon: Landmark },
  { value: "50+", label: "Évènements organisés", Icon: Calendar },
];

const EVENTS_PREVIEW = [
  { d: "22", m: "Oct", t: "Colloque International d'Architecture", loc: "Houmt Souk — 09:00" },
  { d: "15", m: "Nov", t: "Patrimoine & Modernité", loc: "Centre Culturel de Jerba" },
];

const SPONSORS = [
  { name: "Platine", bg: "bg-aaj-dark" },
  { name: "Or", bg: "bg-aaj-royal" },
  { name: "Argent", bg: "bg-aaj-gray" },
];

export const HomePage = () => {
  return (
    <div className="pt-16 min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="border-x border-aaj-border min-h-[calc(100vh-64px)]">
          {/* Hero Section */}
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
                <h1 className="text-4xl lg:text-5xl xl:text-7xl leading-[0.95] font-black mb-8 text-aaj-dark uppercase tracking-tighter lg:w-[150%] relative z-20 mix-blend-multiply lg:mix-blend-normal text-balance">
                  L'excellence <br />
                  <span className="text-aaj-royal">Architecturale</span> <br />
                  à Djerba.
                </h1>
                <p className="text-sm lg:text-base leading-relaxed text-aaj-gray mb-10 max-w-sm font-medium uppercase tracking-wide">
                  L'AAJ s'engage pour une architecture qui respecte l'âme
                  millénaire de l'île tout en embrassant l'innovation
                  contemporaine.
                </p>

                <div className="flex flex-wrap gap-4 mb-8">
                  <Link
                    to="/demander-adhesion"
                    className="inline-flex items-center gap-3 bg-aaj-dark text-white px-7 py-4 text-[10px] font-black uppercase tracking-[3px] hover:bg-aaj-royal transition-all active:scale-[0.98]"
                  >
                    Demander mon adhésion <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                  <Link
                    to="/aaj"
                    className="inline-flex items-center gap-3 border border-aaj-dark text-aaj-dark px-7 py-4 text-[10px] font-black uppercase tracking-[3px] hover:bg-aaj-dark hover:text-white transition-all"
                  >
                    Découvrir l'AAJ
                  </Link>
                </div>

                <div className="flex gap-8 pt-6 border-t border-aaj-border">
                  <Link
                    to="/evennements"
                    className="text-[10px] font-black uppercase tracking-[3px] text-aaj-gray hover:text-aaj-royal transition-all"
                  >
                    Agenda
                  </Link>
                  <Link
                    to="/partenaires"
                    className="text-[10px] font-black uppercase tracking-[3px] text-aaj-gray hover:text-aaj-royal transition-all"
                  >
                    Partenaires
                  </Link>
                </div>
              </motion.div>
            </div>

            <div className="h-[500px] lg:h-auto overflow-hidden relative z-0 border-l border-aaj-border bg-gradient-to-br from-aaj-soft/30 to-white">
              <img
                src={heroImage}
                alt="Logo de l'Association des Architectes de Jerba"
                className="w-full h-full object-contain hover:scale-105 transition-all duration-1000 p-12"
                referrerPolicy="no-referrer"
              />
            </div>
          </section>

          {/* Stats Strip */}
          <section className="grid grid-cols-2 md:grid-cols-4 border-b border-aaj-border">
            {STATS.map(({ value, label, Icon }, i) => (
              <div
                key={i}
                className={`p-8 lg:p-10 flex flex-col items-center text-center ${
                  i < STATS.length - 1 ? "border-b md:border-b-0 md:border-r border-aaj-border" : ""
                } ${i < 2 ? "border-b md:border-b-0" : ""}`}
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
          </section>

          {/* Quick Access Panes */}
          <section className="grid grid-cols-1 md:grid-cols-2">
            {/* Events Pane */}
            <div className="p-10 lg:p-14 border-b md:border-b-0 md:border-r border-aaj-border flex flex-col">
              <h2 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-12 flex items-center gap-4">
                Évènements <span className="h-px flex-1 bg-aaj-border" aria-hidden="true"></span>
              </h2>
              <div className="space-y-8 flex-1">
                {EVENTS_PREVIEW.map((ev, i) => (
                  <Link
                    to="/evennements"
                    key={i}
                    className="flex gap-6 group"
                  >
                    <div className="min-w-[54px] h-[54px] border border-aaj-border flex flex-col items-center justify-center group-hover:bg-aaj-royal group-hover:border-aaj-royal transition-all">
                      <span className="text-xl font-black group-hover:text-white transition-colors">
                        {ev.d}
                      </span>
                      <span className="text-[9px] font-black uppercase group-hover:text-white/80 transition-colors">
                        {ev.m}
                      </span>
                    </div>
                    <div className="flex flex-col justify-center">
                      <h3 className="text-sm font-bold uppercase tracking-tight group-hover:text-aaj-royal transition-colors">
                        {ev.t}
                      </h3>
                      <p className="text-[11px] text-aaj-gray font-bold uppercase tracking-widest">
                        {ev.loc}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                to="/evennements"
                className="mt-12 inline-flex items-center gap-3 text-[10px] font-black text-aaj-royal uppercase tracking-[3px] hover:gap-4 transition-all"
              >
                Tous les évènements <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            {/* Sponsoring Pane */}
            <div className="p-10 lg:p-14 flex flex-col">
              <h2 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-12 flex items-center gap-4">
                Partenariats <span className="h-px flex-1 bg-aaj-border" aria-hidden="true"></span>
              </h2>
              <div className="grid grid-cols-3 gap-1 mb-10">
                {SPONSORS.map((s, i) => (
                  <div
                    key={i}
                    className={`${s.bg} text-white aspect-square flex flex-col items-center justify-center p-2`}
                  >
                    <span className="block text-[8px] uppercase tracking-[2px] font-black opacity-60 mb-1">
                      {s.name}
                    </span>
                    <div className="w-8 h-[1px] bg-white/30" aria-hidden="true"></div>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-aaj-gray font-bold uppercase tracking-widest leading-loose mb-10">
                L'AAJ remercie ses partenaires pour leur engagement constant
                envers le développement de notre profession.
              </p>

              <Link
                to="/partenaires"
                className="mt-auto inline-flex items-center gap-3 text-[10px] font-black text-aaj-royal uppercase tracking-[3px] hover:gap-4 transition-all"
              >
                Devenir Partenaire <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="border-t border-aaj-border bg-aaj-dark text-white p-10 lg:p-16">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
              <div className="md:col-span-8">
                <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">
                  Rejoignez le mouvement
                </span>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-black uppercase tracking-tighter leading-[0.95] text-balance">
                  Façonnez l'avenir de l'architecture à Djerba.
                </h2>
              </div>
              <div className="md:col-span-4 flex flex-col gap-4">
                <Link
                  to="/demander-adhesion"
                  className="w-full bg-white text-aaj-dark px-6 py-4 text-[10px] font-black uppercase tracking-[3px] hover:bg-aaj-royal hover:text-white transition-all text-center"
                >
                  Devenir adhérent
                </Link>
                <Link
                  to="/devenir-partenaire"
                  className="w-full border border-white/30 px-6 py-4 text-[10px] font-black uppercase tracking-[3px] hover:bg-white/10 transition-all text-center"
                >
                  Devenir partenaire
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
