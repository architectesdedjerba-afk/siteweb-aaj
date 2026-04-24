/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Home, ArrowLeft } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div className="pt-16 min-h-screen bg-white flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-xl w-full text-center py-20"
      >
        <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-6 block">
          Erreur 404
        </span>
        <h1 className="text-[120px] md:text-[180px] font-black text-aaj-dark leading-none tracking-tighter mb-6">
          404
        </h1>
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-aaj-dark mb-4 text-balance">
          Page introuvable
        </h2>
        <p className="text-aaj-gray text-sm font-medium uppercase tracking-widest leading-relaxed mb-12">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-3 bg-aaj-dark text-white px-8 py-4 text-[11px] font-black uppercase tracking-[3px] hover:bg-aaj-royal transition-all active:scale-[0.98]"
          >
            <Home size={16} aria-hidden="true" />
            Accueil
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-3 border border-aaj-dark text-aaj-dark px-8 py-4 text-[11px] font-black uppercase tracking-[3px] hover:bg-aaj-dark hover:text-white transition-all active:scale-[0.98]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Retour
          </button>
        </div>
      </motion.div>
    </div>
  );
};
