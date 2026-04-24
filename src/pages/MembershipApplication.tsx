/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, Loader2, Upload, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, db } from '../lib/firebase';
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
import {
  DEFAULT_MEMBER_TYPES,
  DEFAULT_VILLES,
  loadMemberTypes,
  loadVilles,
  type MemberType,
} from '../lib/memberConfig';
import { SearchableSelect } from '../components/SearchableSelect';

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  memberTypeLetter: string;
  city: string;
  cvFileName: string;
}

export const MembershipApplicationPage = () => {
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [villesList, setVillesList] = useState<string[]>(DEFAULT_VILLES);
  const [memberTypesList, setMemberTypesList] = useState<MemberType[]>(DEFAULT_MEMBER_TYPES);
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    birthDate: '',
    memberTypeLetter: 'A',
    city: '',
    cvFileName: '',
  });
  const [errors, setErrors] = useState<ValidationErrors<FormState>>({});

  useEffect(() => {
    loadVilles()
      .then(setVillesList)
      .catch(() => setVillesList(DEFAULT_VILLES));
    loadMemberTypes()
      .then(setMemberTypesList)
      .catch(() => setMemberTypesList(DEFAULT_MEMBER_TYPES));
  }, []);

  const selectedType = memberTypesList.find((t) => t.letter === form.memberTypeLetter);
  const categoryLabel = selectedType?.label || 'Architecte';

  const validate = (f: FormState): ValidationErrors<FormState> => ({
    firstName: first(required(f.firstName, 'Prénom'), maxLength(f.firstName, 100)),
    lastName: first(required(f.lastName, 'Nom'), maxLength(f.lastName, 100)),
    phone: first(required(f.phone, 'Téléphone'), vPhone(f.phone)),
    email: first(required(f.email, 'Email'), vEmail(f.email)),
    birthDate: required(f.birthDate, 'Date de naissance'),
    memberTypeLetter: required(f.memberTypeLetter, 'Type de membre'),
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
      await addDoc(collection(db, 'membership_applications'), {
        firstName: form.firstName,
        lastName: form.lastName,
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        phone: form.phone,
        email: form.email,
        birthDate: form.birthDate,
        memberTypeLetter: form.memberTypeLetter,
        category: categoryLabel,
        city: form.city,
        cvFileName: form.cvFileName,
        status: 'pending',
        createdAt: serverTimestamp(),
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
    );
  }

  return (
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
            Rejoignez l'Association des Architectes de Jerba et participez activement à l'évolution
            de notre profession.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-12 bg-slate-50/50 p-8 md:p-14 border border-aaj-border"
          noValidate
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Informations Personnelles */}
            <div className="space-y-6">
              <h2 className="text-[10px] uppercase font-black tracking-[4px] text-aaj-royal mb-8 border-b border-aaj-border pb-2">
                Informations Personnelles
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="ma-first"
                    className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                  >
                    Prénom
                  </label>
                  <input
                    id="ma-first"
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    aria-invalid={!!errors.firstName}
                    className="w-full bg-white border border-aaj-border px-4 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal transition-all text-sm font-medium"
                    placeholder="Prénom"
                    required
                  />
                  {errors.firstName && <p className="text-xs text-red-600">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="ma-last"
                    className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                  >
                    Nom
                  </label>
                  <input
                    id="ma-last"
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    aria-invalid={!!errors.lastName}
                    className="w-full bg-white border border-aaj-border px-4 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal transition-all text-sm font-medium"
                    placeholder="Nom"
                    required
                  />
                  {errors.lastName && <p className="text-xs text-red-600">{errors.lastName}</p>}
                </div>
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
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  aria-invalid={!!errors.email}
                  className="w-full bg-white border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal transition-all text-sm font-medium"
                  placeholder="email@exemple.com"
                  required
                />
                {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="ma-birth"
                  className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                >
                  Date de Naissance
                </label>
                <input
                  id="ma-birth"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  aria-invalid={!!errors.birthDate}
                  className="w-full bg-white border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal transition-all text-sm font-medium"
                  required
                />
                {errors.birthDate && <p className="text-xs text-red-600">{errors.birthDate}</p>}
              </div>
            </div>

            {/* Profil Professionnel */}
            <div className="space-y-6">
              <h2 className="text-[10px] uppercase font-black tracking-[4px] text-aaj-royal mb-8 border-b border-aaj-border pb-2">
                Profil Professionnel
              </h2>

              <div className="space-y-2">
                <label
                  htmlFor="ma-type"
                  className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                >
                  Type de Membre
                </label>
                <select
                  id="ma-type"
                  value={form.memberTypeLetter}
                  onChange={(e) => setForm({ ...form, memberTypeLetter: e.target.value })}
                  className="w-full bg-white border border-aaj-border px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal transition-all text-sm font-bold uppercase tracking-widest cursor-pointer"
                  required
                >
                  {memberTypesList.map((t) => (
                    <option key={t.letter} value={t.letter}>
                      {t.label} ({t.letter})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="ma-city"
                  className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1"
                >
                  Ville de Résidence
                </label>
                <SearchableSelect
                  id="ma-city"
                  value={form.city}
                  onChange={(v) => setForm({ ...form, city: v })}
                  options={villesList}
                  placeholder="Sélectionner une délégation"
                  required
                />
                {errors.city && <p className="text-xs text-red-600">{errors.city}</p>}
              </div>

              <div className="bg-white border border-aaj-border/70 p-4 rounded flex items-start gap-3">
                <Info
                  size={16}
                  className="text-aaj-royal mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-tight leading-relaxed">
                  Votre matricule AAJ sera attribué automatiquement par l'administration lors de la
                  validation de votre demande.
                </p>
              </div>

              <div className="space-y-2 pt-2">
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
  );
};
