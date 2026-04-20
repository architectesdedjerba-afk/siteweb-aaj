/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link } from "react-router-dom";
import { Trophy, Star, ShieldCheck } from "lucide-react";

export const PartnersPage = () => {
  const categories = [
    { 
      name: "Platine", 
      icon: <Trophy className="mb-4 w-8 h-8 opacity-70" />,
      price: "Partenaire Fondateur", 
      benefits: ["Logo sur tous supports", "Stand prioritaire", "Accès base de données"]
    },
    { 
      name: "Or", 
      icon: <Star className="mb-4 w-8 h-8 opacity-70" />,
      price: "Mécène Culturel", 
      benefits: ["Logo site web", "Invitation VIP", "Mention réseaux"]
    },
    { 
      name: "Argent", 
      icon: <ShieldCheck className="mb-4 w-8 h-8 opacity-70" />,
      price: "Support Technique", 
      benefits: ["Logo site web", "Mention événements"]
    },
  ];

  return (
    <div className="pt-16 min-h-screen bg-white">
      <header className="border-b border-aaj-border py-20 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">Partenariats</span>
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black mb-6 uppercase tracking-tighter leading-none">Nos Partenaires</h1>
          <p className="text-aaj-gray text-sm md:text-base max-w-2xl mx-auto font-medium uppercase tracking-widest leading-relaxed">Ils soutiennent le rayonnement de l'architecture tunisienne.</p>
        </div>
      </header>

      <section className="py-24 max-w-7xl mx-auto px-6">
        <h2 className="text-[12px] uppercase tracking-[2px] text-aaj-gray font-bold mb-12 flex items-center gap-4">
          Catégories de Sponsoring <span className="flex-1 h-px bg-aaj-border"></span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {categories.map((cat, idx) => {
             const colors = idx === 0 ? "bg-aaj-dark" : idx === 1 ? "bg-aaj-royal" : "bg-aaj-gray";
             return (
              <div key={idx} className="flex flex-col h-full border border-aaj-border group hover:border-aaj-royal transition-all rounded overflow-hidden">
                <div className={`${colors} p-10 text-white text-center flex flex-col items-center`}>
                  {cat.icon}
                  <span className="block text-[10px] uppercase tracking-[3px] font-black opacity-70 mb-2">{cat.name}</span>
                  <p className="text-sm font-bold">{cat.price}</p>
                </div>
                <div className="p-8 flex-1 flex flex-col bg-slate-50/30">
                  <ul className="space-y-4 mb-10 flex-1">
                    {cat.benefits.map((benefit, bIdx) => (
                      <li key={bIdx} className="text-[11px] flex gap-3 text-aaj-gray font-bold uppercase tracking-wider">
                        <span className="text-aaj-royal">/</span> {benefit}
                      </li>
                    ))}
                  </ul>
                  <Link to="/devenir-partenaire" className="w-full border border-aaj-border py-4 rounded text-[10px] font-black uppercase tracking-[2px] hover:bg-aaj-dark hover:text-white transition-all text-center">
                    Nous Contacter
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-32">
          <h2 className="text-[12px] uppercase tracking-[2px] text-aaj-gray font-bold mb-12 flex items-center gap-4">
             Ils nous font confiance <span className="flex-1 h-px bg-aaj-border"></span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-12 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-slate-100 flex items-center justify-center border border-dashed border-slate-300 rounded">
                <span className="text-[10px] font-bold text-slate-400">LOGO PARTENAIRE</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-32 p-12 bg-aaj-soft rounded text-center border border-aaj-royal/10">
          <h3 className="text-xl font-black text-aaj-dark mb-4 uppercase tracking-tight text-balance">Devenir un acteur du changement ?</h3>
          <p className="text-aaj-gray mb-8 max-w-xl mx-auto text-sm font-medium">Rejoignez-nous pour soutenir des projets innovants et valoriser le patrimoine architectural de Djerba.</p>
          <Link to="/devenir-partenaire" className="inline-block bg-aaj-royal text-white px-10 py-4 rounded text-[11px] font-black uppercase tracking-[3px] hover:bg-aaj-dark transition-all">
            Devenir Sponsor
          </Link>
        </div>
      </section>
    </div>
  );
};
