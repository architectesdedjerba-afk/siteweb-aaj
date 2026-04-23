/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../services/api';
import { useToast } from '../lib/toast';
import {
  email as vEmail,
  first,
  hasErrors,
  maxLength,
  required,
  ValidationErrors,
} from '../lib/validation';
import { SEO } from '../components/SEO';

interface FormState {
  fullName: string;
  email: string;
  eventTitle: string;
  message: string;
}

const EVENTS = [
  "Colloque International d'Architecture",
  'Patrimoine & Modernité',
  'Atelier Urbanisme',
];

export const EventRegistrationPage = () => {
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>({
    fullName: '',
    email: '',
    eventTitle: EVENTS[0],
    message: '',
  });
  const [errors, setErrors] = useState<ValidationErrors<FormState>>({});

  const validate = (f: FormState): ValidationErrors<FormState> => ({
    fullName: first(required(f.fullName, 'Nom complet'), maxLength(f.fullName, 200)),
    email: first(required(f.email, 'Email'), vEmail(f.email)),
    eventTitle: required(f.eventTitle, 'Évènement'),
    message: maxLength(f.message, 2000),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (hasErrors(errs)) {
      toast.error('Veuillez corriger les erreurs du formulaire.');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitEventRegistration(form);
      setSubmitted(true);
      toast.success('Inscription enregistrée.');
    } catch (err) {
      console.error('Event registration error:', err);
      toast.error("Impossible d'envoyer l'inscription. Réessayez plus tard.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="pt-16 min-h-screen bg-white flex items-center justify-center p-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <CheckCircle2 size={64} className="text-aaj-royal mx-auto mb-6" aria-hidden="true" />
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-4 text-aaj-dark">
            Inscription Confirmée
          </h1>
          <p className="text-aaj-gray text-sm uppercase font-bold tracking-widest mb-10">
            Votre inscription a bien été enregistrée.
          </p>
          <Link
            to="/evennements"
            className="text-[10px] font-black uppercase tracking-[3px] text-aaj-dark border border-aaj-dark px-8 py-4 hover:bg-aaj-dark hover:text-white transition-all"
          >
            Retour aux évènements
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Inscription évènement"
        description="Formulaire d'inscription aux évènements de l'Association des Architectes de Jerba : colloques, ateliers et conférences."
        path="/inscription-evenement"
      />
      <div className="pt-16 min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <Link
            to="/evennements"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[3px] text-aaj-gray hover:text-aaj-dark transition-colors mb-12"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Retour
          </Link>

          <header className="mb-16">
            <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">
              Formulaire
            </span>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4 text-aaj-dark">
              S'inscrire à un évènement
            </h1>
            <p className="text-aaj-gray text-sm font-medium uppercase tracking-widest leading-relaxed">
              Veuillez remplir les informations ci-dessous pour confirmer votre présence.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-10" noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-2">
                <label
                  htmlFor="er-name"
                  className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                >
                  Nom Complet
                </label>
                <input
                  id="er-name"
                  type="text"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  aria-invalid={!!errors.fullName}
                  aria-describedby={errors.fullName ? 'er-name-err' : undefined}
                  className="w-full bg-slate-50 border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal focus:bg-white transition-all text-sm font-medium"
                  placeholder="Prénom Nom"
                  required
                />
                {errors.fullName && (
                  <p id="er-name-err" className="text-xs text-red-600">
                    {errors.fullName}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="er-email"
                  className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                >
                  Email
                </label>
                <input
                  id="er-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'er-email-err' : undefined}
                  className="w-full bg-slate-50 border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal focus:bg-white transition-all text-sm font-medium"
                  placeholder="email@exemple.com"
                  required
                />
                {errors.email && (
                  <p id="er-email-err" className="text-xs text-red-600">
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="er-event"
                className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
              >
                Évènement
              </label>
              <select
                id="er-event"
                value={form.eventTitle}
                onChange={(e) => setForm({ ...form, eventTitle: e.target.value })}
                className="w-full bg-slate-50 border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal focus:bg-white transition-all text-sm font-medium appearance-none"
              >
                {EVENTS.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="er-msg"
                className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
              >
                Message ou besoin particulier (Optionnel)
              </label>
              <textarea
                id="er-msg"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full bg-slate-50 border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal focus:bg-white transition-all text-sm font-medium min-h-[150px]"
                placeholder="..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-aaj-dark text-white py-6 font-black uppercase tracking-[4px] text-xs hover:bg-aaj-royal transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              ) : null}
              Confirmer l'inscription
            </button>
          </form>
        </div>
      </div>
    </>
  );
};
