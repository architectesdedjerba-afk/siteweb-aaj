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
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  SendHorizonal,
  UserCircle,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
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
    if (hasErrors(errs)) {
      toast.error('Veuillez corriger les erreurs du formulaire.');
      return;
    }
    setSubmitting(true);
    try {
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
    setSubmitted(false);
    setShowRequestForm(false);
  };

  return (
    <div className="pt-16 min-h-screen bg-white">
      <header className="border-b border-aaj-border py-16">
        <div className="max-w-7xl mx-auto px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[3px] text-aaj-gray hover:text-aaj-dark transition-colors mb-8"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Accueil
          </Link>
          <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">
            Carrières & Stages
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-4 uppercase tracking-tighter text-aaj-dark">
            Emplois & Stages
          </h1>
          <p className="text-aaj-gray text-sm md:text-base max-w-2xl font-medium uppercase tracking-widest leading-relaxed">
            Offres publiées par les architectes adhérents et demandes émises par les candidats.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setShowRequestForm(true);
                setSubmitted(false);
              }}
              className="inline-flex items-center gap-2 bg-aaj-dark text-white px-6 py-3 rounded text-[11px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all"
            >
              <SendHorizonal size={14} aria-hidden="true" />
              Déposer une demande
            </button>
            <Link
              to="/espace-adherents"
              className="inline-flex items-center gap-2 border border-aaj-border text-aaj-dark px-6 py-3 rounded text-[11px] font-black uppercase tracking-widest hover:border-aaj-royal hover:text-aaj-royal transition-all"
            >
              <UserCircle size={14} aria-hidden="true" />
              Publier une offre (adhérent)
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="border border-aaj-border rounded p-6 flex items-center gap-4 bg-white">
            <div className="w-12 h-12 rounded bg-aaj-soft flex items-center justify-center text-aaj-royal">
              <Briefcase size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-black text-aaj-dark leading-none">{offerCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-aaj-gray mt-1">
                Offres publiées
              </p>
            </div>
          </div>
          <div className="border border-aaj-border rounded p-6 flex items-center gap-4 bg-white">
            <div className="w-12 h-12 rounded bg-aaj-soft flex items-center justify-center text-aaj-royal">
              <GraduationCap size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-black text-aaj-dark leading-none">{requestCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-aaj-gray mt-1">
                Demandes de candidats
              </p>
            </div>
          </div>
          <div className="border border-aaj-border rounded p-6 flex items-center gap-4 bg-white">
            <div className="w-12 h-12 rounded bg-aaj-soft flex items-center justify-center text-aaj-royal">
              <Clock size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-black text-aaj-dark leading-none">{items.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-aaj-gray mt-1">
                Total annonces
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center mb-10 pb-6 border-b border-aaj-border">
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
                  className={`inline-flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-[2px] rounded transition-all ${
                    active
                      ? 'bg-aaj-dark text-white'
                      : 'border border-aaj-border text-aaj-gray hover:border-aaj-dark hover:text-aaj-dark'
                  }`}
                >
                  {f.label}
                  <span className={`text-[9px] ${active ? 'text-white/70' : 'text-aaj-gray'}`}>
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
              className="bg-white border border-aaj-border rounded px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest"
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-aaj-gray"
              />
              <input
                type="search"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-64 pl-9 pr-3 py-2.5 border border-aaj-border rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-aaj-royal"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20" aria-live="polite">
            <Loader2 className="animate-spin text-aaj-royal" size={32} aria-label="Chargement" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 border border-dashed border-aaj-border rounded text-center bg-slate-50/50">
            <Briefcase size={40} className="mx-auto text-aaj-gray/40 mb-4" aria-hidden="true" />
            <p className="text-sm font-black uppercase tracking-widest text-aaj-gray">
              Aucune annonce ne correspond à votre recherche.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((it) => (
              <JobCard key={it.id} item={it} onOpen={() => setSelected(it)} />
            ))}
          </div>
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
              className="absolute inset-0 bg-aaj-dark/70 backdrop-blur-sm"
              aria-label="Fermer"
            />
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="relative bg-white w-full max-w-2xl rounded shadow-2xl my-8 overflow-hidden"
            >
              <div className="flex items-center justify-between px-8 py-5 border-b border-aaj-border bg-slate-50">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[3px] text-aaj-royal mb-1">
                    Espace Public
                  </p>
                  <h2 className="text-lg font-black uppercase tracking-tighter text-aaj-dark">
                    Déposer une demande
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={resetRequestForm}
                  className="p-2 text-aaj-gray hover:text-aaj-dark"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>
              {submitted ? (
                <div className="p-12 text-center">
                  <CheckCircle2
                    size={48}
                    className="mx-auto text-aaj-royal mb-6"
                    aria-hidden="true"
                  />
                  <h3 className="text-xl font-black uppercase tracking-tighter text-aaj-dark mb-3">
                    Demande envoyée
                  </h3>
                  <p className="text-aaj-gray text-sm font-medium uppercase tracking-widest mb-8 max-w-sm mx-auto leading-relaxed">
                    Elle sera publiée sur le tableau après validation par l&apos;AAJ.
                  </p>
                  <button
                    type="button"
                    onClick={resetRequestForm}
                    className="text-[10px] font-black uppercase tracking-[3px] text-aaj-dark border border-aaj-dark px-8 py-4 hover:bg-aaj-dark hover:text-white transition-all"
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
                      <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray ml-1">
                        Type recherché
                      </label>
                      <select
                        value={form.contractType}
                        onChange={(e) =>
                          setForm({ ...form, contractType: e.target.value as JobContractType })
                        }
                        className="w-full bg-white border border-aaj-border px-4 py-3 rounded text-xs font-bold uppercase tracking-widest"
                      >
                        {CONTRACT_TYPES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray ml-1">
                        Ville préférée
                      </label>
                      <SearchableSelect
                        value={form.city}
                        onChange={(v) => setForm({ ...form, city: v })}
                        options={villesList}
                        placeholder="Sélectionner"
                        required
                      />
                      {errors.city && <p className="text-xs text-red-600">{errors.city}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray ml-1">
                      Intitulé de la recherche
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Ex: Stage de fin d'études en architecture"
                      className="w-full bg-white border border-aaj-border px-4 py-3 rounded text-xs font-bold focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                    />
                    {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray ml-1">
                      Présentation / motivations
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={5}
                      placeholder="Compétences, niveau d'études, période, durée souhaitée…"
                      className="w-full bg-white border border-aaj-border px-4 py-3 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                    />
                    {errors.description && (
                      <p className="text-xs text-red-600">{errors.description}</p>
                    )}
                  </div>

                  <div className="border-t border-aaj-border pt-6 space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-royal">
                      Vos coordonnées
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray ml-1">
                          Nom complet
                        </label>
                        <input
                          type="text"
                          value={form.authorName}
                          onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                          className="w-full bg-white border border-aaj-border px-4 py-3 rounded text-xs font-bold focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                        />
                        {errors.authorName && (
                          <p className="text-xs text-red-600">{errors.authorName}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray ml-1">
                          Profil / Statut
                        </label>
                        <input
                          type="text"
                          value={form.authorRole}
                          onChange={(e) => setForm({ ...form, authorRole: e.target.value })}
                          placeholder="Ex: Étudiant en M2, Architecte junior…"
                          className="w-full bg-white border border-aaj-border px-4 py-3 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray ml-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={form.authorEmail}
                          onChange={(e) => setForm({ ...form, authorEmail: e.target.value })}
                          className="w-full bg-white border border-aaj-border px-4 py-3 rounded text-xs font-bold focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                        />
                        {errors.authorEmail && (
                          <p className="text-xs text-red-600">{errors.authorEmail}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray ml-1">
                          Téléphone (optionnel)
                        </label>
                        <input
                          type="tel"
                          value={form.authorPhone}
                          onChange={(e) => setForm({ ...form, authorPhone: e.target.value })}
                          placeholder="+216 ..."
                          className="w-full bg-white border border-aaj-border px-4 py-3 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                        />
                        {errors.authorPhone && (
                          <p className="text-xs text-red-600">{errors.authorPhone}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={resetRequestForm}
                      className="px-6 py-3 border border-aaj-border text-aaj-gray rounded text-[10px] font-black uppercase tracking-widest hover:border-aaj-dark hover:text-aaj-dark transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-3 bg-aaj-dark text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center gap-2 disabled:opacity-60"
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
  );
};

const JobCard = ({ item, onOpen }: { item: JobItem; onOpen: () => void }) => {
  const isOffer = item.kind === 'offer';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left border border-aaj-border rounded bg-white p-6 hover:border-aaj-royal hover:shadow-md transition-all group flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[2px] px-2.5 py-1 rounded border ${
            isOffer
              ? 'bg-aaj-soft text-aaj-royal border-aaj-royal/20'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {isOffer ? <Briefcase size={10} aria-hidden="true" /> : <GraduationCap size={10} aria-hidden="true" />}
          {isOffer ? 'Offre' : 'Demande'}
        </span>
        <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray border border-aaj-border px-2 py-0.5 rounded">
          {item.contractType}
        </span>
      </div>

      <h3 className="text-base font-black uppercase tracking-tight text-aaj-dark mb-3 group-hover:text-aaj-royal transition-colors line-clamp-2">
        {item.title}
      </h3>

      <p className="text-[12px] text-aaj-gray font-medium leading-relaxed mb-4 line-clamp-3 flex-1">
        {item.description}
      </p>

      <div className="space-y-2 text-[11px] font-bold text-aaj-gray uppercase tracking-tight">
        {item.company && (
          <div className="flex items-center gap-2">
            <Building2 size={12} className="text-aaj-royal" aria-hidden="true" />
            <span className="truncate">{item.company}</span>
          </div>
        )}
        {!item.company && item.authorName && (
          <div className="flex items-center gap-2">
            <UserCircle size={12} className="text-aaj-royal" aria-hidden="true" />
            <span className="truncate">{item.authorName}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <MapPin size={12} className="text-aaj-royal" aria-hidden="true" />
          <span>{item.city}</span>
        </div>
        {formatDate(item.createdAt) && (
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-aaj-royal" aria-hidden="true" />
            <span>{formatDate(item.createdAt)}</span>
          </div>
        )}
      </div>
    </button>
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
        className="absolute inset-0 bg-aaj-dark/70 backdrop-blur-sm"
        aria-label="Fermer"
      />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="relative bg-white w-full max-w-2xl rounded shadow-2xl my-8 overflow-hidden"
      >
        <div className="px-8 py-6 border-b border-aaj-border bg-slate-50 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[2px] px-2.5 py-1 rounded border ${
                  isOffer
                    ? 'bg-aaj-soft text-aaj-royal border-aaj-royal/20'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {isOffer ? 'Offre' : 'Demande'}
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray border border-aaj-border px-2.5 py-1 rounded">
                {item.contractType}
              </span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-aaj-dark">
              {item.title}
            </h2>
            <p className="text-[10px] font-bold text-aaj-gray uppercase tracking-widest mt-2">
              {item.city} · Publié le {formatDate(item.createdAt) || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-aaj-gray hover:text-aaj-dark"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-8 py-6 max-h-[70vh] overflow-y-auto space-y-6">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-royal mb-3">
              Description
            </h3>
            <p className="text-sm text-aaj-dark font-medium leading-relaxed whitespace-pre-wrap">
              {item.description}
            </p>
          </div>

          <div className="border-t border-aaj-border pt-6">
            <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-royal mb-3">
              Contact
            </h3>
            <div className="space-y-2 text-sm">
              {item.company && (
                <div className="flex items-center gap-3">
                  <Building2 size={14} className="text-aaj-royal" aria-hidden="true" />
                  <span className="font-bold uppercase tracking-tight">{item.company}</span>
                </div>
              )}
              {item.authorName && (
                <div className="flex items-center gap-3">
                  <UserCircle size={14} className="text-aaj-royal" aria-hidden="true" />
                  <span className="font-bold uppercase tracking-tight">
                    {item.authorName}
                    {item.authorRole ? ` · ${item.authorRole}` : ''}
                  </span>
                </div>
              )}
              {item.authorEmail && (
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-aaj-royal" aria-hidden="true" />
                  <a
                    href={`mailto:${item.authorEmail}`}
                    className="font-bold text-aaj-royal hover:underline"
                  >
                    {item.authorEmail}
                  </a>
                </div>
              )}
              {item.authorPhone && (
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-aaj-royal" aria-hidden="true" />
                  <a
                    href={`tel:${item.authorPhone}`}
                    className="font-bold text-aaj-royal hover:underline"
                  >
                    {item.authorPhone}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
