/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Loader2, ArrowLeft, Handshake } from "lucide-react";
import { Link } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useToast } from "../lib/toast";
import { email as vEmail, first, hasErrors, phone as vPhone, required, ValidationErrors } from "../lib/validation";

const ACTIVITIES = [
  "Matériaux de construction",
  "Second œuvre & Décoration",
  "Ingénierie & Conseil",
  "Services Financiers & Assurances",
  "Technologie & Domotique",
  "Autre",
] as const;

type SponsorshipType = "platine" | "or" | "argent" | "autre";

interface FormState {
  contactName: string;
  email: string;
  phone: string;
  companyName: string;
  activity: string;
  sponsorshipType: SponsorshipType;
  message: string;
}

export const PartnerApplicationPage = () => {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({
    contactName: "",
    email: "",
    phone: "",
    companyName: "",
    activity: "",
    sponsorshipType: "platine",
    message: "",
  });
  const [errors, setErrors] = useState<ValidationErrors<FormState>>({});

  const validate = (f: FormState): ValidationErrors<FormState> => ({
    contactName: required(f.contactName, "Nom & Prénom"),
    email: first(required(f.email, "Email"), vEmail(f.email)),
    phone: first(required(f.phone, "Téléphone"), vPhone(f.phone)),
    companyName: required(f.companyName, "Dénomination sociale"),
    activity: required(f.activity, "Secteur d'activité"),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (hasErrors(errs)) {
      toast.error("Veuillez corriger les erreurs du formulaire.");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "partner_applications"), {
        ...form,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      toast.success("Proposition reçue.");
    } catch (err) {
      console.error("Partner application error:", err);
      toast.error("Impossible d'envoyer la proposition. Réessayez plus tard.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="pt-24 min-h-screen flex items-center justify-center p-6 bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center p-12 border border-aaj-border rounded bg-slate-50"
        >
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
            <CheckCircle2 size={40} aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-black text-aaj-dark mb-4 uppercase tracking-tighter">Proposition reçue</h2>
          <p className="text-aaj-gray font-medium text-sm leading-relaxed mb-10">
            Merci de votre intérêt pour l'AAJ. Notre bureau des partenariats examinera votre demande et vous contactera dans les plus brefs délais.
          </p>
          <Link
            to="/"
            className="inline-block bg-aaj-dark text-white px-10 py-4 rounded text-[11px] font-black uppercase tracking-[3px] hover:bg-aaj-royal transition-all"
          >
            Retour à l'accueil
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen bg-white pb-24">
      <header className="border-b border-aaj-border py-16 bg-slate-50/50">
        <div className="max-w-3xl mx-auto px-6">
          <Link to="/partenaires" className="inline-flex items-center gap-2 text-[10px] font-black text-aaj-royal uppercase tracking-[2px] mb-8 hover:-translate-x-1 transition-transform">
            <ArrowLeft size={14} aria-hidden="true" /> Retour aux offres
          </Link>
          <h1 className="text-4xl md:text-5xl font-black mb-4 uppercase tracking-tighter leading-[0.9]">Devenir <br/><span className="text-aaj-royal">Partenaire</span></h1>
          <p className="text-aaj-gray text-xs md:text-sm font-bold uppercase tracking-[3px] opacity-70">Rejoignez l'écosystème AAJ</p>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 mt-16">
        <form onSubmit={handleSubmit} className="space-y-12" noValidate>

          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border border-aaj-border flex items-center justify-center text-aaj-royal font-black text-sm">01</div>
              <h2 className="text-sm font-black uppercase tracking-[4px] text-aaj-dark">Contact Référent</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label htmlFor="pa-name" className="text-[10px] font-black text-aaj-gray uppercase tracking-widest pl-1">Nom & Prénom</label>
                <input
                  id="pa-name"
                  required
                  type="text"
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  aria-invalid={!!errors.contactName}
                  className="w-full border-b border-aaj-border py-3 px-1 focus:outline-none focus:border-aaj-royal bg-transparent text-sm font-medium transition-colors"
                  placeholder="EX: MOHAMED BEN SALEM"
                />
                {errors.contactName && <p className="text-xs text-red-600">{errors.contactName}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="pa-phone" className="text-[10px] font-black text-aaj-gray uppercase tracking-widest pl-1">Téléphone</label>
                <input
                  id="pa-phone"
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  aria-invalid={!!errors.phone}
                  className="w-full border-b border-aaj-border py-3 px-1 focus:outline-none focus:border-aaj-royal bg-transparent text-sm font-medium transition-colors"
                  placeholder="+216 -- --- ---"
                />
                {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="pa-email" className="text-[10px] font-black text-aaj-gray uppercase tracking-widest pl-1">Email Professionnel</label>
                <input
                  id="pa-email"
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  aria-invalid={!!errors.email}
                  className="w-full border-b border-aaj-border py-3 px-1 focus:outline-none focus:border-aaj-royal bg-transparent text-sm font-medium transition-colors"
                  placeholder="NOM@ENTREPRISE.COM"
                />
                {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border border-aaj-border flex items-center justify-center text-aaj-royal font-black text-sm">02</div>
              <h2 className="text-sm font-black uppercase tracking-[4px] text-aaj-dark">L'Entreprise</h2>
            </div>

            <div className="space-y-8">
              <div className="space-y-2">
                <label htmlFor="pa-company" className="text-[10px] font-black text-aaj-gray uppercase tracking-widest pl-1">Dénomination Sociale</label>
                <input
                  id="pa-company"
                  required
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  aria-invalid={!!errors.companyName}
                  className="w-full border-b border-aaj-border py-3 px-1 focus:outline-none focus:border-aaj-royal bg-transparent text-sm font-medium transition-colors"
                  placeholder="NOM DE VOTRE SOCIÉTÉ"
                />
                {errors.companyName && <p className="text-xs text-red-600">{errors.companyName}</p>}
              </div>

              <fieldset className="space-y-4">
                <legend className="text-[10px] font-black text-aaj-gray uppercase tracking-widest pl-1">Secteur d'activité</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ACTIVITIES.map((field) => (
                    <label key={field} className="group cursor-pointer">
                      <div className="border border-aaj-border p-4 flex items-center gap-4 group-hover:border-aaj-royal group-hover:bg-slate-50 transition-all rounded">
                        <input
                          type="radio"
                          name="activity"
                          value={field}
                          checked={form.activity === field}
                          onChange={(e) => setForm({ ...form, activity: e.target.value })}
                          className="accent-aaj-royal"
                        />
                        <span className="text-[11px] font-bold uppercase tracking-tight text-aaj-dark">{field}</span>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.activity && <p className="text-xs text-red-600">{errors.activity}</p>}
              </fieldset>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border border-aaj-border flex items-center justify-center text-aaj-royal font-black text-sm">03</div>
              <h2 className="text-sm font-black uppercase tracking-[4px] text-aaj-dark">Partenariat</h2>
            </div>

            <div className="space-y-8">
              <div className="space-y-2">
                <label htmlFor="pa-type" className="text-[10px] font-black text-aaj-gray uppercase tracking-widest pl-1">Type de Sponsoring Souhaité</label>
                <select
                  id="pa-type"
                  value={form.sponsorshipType}
                  onChange={(e) => setForm({ ...form, sponsorshipType: e.target.value as SponsorshipType })}
                  className="w-full border-b border-aaj-border py-3 px-1 focus:outline-none focus:border-aaj-royal bg-transparent text-sm font-medium transition-colors"
                >
                  <option value="platine">PARTENARIAT PLATINE</option>
                  <option value="or">PARTENARIAT OR</option>
                  <option value="argent">PARTENARIAT ARGENT</option>
                  <option value="autre">AUTRE / SPÉCIFIQUE</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="pa-msg" className="text-[10px] font-black text-aaj-gray uppercase tracking-widest pl-1">Message ou Précisions</label>
                <textarea
                  id="pa-msg"
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full border border-aaj-border p-4 focus:outline-none focus:border-aaj-royal bg-transparent text-sm font-medium transition-colors rounded"
                  placeholder="Décrivez brièvement vos attentes ou votre proposition..."
                />
              </div>
            </div>
          </div>

          <button
            disabled={isSubmitting}
            type="submit"
            className="w-full bg-aaj-dark text-white py-6 rounded text-[12px] font-black uppercase tracking-[4px] hover:bg-aaj-royal transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={20} aria-hidden="true" />
            ) : (
              <>
                Soumettre la demande
                <Handshake size={20} className="group-hover:rotate-12 transition-transform" aria-hidden="true" />
              </>
            )}
          </button>

          <p className="text-[9px] text-center text-aaj-gray font-bold uppercase tracking-[2px]">
            En soumettant ce formulaire, vous acceptez d'être contacté par l'AAJ.
          </p>
        </form>
      </section>
    </div>
  );
};
