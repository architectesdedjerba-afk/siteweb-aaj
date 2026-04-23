/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../services/api';
import { useToast } from '../lib/toast';
import {
  email as vEmail,
  first,
  hasErrors,
  maxLength,
  phone as vPhone,
  required,
  ValidationErrors,
} from '../lib/validation';
import type { MemberCategory } from '../types';
import { SEO } from '../components/SEO';

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  category: MemberCategory;
  matricule: string;
  city: string;
  cvFileName: string;
}

export const MembershipApplicationPage = () => {
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>({
    fullName: '',
    phone: '',
    email: '',
    category: 'Architecte',
    matricule: '',
    city: '',
    cvFileName: '',
  });
  const [errors, setErrors] = useState<ValidationErrors<FormState>>({});

  const validate = (f: FormState): ValidationErrors<FormState> => ({
    fullName: first(required(f.fullName, 'Nom complet'), maxLength(f.fullName, 200)),
    phone: first(required(f.phone, 'Téléphone'), vPhone(f.phone)),
    email: first(required(f.email, 'Email'), vEmail(f.email)),
    matricule: required(f.matricule, 'Matricule'),
    city: required(f.city, 'Ville'),
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
      await api.submitMembershipApplication({
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        category: form.category,
        matricule: form.matricule,
        city: form.city,
        cvFileName: form.cvFileName,
      });
      setSubmitted(true);
      toast.success('Demande envoyée.');
    } catch (err) {
      console.error('Membership application error:', err);
      toast.error("Impossible d'envoyer la demande. Réessayez plus tard.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <>
        <SEO
          title="Demande d'adhésion"
          description="Formulaire de demande d'adhésion à l'Association des Architectes de Jerba. Rejoignez les architectes engagés pour l'excellence architecturale à Djerba."
          path="/demander-adhesion"
        />
        <div className="pt-16 min-h-screen bg-white flex items-center justify-center p-6 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <CheckCircle2 size={64} className="text-aaj-royal mx-auto mb-6" aria-hidden="true" />
            <h1 className="text-3xl font-black uppercase tracking-tighter mb-4 text-aaj-dark">
              Demande Envoyée
            </h1>
            <p className="text-aaj-gray text-sm uppercase font-bold tracking-widest mb-10 max-w-sm mx-auto">
              Votre demande d'adhésion est en cours de traitement par le bureau exécutif. Vous
              recevrez une réponse prochainement.
            </p>
            <Link
              to="/"
              className="text-[10px] font-black uppercase tracking-[3px] text-aaj-dark border border-aaj-dark px-8 py-4 hover:bg-aaj-dark hover:text-white transition-all"
            >
              Retour à l'accueil
            </Link>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Demande d'adhésion"
        description="Formulaire de demande d'adhésion à l'Association des Architectes de Jerba. Rejoignez les architectes engagés pour l'excellence architecturale à Djerba."
        path="/demander-adhesion"
      />
      <div className="pt-16 min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <Link
            to="/espace-adherents"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[3px] text-aaj-gray hover:text-aaj-dark transition-colors mb-12"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Retour
          </Link>

          <header className="mb-16">
            <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">
              Espace Professionnel
            </span>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4 text-aaj-dark">
              Devenir Adhérent
            </h1>
            <p className="text-aaj-gray text-sm font-medium uppercase tracking-widest leading-relaxed">
              Rejoignez l'Association des Architectes de Jerba et participez activement à
              l'évolution de notre profession.
            </p>
          </header>

          <form
            onSubmit={handleSubmit}
            className="space-y-12 bg-slate-50/50 p-8 md:p-14 border border-aaj-border"
            noValidate
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h2 className="text-[10px] uppercase font-black tracking-[4px] text-aaj-royal mb-8 border-b border-aaj-border pb-2">
                  Informations Personnelles
                </h2>
                <div className="space-y-2">
                  <label
                    htmlFor="ma-name"
                    className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                  >
                    Nom Complet
                  </label>
                  <input
                    id="ma-name"
                    type="text"
                    autoComplete="name"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    aria-invalid={!!errors.fullName}
                    className="w-full bg-white border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal transition-all text-sm font-medium"
                    placeholder="Prénom Nom"
                    required
                  />
                  {errors.fullName && <p className="text-xs text-red-600">{errors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="ma-phone"
                    className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                  >
                    Numéro de Téléphone
                  </label>
                  <input
                    id="ma-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    aria-invalid={!!errors.phone}
                    className="w-full bg-white border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal transition-all text-sm font-medium"
                    placeholder="+216 ..."
                    required
                  />
                  {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="ma-email"
                    className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                  >
                    Email
                  </label>
                  <input
                    id="ma-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    aria-invalid={!!errors.email}
                    className="w-full bg-white border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal transition-all text-sm font-medium"
                    placeholder="email@exemple.com"
                    required
                  />
                  {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
                </div>
              </div>

              <div className="space-y-6">
                <h2 className="text-[10px] uppercase font-black tracking-[4px] text-aaj-royal mb-8 border-b border-aaj-border pb-2">
                  Profil Professionnel
                </h2>

                <div className="space-y-2">
                  <label
                    htmlFor="ma-cat"
                    className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                  >
                    Catégorie
                  </label>
                  <select
                    id="ma-cat"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as MemberCategory })
                    }
                    className="w-full bg-white border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal transition-all text-sm font-bold uppercase tracking-widest cursor-pointer"
                    required
                  >
                    <option value="Architecte">Architecte</option>
                    <option value="Architecte Stagiaire">Architecte Stagiaire</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="ma-matric"
                    className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                  >
                    {form.category === 'Architecte'
                      ? "Numéro de matricule de l'ordre"
                      : 'Numéro de matricule étudiant'}
                  </label>
                  <input
                    id="ma-matric"
                    type="text"
                    value={form.matricule}
                    onChange={(e) => setForm({ ...form, matricule: e.target.value })}
                    aria-invalid={!!errors.matricule}
                    className="w-full bg-white border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal transition-all text-sm font-medium"
                    placeholder={form.category === 'Architecte' ? 'Ex: 1234/TN' : 'Ex: ETU-7890'}
                    required
                  />
                  {errors.matricule && <p className="text-xs text-red-600">{errors.matricule}</p>}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="ma-city"
                    className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                  >
                    Ville de Résidence
                  </label>
                  <input
                    id="ma-city"
                    type="text"
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    aria-invalid={!!errors.city}
                    className="w-full bg-white border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal transition-all text-sm font-medium"
                    placeholder="Ex: Houmt Souk"
                    required
                  />
                  {errors.city && <p className="text-xs text-red-600">{errors.city}</p>}
                </div>

                <div className="space-y-2 pt-4">
                  <label
                    htmlFor="ma-cv"
                    className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1 mb-2 block"
                  >
                    Dossier / CV (PDF)
                  </label>
                  <label
                    htmlFor="ma-cv"
                    className="w-full border-2 border-dashed border-aaj-border p-6 text-center hover:border-aaj-royal transition-colors bg-white group cursor-pointer block"
                  >
                    <Upload
                      size={24}
                      className="mx-auto text-aaj-gray group-hover:text-aaj-royal mb-2"
                      aria-hidden="true"
                    />
                    <span className="text-[10px] font-black uppercase text-aaj-gray tracking-widest">
                      {form.cvFileName || 'Choisir un fichier'}
                    </span>
                    <input
                      id="ma-cv"
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={(e) =>
                        setForm({ ...form, cvFileName: e.target.files?.[0]?.name ?? '' })
                      }
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-aaj-dark text-white py-6 font-black uppercase tracking-[4px] text-sm hover:bg-aaj-royal transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                ) : null}
                Soumettre ma demande d'adhésion
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
