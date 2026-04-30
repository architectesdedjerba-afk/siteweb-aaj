/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Search,
  SendHorizonal,
  UserCircle,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  db,
} from '../lib/firebase';
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
import { DEFAULT_VILLES, loadVilles } from '../lib/memberConfig';
import { SearchableSelect } from '../components/SearchableSelect';
import { uploadFile } from '../lib/storage';
import {
  PageTransition,
  Reveal,
  Stagger,
  StaggerItem,
  GradientReveal,
  TiltCard,
  MagneticButton,
} from '../components/motion';

type JobKind = 'offer' | 'request';
type JobContractType = 'Stage' | 'CDI' | 'CDD' | 'Freelance' | 'Apprentissage' | 'Autre';

interface JobItem {
  id: string;
  kind: JobKind;
  contractType: JobContractType;
  title: string;
  description: string;
  city: string;
  company?: string;
  authorName?: string;
  authorEmail?: string;
  authorPhone?: string;
  authorRole?: string;
  status?: 'pending' | 'approved' | 'rejected';
  cvFileId?: string | null;
  cvFileName?: string | null;
  createdAt?: { toDate?: () => Date } | string;
}

type ListFilter = 'all' | 'offer' | 'request';

interface RequestForm {
  contractType: JobContractType;
  title: string;
  description: string;
  city: string;
  authorName: string;
  authorEmail: string;
  authorPhone: string;
  authorRole: string;
}

const CONTRACT_TYPES: JobContractType[] = [
  'Stage',
  'CDI',
  'CDD',
  'Freelance',
  'Apprentissage',
  'Autre',
];

const formatDate = (raw: any): string => {
  if (!raw) return '';
  try {
    const d = typeof raw?.toDate === 'function' ? raw.toDate() : new Date(raw);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
};

export const JobsPage = () => {
  const toast = useToast();
  const [items, setItems] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ListFilter>('all');
  const [contractFilter, setContractFilter] = useState<JobContractType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<JobItem | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [villesList, setVillesList] = useState<string[]>(DEFAULT_VILLES);

  const [form, setForm] = useState<RequestForm>({
    contractType: 'Stage',
    title: '',
    description: '',
    city: '',
    authorName: '',
    authorEmail: '',
    authorPhone: '',
    authorRole: '',
  });
  const [errors, setErrors] = useState<ValidationErrors<RequestForm>>({});
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB
  const isCvAccepted = (f: File) =>
    f.type === 'application/pdf' || f.type.startsWith('image/');

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setCvFile(null);
      setCvError(null);
      return;
    }
    if (!isCvAccepted(f)) {
      setCvError('Format non accepté. Seuls les PDF et les images sont autorisés.');
      setCvFile(null);
      if (cvInputRef.current) cvInputRef.current.value = '';
      return;
    }
    if (f.size > MAX_CV_BYTES) {
      setCvError('Fichier trop volumineux (10 Mo max).');
      setCvFile(null);
      if (cvInputRef.current) cvInputRef.current.value = '';
      return;
    }
    setCvError(null);
    setCvFile(f);
  };

  const removeCv = () => {
    setCvFile(null);
    setCvError(null);
    if (cvInputRef.current) cvInputRef.current.value = '';
  };

  useEffect(() => {
    loadVilles()
      .then(setVillesList)
      .catch(() => setVillesList(DEFAULT_VILLES));
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'jobs'),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as JobItem));
        setLoading(false);
      },
      (err) => {
        console.warn('Jobs subscription error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== 'all' && it.kind !== filter) return false;
      if (contractFilter !== 'all' && it.contractType !== contractFilter) return false;
      if (!term) return true;
      const hay = `${it.title} ${it.description} ${it.city} ${it.company ?? ''} ${it.authorRole ?? ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [items, filter, contractFilter, search]);

  const offerCount = items.filter((i) => i.kind === 'offer').length;
  const requestCount = items.filter((i) => i.kind === 'request').length;

  const validate = (f: RequestForm): ValidationErrors<RequestForm> => ({
    title: first(required(f.title, 'Titre'), maxLength(f.title, 120)),
    description: first(required(f.description, 'Description'), maxLength(f.description, 4000)),
    city: required(f.city, 'Ville'),
    authorName: first(required(f.authorName, 'Nom'), maxLength(f.authorName, 120)),
    authorEmail: first(required(f.authorEmail, 'Email'), vEmail(f.authorEmail)),
    authorPhone: f.authorPhone ? vPhone(f.authorPhone) : null,
    authorRole: maxLength(f.authorRole, 80),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (hasErrors(errs) || cvError) {
      toast.error('Veuillez corriger les erreurs du formulaire.');
      return;
    }
    setSubmitting(true);
    try {
      let cvFileId: string | null = null;
      let cvFileName: string | null = null;
      if (cvFile) {
        try {
          const up = await uploadFile(cvFile, 'jobs_cv');
          cvFileId = up.path;
          cvFileName = cvFile.name;
        } catch (err) {
          console.error('CV upload error:', err);
          toast.error("Échec de l'envoi du CV. Réessayez.");
          setSubmitting(false);
          return;
        }
      }
      await addDoc(collection(db, 'jobs'), {
        kind: 'request',
        contractType: form.contractType,
        title: form.title.trim(),
        description: form.description.trim(),
        city: form.city,
        authorName: form.authorName.trim(),
        authorEmail: form.authorEmail.trim(),
        authorPhone: form.authorPhone.trim(),
        authorRole: form.authorRole.trim(),
        cvFileId,
        cvFileName,
        source: 'public',
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      toast.success('Votre demande a été transmise. Elle sera publiée après validation.');
    } catch (err) {
      console.error('Job request submit error:', err);
      toast.error("Impossible d'envoyer la demande. Réessayez plus tard.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetRequestForm = () => {
    setForm({
      contractType: 'Stage',
      title: '',
      description: '',
      city: '',
      authorName: '',
      authorEmail: '',
      authorPhone: '',
      authorRole: '',
    });
    setErrors({});
    setCvFile(null);
    setCvError(null);
    if (cvInputRef.current) cvInputRef.current.value = '';
    setSubmitted(false);
    setShowRequestForm(false);
  };

  return (
    <PageTransition>
      <div className="aaj-dark-surface min-h-screen pt-24">
        <header className="relative max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-24">
          <Reveal>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[3px] text-white/50 hover:text-aaj-cyan transition-colors mb-10 aaj-link-underline"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Accueil
            </Link>
          </Reveal>
          <Reveal>
            <div className="inline-flex items-center gap-3 mb-6">
              <span className="w-10 h-px bg-aaj-cyan" aria-hidden="true" />
              <span className="text-[10px] uppercase tracking-[5px] text-aaj-cyan font-black">
                Carrières & Stages
              </span>
            </div>
          </Reveal>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95] text-balance">
            <GradientReveal
              as="span"
              text="Emplois & Stages"
              className="inline-block aaj-text-gradient-vibrant"
            />
          </h1>
          <Reveal delay={0.4} className="mt-8 max-w-2xl">
            <p className="text-base md:text-lg text-white/70 leading-relaxed">
              Offres publiées par les architectes adhérents et demandes émises par les candidats.
            </p>
          </Reveal>

          <Reveal delay={0.6} className="mt-12 flex flex-wrap gap-3">
            <MagneticButton as="div" strength={0.25}>
              <button
                type="button"
                onClick={() => {
                  setShowRequestForm(true);
                  setSubmitted(false);
                }}
                className="inline-flex items-center gap-2 bg-aaj-cyan text-aaj-night px-7 py-4 rounded-full text-[11px] font-black uppercase tracking-[3px] hover:bg-white transition-colors shadow-[0_0_30px_rgba(0,229,255,0.35)]"
              >
                <SendHorizonal size={14} aria-hidden="true" />
                Déposer une demande
              </button>
            </MagneticButton>
            <MagneticButton as="div" strength={0.2}>
              <Link
                to="/espace-adherents"
                className="inline-flex items-center gap-2 border border-white/20 text-white px-7 py-4 rounded-full text-[11px] font-black uppercase tracking-[3px] hover:border-aaj-cyan hover:text-aaj-cyan transition-all"
              >
                <UserCircle size={14} aria-hidden="true" />
                Publier une offre (adhérent)
              </Link>
            </MagneticButton>
          </Reveal>
        </header>

        <section className="max-w-7xl mx-auto px-6 md:px-10 py-12 md:py-16">
          {/* Stats strip */}
          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <StaggerItem>
              <TiltCard max={4} className="aaj-glass rounded-2xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-aaj-cyan/15 border border-aaj-cyan/30 flex items-center justify-center text-aaj-cyan">
                  <Briefcase size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-display text-3xl font-bold text-white tracking-tighter leading-none">{offerCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mt-1">
                    Offres publiées
                  </p>
                </div>
              </TiltCard>
            </StaggerItem>
            <StaggerItem>
              <TiltCard max={4} className="aaj-glass rounded-2xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-aaj-amber/15 border border-aaj-amber/30 flex items-center justify-center text-aaj-amber">
                  <GraduationCap size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-display text-3xl font-bold text-white tracking-tighter leading-none">{requestCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mt-1">
                    Demandes de candidats
                  </p>
                </div>
              </TiltCard>
            </StaggerItem>
            <StaggerItem>
              <TiltCard max={4} className="aaj-glass rounded-2xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-aaj-electric/15 border border-aaj-electric/30 flex items-center justify-center text-aaj-electric">
                  <Clock size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-display text-3xl font-bold text-white tracking-tighter leading-none">{items.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mt-1">
                    Total annonces
                  </p>
                </div>
              </TiltCard>
            </StaggerItem>
          </Stagger>

          {/* Filter bar */}
          <Reveal>
            <div className="flex flex-col md:flex-row gap-3 md:items-center mb-12 pb-8 border-b border-white/10">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer">
                {([
                  { key: 'all', label: 'Tous', count: items.length },
                  { key: 'offer', label: 'Offres', count: offerCount },
                  { key: 'request', label: 'Demandes', count: requestCount },
                ] as { key: ListFilter; label: string; count: number }[]).map((f) => {
                  const active = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(f.key)}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-[2.5px] rounded-full transition-all ${
                        active
                          ? 'bg-aaj-cyan text-aaj-night shadow-[0_0_20px_rgba(0,229,255,0.4)]'
                          : 'border border-white/15 text-white/60 hover:border-aaj-cyan hover:text-white'
                      }`}
                    >
                      {f.label}
                      <span className={`text-[9px] ${active ? 'text-aaj-night/70' : 'text-white/40'}`}>
                        ({f.count})
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="md:ml-auto flex flex-col md:flex-row gap-3 md:items-center">
                <select
                  value={contractFilter}
                  onChange={(e) => setContractFilter(e.target.value as any)}
                  className="bg-aaj-deep border border-white/15 text-white rounded-full px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:border-aaj-cyan"
                >
                  <option value="all">Tous les types</option>
                  {CONTRACT_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Search
                    size={14}
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
                  />
                  <input
                    type="search"
                    placeholder="Rechercher…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full md:w-64 pl-10 pr-4 py-2.5 bg-aaj-deep border border-white/15 text-white rounded-full text-xs font-medium focus:outline-none focus:border-aaj-cyan placeholder:text-white/30"
                  />
                </div>
              </div>
            </div>
          </Reveal>

          {loading ? (
            <div className="flex justify-center py-20" aria-live="polite">
              <Loader2 className="animate-spin text-aaj-cyan" size={32} aria-label="Chargement" />
            </div>
          ) : filtered.length === 0 ? (
            <Reveal>
              <div className="p-16 rounded-2xl border border-dashed border-white/15 text-center aaj-glass">
                <Briefcase size={40} className="mx-auto text-white/30 mb-4" aria-hidden="true" />
                <p className="text-sm font-black uppercase tracking-widest text-white/60">
                  Aucune annonce ne correspond à votre recherche.
                </p>
              </div>
            </Reveal>
          ) : (
            <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((it) => (
                <StaggerItem key={it.id}>
                  <JobCard item={it} onOpen={() => setSelected(it)} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </section>

        <AnimatePresence>
          {selected && <JobDetailModal item={selected} onClose={() => setSelected(null)} />}
        </AnimatePresence>

        <AnimatePresence>
          {showRequestForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-start md:items-center justify-center p-4 overflow-y-auto"
            >
              <button
                type="button"
                onClick={resetRequestForm}
                className="absolute inset-0 bg-aaj-night/85 backdrop-blur-md"
                aria-label="Fermer"
              />
              <motion.div
                initial={{ y: 30, opacity: 0, scale: 0.97 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 30, opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="relative bg-aaj-deep w-full max-w-2xl rounded-3xl border border-white/10 shadow-[0_0_60px_rgba(0,229,255,0.15)] my-8 overflow-hidden"
              >
                <div className="flex items-center justify-between px-8 py-6 border-b border-white/10 bg-gradient-to-br from-aaj-cyan/5 to-transparent">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[3px] text-aaj-cyan mb-1">
                      Espace Public
                    </p>
                    <h2 className="font-display text-2xl font-bold text-white tracking-tighter">
                      Déposer une demande
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={resetRequestForm}
                    className="w-10 h-10 rounded-full border border-white/15 text-white/60 hover:text-aaj-cyan hover:border-aaj-cyan flex items-center justify-center transition-all"
                    aria-label="Fermer"
                  >
                    <X size={16} />
                  </button>
                </div>
                {submitted ? (
                  <div className="p-12 text-center">
                    <CheckCircle2
                      size={56}
                      className="mx-auto text-aaj-cyan mb-6"
                      aria-hidden="true"
                    />
                    <h3 className="font-display text-2xl font-bold text-white tracking-tighter mb-3">
                      Demande envoyée
                    </h3>
                    <p className="text-white/60 text-sm font-medium uppercase tracking-widest mb-8 max-w-sm mx-auto leading-relaxed">
                      Elle sera publiée sur le tableau après validation par l&apos;AAJ.
                    </p>
                    <button
                      type="button"
                      onClick={resetRequestForm}
                      className="text-[10px] font-black uppercase tracking-[3px] bg-aaj-cyan text-aaj-night px-8 py-4 rounded-full hover:bg-white transition-colors"
                    >
                      Fermer
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="px-8 py-8 space-y-6 max-h-[80vh] overflow-y-auto"
                    noValidate
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[2.5px] text-white/50 ml-1">
                          Type recherché
                        </label>
                        <select
                          value={form.contractType}
                          onChange={(e) =>
                            setForm({ ...form, contractType: e.target.value as JobContractType })
                          }
                          className="w-full bg-aaj-night border border-white/15 text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-aaj-cyan"
                        >
                          {CONTRACT_TYPES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[2.5px] text-white/50 ml-1">
                          Ville préférée
                        </label>
                        <SearchableSelect
                          value={form.city}
                          onChange={(v) => setForm({ ...form, city: v })}
                          options={villesList}
                          placeholder="Sélectionner"
                          required
                        />
                        {errors.city && <p className="text-xs text-aaj-magenta">{errors.city}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[2.5px] text-white/50 ml-1">
                        Intitulé de la recherche
                      </label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="Ex: Stage de fin d'études en architecture"
                        className="w-full bg-aaj-night border border-white/15 text-white px-4 py-3 rounded-xl text-xs font-bold focus:outline-none focus:border-aaj-cyan placeholder:text-white/30"
                      />
                      {errors.title && <p className="text-xs text-aaj-magenta">{errors.title}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[2.5px] text-white/50 ml-1">
                        Présentation / motivations
                      </label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        rows={5}
                        placeholder="Compétences, niveau d'études, période, durée souhaitée…"
                        className="w-full bg-aaj-night border border-white/15 text-white px-4 py-3 rounded-xl text-xs font-medium focus:outline-none focus:border-aaj-cyan placeholder:text-white/30"
                      />
                      {errors.description && (
                        <p className="text-xs text-aaj-magenta">{errors.description}</p>
                      )}
                    </div>

                    <div className="border-t border-white/10 pt-6 space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-cyan">
                        Vos coordonnées
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[2.5px] text-white/50 ml-1">
                            Nom complet
                          </label>
                          <input
                            type="text"
                            value={form.authorName}
                            onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                            className="w-full bg-aaj-night border border-white/15 text-white px-4 py-3 rounded-xl text-xs font-bold focus:outline-none focus:border-aaj-cyan placeholder:text-white/30"
                          />
                          {errors.authorName && (
                            <p className="text-xs text-aaj-magenta">{errors.authorName}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[2.5px] text-white/50 ml-1">
                            Profil / Statut
                          </label>
                          <input
                            type="text"
                            value={form.authorRole}
                            onChange={(e) => setForm({ ...form, authorRole: e.target.value })}
                            placeholder="Ex: Étudiant en M2, Architecte junior…"
                            className="w-full bg-aaj-night border border-white/15 text-white px-4 py-3 rounded-xl text-xs font-medium focus:outline-none focus:border-aaj-cyan placeholder:text-white/30"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[2.5px] text-white/50 ml-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={form.authorEmail}
                            onChange={(e) => setForm({ ...form, authorEmail: e.target.value })}
                            className="w-full bg-aaj-night border border-white/15 text-white px-4 py-3 rounded-xl text-xs font-bold focus:outline-none focus:border-aaj-cyan placeholder:text-white/30"
                          />
                          {errors.authorEmail && (
                            <p className="text-xs text-aaj-magenta">{errors.authorEmail}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[2.5px] text-white/50 ml-1">
                            Téléphone (optionnel)
                          </label>
                          <input
                            type="tel"
                            value={form.authorPhone}
                            onChange={(e) => setForm({ ...form, authorPhone: e.target.value })}
                            placeholder="+216 ..."
                            className="w-full bg-aaj-night border border-white/15 text-white px-4 py-3 rounded-xl text-xs font-medium focus:outline-none focus:border-aaj-cyan placeholder:text-white/30"
                          />
                          {errors.authorPhone && (
                            <p className="text-xs text-aaj-magenta">{errors.authorPhone}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-6 space-y-3">
                      <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-cyan">
                        CV / Portfolio (optionnel)
                      </h3>
                      <p className="text-[11px] text-white/50 font-medium leading-relaxed">
                        Joignez un PDF ou une image (10 Mo max). Visible uniquement par les
                        adhérents et l&apos;administration après validation.
                      </p>
                      <input
                        ref={cvInputRef}
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={handleCvChange}
                        className="hidden"
                        id="job-request-cv"
                      />
                      {cvFile ? (
                        <div className="flex items-center gap-3 border border-white/15 rounded-xl px-4 py-3 bg-aaj-night/60">
                          <FileText size={16} className="text-aaj-cyan shrink-0" aria-hidden="true" />
                          <span className="text-xs font-bold text-white truncate flex-1">
                            {cvFile.name}
                          </span>
                          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                            {(cvFile.size / 1024).toFixed(0)} Ko
                          </span>
                          <button
                            type="button"
                            onClick={removeCv}
                            className="p-1 text-white/50 hover:text-aaj-magenta transition-colors"
                            aria-label="Retirer le fichier"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="job-request-cv"
                          className="inline-flex items-center gap-2 border border-dashed border-white/20 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white/60 hover:border-aaj-cyan hover:text-aaj-cyan cursor-pointer transition-all"
                        >
                          <Paperclip size={14} aria-hidden="true" />
                          Choisir un fichier
                        </label>
                      )}
                      {cvError && <p className="text-xs text-aaj-magenta">{cvError}</p>}
                    </div>

                    <div className="pt-4 flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={resetRequestForm}
                        className="px-6 py-3 border border-white/15 text-white/60 rounded-full text-[10px] font-black uppercase tracking-widest hover:border-white hover:text-white transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-7 py-3 bg-aaj-cyan text-aaj-night rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2 disabled:opacity-60 shadow-[0_0_20px_rgba(0,229,255,0.4)]"
                      >
                        {submitting ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <SendHorizonal size={14} aria-hidden="true" />
                        )}
                        Envoyer
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
};

const JobCard = ({ item, onOpen }: { item: JobItem; onOpen: () => void }) => {
  const isOffer = item.kind === 'offer';
  return (
    <TiltCard max={6} className="h-full">
      <button
        type="button"
        onClick={onOpen}
        className="text-left aaj-glass rounded-2xl p-6 hover:border-aaj-cyan/40 transition-colors group flex flex-col h-full w-full"
      >
        <div className="flex items-center justify-between mb-4">
          <span
            className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[2px] px-3 py-1 rounded-full border ${
              isOffer
                ? 'bg-aaj-cyan/10 text-aaj-cyan border-aaj-cyan/30'
                : 'bg-aaj-amber/10 text-aaj-amber border-aaj-amber/30'
            }`}
          >
            {isOffer ? <Briefcase size={10} aria-hidden="true" /> : <GraduationCap size={10} aria-hidden="true" />}
            {isOffer ? 'Offre' : 'Demande'}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/50 border border-white/15 px-2.5 py-0.5 rounded-full">
            {item.contractType}
          </span>
        </div>

        <h3 className="font-display text-lg md:text-xl font-bold text-white tracking-tight mb-3 group-hover:text-aaj-cyan transition-colors line-clamp-2">
          {item.title}
        </h3>

        <p className="text-[12px] text-white/60 font-medium leading-relaxed mb-5 line-clamp-3 flex-1">
          {item.description}
        </p>

        <div className="space-y-2 text-[11px] font-bold text-white/70 uppercase tracking-tight pt-4 border-t border-white/10">
          {item.company && (
            <div className="flex items-center gap-2">
              <Building2 size={12} className="text-aaj-cyan shrink-0" aria-hidden="true" />
              <span className="truncate">{item.company}</span>
            </div>
          )}
          {!item.company && item.authorName && (
            <div className="flex items-center gap-2">
              <UserCircle size={12} className="text-aaj-cyan shrink-0" aria-hidden="true" />
              <span className="truncate">{item.authorName}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <MapPin size={12} className="text-aaj-cyan shrink-0" aria-hidden="true" />
            <span>{item.city}</span>
          </div>
          {formatDate(item.createdAt) && (
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-aaj-cyan shrink-0" aria-hidden="true" />
              <span>{formatDate(item.createdAt)}</span>
            </div>
          )}
        </div>
      </button>
    </TiltCard>
  );
};

const JobDetailModal = ({ item, onClose }: { item: JobItem; onClose: () => void }) => {
  const isOffer = item.kind === 'offer';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-start md:items-center justify-center p-4 overflow-y-auto"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-aaj-night/85 backdrop-blur-md"
        aria-label="Fermer"
      />
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative bg-aaj-deep w-full max-w-2xl rounded-3xl border border-white/10 shadow-[0_0_60px_rgba(0,229,255,0.15)] my-8 overflow-hidden"
      >
        <div className="px-8 py-6 border-b border-white/10 bg-gradient-to-br from-aaj-cyan/5 to-transparent flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[2px] px-3 py-1 rounded-full border ${
                  isOffer
                    ? 'bg-aaj-cyan/10 text-aaj-cyan border-aaj-cyan/30'
                    : 'bg-aaj-amber/10 text-aaj-amber border-aaj-amber/30'
                }`}
              >
                {isOffer ? 'Offre' : 'Demande'}
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/50 border border-white/15 px-3 py-1 rounded-full">
                {item.contractType}
              </span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tighter">
              {item.title}
            </h2>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-3">
              {item.city} · Publié le {formatDate(item.createdAt) || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 shrink-0 rounded-full border border-white/15 text-white/60 hover:text-aaj-cyan hover:border-aaj-cyan flex items-center justify-center transition-all"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-8 py-6 max-h-[70vh] overflow-y-auto space-y-6">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-cyan mb-3">
              Description
            </h3>
            <p className="text-sm text-white/80 font-medium leading-relaxed whitespace-pre-wrap">
              {item.description}
            </p>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-cyan mb-3">
              Contact
            </h3>
            <div className="space-y-3 text-sm">
              {item.company && (
                <div className="flex items-center gap-3">
                  <Building2 size={14} className="text-aaj-cyan" aria-hidden="true" />
                  <span className="font-bold uppercase tracking-tight text-white">{item.company}</span>
                </div>
              )}
              {item.authorName && (
                <div className="flex items-center gap-3">
                  <UserCircle size={14} className="text-aaj-cyan" aria-hidden="true" />
                  <span className="font-bold uppercase tracking-tight text-white">
                    {item.authorName}
                    {item.authorRole ? ` · ${item.authorRole}` : ''}
                  </span>
                </div>
              )}
              {item.authorEmail && (
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-aaj-cyan" aria-hidden="true" />
                  <a
                    href={`mailto:${item.authorEmail}`}
                    className="font-bold text-aaj-cyan hover:text-white transition-colors aaj-link-underline"
                  >
                    {item.authorEmail}
                  </a>
                </div>
              )}
              {item.authorPhone && (
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-aaj-cyan" aria-hidden="true" />
                  <a
                    href={`tel:${item.authorPhone}`}
                    className="font-bold text-aaj-cyan hover:text-white transition-colors aaj-link-underline"
                  >
                    {item.authorPhone}
                  </a>
                </div>
              )}
              {item.cvFileId && (
                <div className="flex items-center gap-3">
                  <FileText size={14} className="text-aaj-cyan" aria-hidden="true" />
                  <a
                    href={`/api/files/${encodeURIComponent(item.cvFileId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-aaj-cyan hover:text-white transition-colors aaj-link-underline"
                  >
                    {item.cvFileName || 'CV / Portfolio'}
                  </a>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                    Réservé adhérents
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
