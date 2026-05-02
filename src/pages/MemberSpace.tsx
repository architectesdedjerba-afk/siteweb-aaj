/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useRef, Fragment, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import {
  UserCircle,
  LogOut,
  FileText,
  Settings,
  Shield,
  LayoutDashboard,
  Loader2,
  Users,
  Building2,
  Upload,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  Plus,
  BookOpen,
  Camera,
  Save,
  MessageSquare,
  List,
  Grid,
  Trash2,
  Pencil,
  PlusCircle,
  Download,
  FileSpreadsheet,
  FileCode,
  Send,
  X,
  KeyRound,
  Search,
  MessagesSquare,
  Landmark,
  MapPinned,
  ClipboardList,
  Pin,
  PinOff,
  PanelLeftOpen,
  Eye,
  Archive,
  ArchiveRestore,
  Bell,
  SlidersHorizontal,
  Briefcase,
  GraduationCap,
  Clock,
  Calendar,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import {
  // auth API
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  changePassword,
  adminCreateAccount,
  type User,
  // firestore-shaped API
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  setDoc,
  where,
  // singletons
  auth,
  db,
} from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import {
  PageTransition,
  Reveal,
  MagneticButton,
  ParticleField,
  GradientReveal,
} from '../components/motion';
import type { Role } from '../types';
import {
  PERMISSION_GROUPS,
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLES,
  sanitizeRoleId,
} from '../lib/permissions';
import {
  COMMISSION_COLORS_DOC_PATH,
  COMMISSION_TYPES_DOC_PATH,
  DEFAULT_COMMISSION_COLORS,
  DEFAULT_COMMISSION_TYPES,
  DEFAULT_MEMBER_TYPES,
  DEFAULT_NEWS_CATEGORIES,
  DEFAULT_VILLES,
  MEMBER_TYPES_DOC_PATH,
  NEWS_CATEGORIES_DOC_PATH,
  VILLES_DOC_PATH,
  buildMatricule,
  colorForTown,
  computeNextIndex,
  newsCategoryStyle,
  saveCommissionColors,
  saveCommissionTypes,
  saveMemberTypes,
  saveNewsCategories,
  saveVilles,
  type MemberType,
} from '../lib/memberConfig';
// Composants lourds chargés paresseusement — chacun se retrouve dans son
// propre chunk, ce qui retire ~plusieurs centaines de KB du bundle initial
// de MemberSpace. Chaque usage est enveloppé dans un <Suspense
// fallback={<TabLoader />}> au point d'utilisation.
const CommissionCalendar = lazy(() => import('../components/CommissionCalendar'));
import FilePreview, { type PreviewFile } from '../components/FilePreview';
import { imagesToPdfBlob } from '../lib/imagesToPdf';
import { NewsPostCard } from '../components/NewsPostCard';
import { PasswordInput } from '../components/PasswordInput';
import { NotificationSettingsPanel } from '../components/NotificationSettingsPanel';
import { DocumentThumbnail } from '../components/DocumentThumbnail';
import { uploadFile, deleteFile } from '../lib/storage';
import { SearchableSelect } from '../components/SearchableSelect';
import { PhotoCropperModal } from '../components/PhotoCropperModal';
const ChannelApprovals = lazy(() =>
  import('../components/chat/ChannelApprovals').then((m) => ({ default: m.ChannelApprovals }))
);
const ChatFloatingWidget = lazy(() =>
  import('../components/chat/ChatFloatingWidget').then((m) => ({ default: m.ChatFloatingWidget }))
);
import { useChatBadge } from '../lib/useChat';
const UnescoMemberView = lazy(() =>
  import('../components/unesco/UnescoMemberView').then((m) => ({ default: m.UnescoMemberView }))
);
const UnescoAdminParams = lazy(() =>
  import('../components/unesco/UnescoAdminParams').then((m) => ({ default: m.UnescoAdminParams }))
);
const UnescoAdminRequests = lazy(() =>
  import('../components/unesco/UnescoAdminRequests').then((m) => ({
    default: m.UnescoAdminRequests,
  }))
);
// Page-content editors (admin only) — tab-gated, also lazy.
const HomePageEditor = lazy(() =>
  import('../components/admin/PageContentEditors').then((m) => ({ default: m.HomePageEditor }))
);
const AboutPageEditor = lazy(() =>
  import('../components/admin/PageContentEditors').then((m) => ({ default: m.AboutPageEditor }))
);
const PartnersPageEditor = lazy(() =>
  import('../components/admin/PageContentEditors').then((m) => ({ default: m.PartnersPageEditor }))
);
import { api as apiClient } from '../lib/api';
import { useNotifications } from '../lib/NotificationContext';
const NotificationsList = lazy(() =>
  import('../components/notifications/NotificationsList').then((m) => ({
    default: m.NotificationsList,
  }))
);
const NotificationPreferences = lazy(() =>
  import('../components/notifications/NotificationPreferences').then((m) => ({
    default: m.NotificationPreferences,
  }))
);

/**
 * Petit fallback affiché pendant le chargement async d'un onglet/composant
 * lourd. Hauteur volontairement modeste — pour les vues chat, calendar,
 * UNESCO, notif. Le `aria-live="polite"` permet aux lecteurs d'écran
 * d'annoncer le chargement.
 */
const TabLoader = () => (
  <div
    className="flex items-center justify-center py-12"
    role="status"
    aria-live="polite"
  >
    <Loader2 className="animate-spin text-aaj-royal" size={24} aria-label="Chargement" />
  </div>
);

/**
 * Compact stat block (label + colored count) used inside dashboard cards
 * such as the UNESCO requests management card.
 */
const DASH_STAT_TONES: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  slate: 'bg-slate-50 text-slate-700 border-slate-200',
};
const DashStat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof DASH_STAT_TONES;
}) => (
  <div
    className={`px-3 py-2 border rounded text-center min-w-[88px] ${DASH_STAT_TONES[tone] ?? DASH_STAT_TONES.slate}`}
  >
    <div className="text-2xl font-black tabular-nums leading-none">{value}</div>
    <div className="text-[9px] font-black uppercase tracking-[2px] mt-1">{label}</div>
  </div>
);

/**
 * Format a contact-message reply timestamp. The firebase shim wraps `*At`
 * fields in {seconds, toDate()}; the optimistic-update path right after a
 * POST puts the raw ISO string from the API. Accept either, return ' • DD/MM/YYYY HH:MM'.
 */
const formatReplyTimestamp = (raw: any): string => {
  if (!raw) return '';
  let d: Date | null = null;
  if (typeof raw === 'string') d = new Date(raw);
  else if (typeof raw?.toDate === 'function') d = raw.toDate();
  if (!d || isNaN(d.getTime())) return '';
  return (
    ' • ' +
    d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );
};

export const MemberSpacePage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchParams, setSearchParams] = useSearchParams();
  const { unreadCount: notifUnreadCount } = useNotifications();
  const [isSaving, setIsSaving] = useState(false);
  const [annuaireViewMode, setAnnuaireViewMode] = useState<'grid' | 'list'>('grid');
  const [editingMember, setEditingMember] = useState<any>(null);
  const [editSelectedYears, setEditSelectedYears] = useState<string[]>([]);
  const [editBulkAmount, setEditBulkAmount] = useState<string>('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [rolesSearch, setRolesSearch] = useState('');
  const [rolesRoleFilter, setRolesRoleFilter] = useState<string>('all');
  const [rolesUpdatingUid, setRolesUpdatingUid] = useState<string | null>(null);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({ name: '', description: '' });
  const [resetSent, setResetSent] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [libraryDocs, setLibraryDocs] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showArchivedMembers, setShowArchivedMembers] = useState(false);
  // Filtres "Gestion des Adhésions"
  const [adminMembersSearch, setAdminMembersSearch] = useState('');
  const [adminMembersStatusFilter, setAdminMembersStatusFilter] = useState<
    'all' | 'active' | 'suspended'
  >('all');
  const [adminMembersCotisationFilter, setAdminMembersCotisationFilter] = useState<
    'all' | 'paid' | 'unpaid'
  >('all');
  const [adminMembersCategoryFilter, setAdminMembersCategoryFilter] = useState<string>('all');
  const [adminMembersCityFilter, setAdminMembersCityFilter] = useState<string>('all');
  const [adminMembersSort, setAdminMembersSort] = useState<{
    key: 'name' | 'status' | 'cotisation';
    dir: 'asc' | 'desc';
  }>({ key: 'name', dir: 'asc' });
  const [profileRequests, setProfileRequests] = useState<any[]>([]);
  const [membershipApplications, setMembershipApplications] = useState<any[]>([]);
  const [approvingApplicationId, setApprovingApplicationId] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [pendingUserRequests, setPendingUserRequests] = useState<any[]>([]);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [commissionPVs, setCommissionPVs] = useState<any[]>([]);
  const [jobItems, setJobItems] = useState<any[]>([]);
  const [jobsTabFilter, setJobsTabFilter] = useState<'all' | 'offer' | 'request'>('all');
  const [jobDetail, setJobDetail] = useState<any | null>(null);
  const [newJob, setNewJob] = useState<{
    contractType: string;
    title: string;
    description: string;
    city: string;
    company: string;
    contactEmail: string;
    contactPhone: string;
  }>({
    contractType: 'CDI',
    title: '',
    description: '',
    city: 'Houmt Souk',
    company: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null);
  const [libraryFilterCommune, setLibraryFilterCommune] = useState<string>('Toutes');
  const [libraryFilterLegal, setLibraryFilterLegal] = useState<string>('Tous');
  const [showNewsHistory, setShowNewsHistory] = useState(false);
  const [selectedNews, setSelectedNews] = useState<any | null>(null);
  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [partnersViewMode, setPartnersViewMode] = useState<'grid' | 'list'>('grid');
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ subject: '', message: '' });
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<null | {
    matricule: string;
    email: string;
    tempPassword?: string;
    emailSent: boolean;
    mode: 'created' | 'approved';
  }>(null);
  const [credentialsCopied, setCredentialsCopied] = useState<'all' | 'pwd' | null>(null);
  const [mailTest, setMailTest] = useState<{
    to: string;
    sending: boolean;
    result: null | {
      ok: boolean;
      tcpOk: boolean | null;
      elapsedMs: number;
      smtp: {
        host: string;
        port: number;
        encryption: string;
        from_email: string;
        from_name: string;
        has_password: boolean;
      };
      log: string[];
    };
    error: string | null;
  }>({ to: '', sending: false, result: null, error: null });
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [userMessages, setUserMessages] = useState<any[]>([]);
  // Inline reply form state (admin → contact_message author)
  const [replyingMessageId, setReplyingMessageId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [newContactFile, setNewContactFile] = useState({ base64: '', name: '' });
  const contactFileInputRef = useRef<HTMLInputElement>(null);
  const [newMember, setNewMember] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    category: 'Architecte',
    memberTypeLetter: 'A',
    birthDate: '',
    matricule: '',
    city: 'Houmt Souk',
  });
  const [villesList, setVillesList] = useState<string[]>(DEFAULT_VILLES);
  const [newsCategoriesList, setNewsCategoriesList] = useState<string[]>(DEFAULT_NEWS_CATEGORIES);
  const [newNewsCategoryInput, setNewNewsCategoryInput] = useState('');
  const [memberTypesList, setMemberTypesList] = useState<MemberType[]>(DEFAULT_MEMBER_TYPES);
  const [commissionColors, setCommissionColors] = useState<Record<string, string>>(
    () => ({ ...DEFAULT_COMMISSION_COLORS })
  );
  const [colorDrafts, setColorDrafts] = useState<Record<string, string>>({});
  const [commissionTypesList, setCommissionTypesList] =
    useState<string[]>(DEFAULT_COMMISSION_TYPES);
  const [newCommissionTypeInput, setNewCommissionTypeInput] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [newVilleInput, setNewVilleInput] = useState('');
  const [newTypeInput, setNewTypeInput] = useState({ letter: '', label: '' });
  const [editingTypeLetter, setEditingTypeLetter] = useState<string | null>(null);
  const [editTypeInput, setEditTypeInput] = useState({ letter: '', label: '' });
  const [configMessage, setConfigMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Forced password change on first login (admin-issued temp password).
  const [forcePwdForm, setForcePwdForm] = useState({ password: '', confirm: '' });
  const [forcePwdError, setForcePwdError] = useState<string | null>(null);
  const [forcePwdSubmitting, setForcePwdSubmitting] = useState(false);
  const mustChangePassword = Boolean(userProfile?.mustReset);

  const isSuperAdmin = userProfile?.role === 'super-admin' || userRole?.isAllAccess === true;
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const isRepresentative = userProfile?.role === 'representative' || isAdmin;

  // 24h trial access — the admin grants the trial when validating an
  // adhesion request before the cotisation is paid. The countdown starts on
  // the user's first dashboard load (after the forced password change) and
  // the welcome reminder keeps showing until the cotisation for the current
  // year is marked paid by a super-admin. Admins/representatives are never
  // subjected to the trial gate.
  const trialState = (() => {
    if (!userProfile || mustChangePassword) return 'none' as const;
    if (isAdmin || isRepresentative) return 'none' as const;
    const startedAtRaw = userProfile.trialStartedAt;
    if (!startedAtRaw) return 'none' as const;
    const yearLabel = String(new Date().getFullYear());
    const currentYearPaid = !!userProfile.cotisations?.[yearLabel]?.paid;
    if (currentYearPaid) return 'none' as const;
    const firstUsedRaw = userProfile.trialFirstUsedAt;
    if (!firstUsedRaw) return 'pre-use' as const;
    const firstUsedMs = new Date(firstUsedRaw).getTime();
    if (!Number.isFinite(firstUsedMs)) return 'pre-use' as const;
    const expiresMs = firstUsedMs + 24 * 60 * 60 * 1000;
    return Date.now() < expiresMs ? ('in-trial' as const) : ('expired' as const);
  })();
  const trialExpiresAtMs =
    userProfile?.trialFirstUsedAt
      ? new Date(userProfile.trialFirstUsedAt).getTime() + 24 * 60 * 60 * 1000
      : null;

  // Stamp trial_first_used_at the first time the dashboard renders for a
  // user whose admin granted them the 24h trial. Done after the forced
  // password change so the first-login modal doesn't burn part of the 24h.
  useEffect(() => {
    if (trialState !== 'pre-use') return;
    const uid = userProfile?.uid;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        await updateDoc(doc(db, 'users', uid), {
          trialFirstUsedAt: new Date().toISOString(),
        });
      } catch (err) {
        if (!cancelled) console.error('Could not stamp trial first-use:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trialState, userProfile?.uid]);

  // Welcome / cotisation reminder banner — visible while a trial is active
  // (pre-use, in-trial). The user can dismiss it for the current session;
  // it reappears on every fresh login until the cotisation is paid.
  const [welcomeBannerDismissed, setWelcomeBannerDismissed] = useState(false);
  const showWelcomeBanner =
    (trialState === 'pre-use' || trialState === 'in-trial') && !welcomeBannerDismissed;

  const can = (key: string): boolean => {
    if (isSuperAdmin) return true;
    return userRole?.permissions?.[key] === true;
  };

  const chatModerator = isAdmin || userRole?.permissions?.chat_manage === true;
  // Only the admin "Modération Discussions" tab badge is needed here; the
  // floating widget computes its own unread count for members.
  const { pendingApproval: chatPendingApprovals } = useChatBadge(
    user?.uid ?? null,
    chatModerator
  );

  // Sidebar preference — pinned (default) or auto-hidden behind an overlay.
  // Persisted in localStorage so the member's choice survives reloads.
  const [sidebarPinned, setSidebarPinned] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem('aaj_sidebar_pinned');
      if (v === 'false') setSidebarPinned(false);
    } catch {
      // ignore
    }
  }, []);
  const toggleSidebarPinned = () => {
    setSidebarPinned((v) => {
      const next = !v;
      try {
        localStorage.setItem('aaj_sidebar_pinned', String(next));
      } catch {
        // ignore
      }
      if (!next) setSidebarOpen(false);
      return next;
    });
  };
  // Pick a tab in the sidebar — auto-closes the overlay when unpinned.
  const selectTab = (id: string) => {
    setActiveTab(id);
    if (!sidebarPinned) setSidebarOpen(false);
    // Garde l'URL synchro pour les liens profonds (?tab=...).
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  // Lit ?tab=... au chargement (ex: lien depuis le drawer cloche).
  useEffect(() => {
    let tab = searchParams.get('tab');
    // Backward compat: l'ancien onglet "Instruction UNESCO" a fusionné
    // dans "Demandes UNESCO". Redirige les liens / bookmarks éventuels.
    if (tab === 'admin-unesco-permits') tab = 'admin-unesco-requests';
    if (tab && tab !== activeTab) setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fallback: si l'onglet courant n'est plus accessible (rôle restreint qui
  // n'a pas dashboard_view, par ex.), bascule sur le premier onglet autorisé.
  useEffect(() => {
    if (!userRole) return;
    const tabPerm: Record<string, string | null> = {
      dashboard: 'dashboard_view',
      commissions: 'commissions_view',
      bibliotheque: 'library_view',
      documents: 'messages_send',
      'member-partners': 'partners_view',
      annuaire: 'annuaire_view',
      jobs: 'jobs_view',
      unesco: 'unesco_view',
      notifications: null,
      'notifications-prefs': null,
      settings: null,
    };
    const currentPerm = tabPerm[activeTab];
    if (currentPerm === undefined) return; // admin tabs handled by their own can() guards
    if (currentPerm === null || can(currentPerm)) return;
    const fallbackOrder = [
      'dashboard',
      'commissions',
      'bibliotheque',
      'annuaire',
      'member-partners',
      'jobs',
      'unesco',
      'documents',
      'notifications',
      'settings',
    ];
    const next = fallbackOrder.find((id) => {
      const p = tabPerm[id];
      return p === null || can(p);
    });
    if (next && next !== activeTab) setActiveTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userRole]);

  const canReviewUnesco =
    isAdmin ||
    userRole?.permissions?.unesco_manage === true ||
    userRole?.permissions?.unesco_permits_review === true ||
    userRole?.permissions?.unesco_requests_manage === true;
  const [unescoPendingReview, setUnescoPendingReview] = useState(0);
  const [unescoStatusCounts, setUnescoStatusCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!user || !canReviewUnesco) {
      setUnescoPendingReview(0);
      setUnescoStatusCounts({});
      return;
    }
    let cancelled = false;
    const fetchCounts = () => {
      apiClient.unesco
        .statusCounts()
        .then((r) => {
          if (cancelled) return;
          setUnescoPendingReview(r.pendingReview);
          setUnescoStatusCounts(r.counts || {});
        })
        .catch(() => {});
    };
    fetchCounts();
    const iv = setInterval(fetchCounts, 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [user, canReviewUnesco]);

  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const libraryFileInputRef = useRef<HTMLInputElement>(null);
  const newsFileInputRef = useRef<HTMLInputElement>(null);
  const pvFileInputRef = useRef<HTMLInputElement>(null);

  const [newNews, setNewNews] = useState({
    title: '',
    content: '',
    category: '',
    fileUrl: '',
    fileName: '',
    fileMimeType: '',
  });
  const [newsUploading, setNewsUploading] = useState(false);
  type PVFile = { id: string; url: string; name: string; type: string };
  const [newPV, setNewPV] = useState<{
    town: string;
    date: string;
    count: string;
    type: string;
    files: PVFile[];
  }>({
    town: 'Houmt Souk',
    date: '',
    count: '0',
    type: '',
    files: [],
  });
  const [pvUploading, setPvUploading] = useState(false);

  // Preview modal state — used when a member clicks an attachment in the
  // Avis Commissions list. Holds the file list to navigate through and the
  // initial index to focus.
  const [previewState, setPreviewState] = useState<{
    files: PreviewFile[];
    index: number;
  } | null>(null);

  // Whether to show archived avis in the per-commune list. Off by default so
  // archived items don't clutter the day-to-day view.
  const [showArchivedPVs, setShowArchivedPVs] = useState(false);

  // Edit mode state for a single existing PV (admin / representative only).
  const [editingPVId, setEditingPVId] = useState<string | null>(null);
  const [editPVForm, setEditPVForm] = useState<{
    date: string;
    count: string;
    type: string;
  }>({ date: '', count: '0', type: '' });
  const [pvActionInFlight, setPvActionInFlight] = useState<string | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  useEffect(() => {
    if (!user) return;

    const unsubVilles = onSnapshot(
      doc(db, VILLES_DOC_PATH.col, VILLES_DOC_PATH.id),
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { list?: string[] };
          if (Array.isArray(data.list) && data.list.length > 0) {
            setVillesList(data.list);
            return;
          }
        }
        if (isSuperAdmin) {
          try {
            await saveVilles(DEFAULT_VILLES);
          } catch (err) {
            console.warn('Seeding default villes failed:', err);
          }
        }
        setVillesList(DEFAULT_VILLES);
      },
      (err) => {
        console.warn('Villes config read blocked, using defaults.', err);
        setVillesList(DEFAULT_VILLES);
      }
    );

    const unsubTypes = onSnapshot(
      doc(db, MEMBER_TYPES_DOC_PATH.col, MEMBER_TYPES_DOC_PATH.id),
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { list?: MemberType[] };
          if (Array.isArray(data.list) && data.list.length > 0) {
            setMemberTypesList(data.list);
            return;
          }
        }
        if (isSuperAdmin) {
          try {
            await saveMemberTypes(DEFAULT_MEMBER_TYPES);
          } catch (err) {
            console.warn('Seeding default member types failed:', err);
          }
        }
        setMemberTypesList(DEFAULT_MEMBER_TYPES);
      },
      (err) => {
        console.warn('Member types config read blocked, using defaults.', err);
        setMemberTypesList(DEFAULT_MEMBER_TYPES);
      }
    );

    const unsubColors = onSnapshot(
      doc(db, COMMISSION_COLORS_DOC_PATH.col, COMMISSION_COLORS_DOC_PATH.id),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { colors?: Record<string, string> };
          if (data.colors && typeof data.colors === 'object') {
            const cleaned: Record<string, string> = {};
            for (const [town, hex] of Object.entries(data.colors)) {
              if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) cleaned[town] = hex;
            }
            setCommissionColors({ ...DEFAULT_COMMISSION_COLORS, ...cleaned });
            return;
          }
        }
        setCommissionColors({ ...DEFAULT_COMMISSION_COLORS });
      },
      (err) => {
        console.warn('Commission colors config read blocked, using defaults.', err);
        setCommissionColors({ ...DEFAULT_COMMISSION_COLORS });
      }
    );

    const unsubCommissionTypes = onSnapshot(
      doc(db, COMMISSION_TYPES_DOC_PATH.col, COMMISSION_TYPES_DOC_PATH.id),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { list?: string[] };
          if (Array.isArray(data.list) && data.list.length > 0) {
            setCommissionTypesList(
              data.list.filter((t) => typeof t === 'string' && t.trim().length > 0)
            );
            return;
          }
        }
        setCommissionTypesList([...DEFAULT_COMMISSION_TYPES]);
      },
      (err) => {
        console.warn('Commission types config read blocked, using defaults.', err);
        setCommissionTypesList([...DEFAULT_COMMISSION_TYPES]);
      }
    );

    const unsubNewsCategories = onSnapshot(
      doc(db, NEWS_CATEGORIES_DOC_PATH.col, NEWS_CATEGORIES_DOC_PATH.id),
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { list?: string[] };
          if (Array.isArray(data.list) && data.list.length > 0) {
            setNewsCategoriesList(data.list);
            return;
          }
        }
        if (isSuperAdmin) {
          try {
            await saveNewsCategories(DEFAULT_NEWS_CATEGORIES);
          } catch (err) {
            console.warn('Seeding default news categories failed:', err);
          }
        }
        setNewsCategoriesList([...DEFAULT_NEWS_CATEGORIES]);
      },
      (err) => {
        console.warn('News categories config read blocked, using defaults.', err);
        setNewsCategoriesList([...DEFAULT_NEWS_CATEGORIES]);
      }
    );

    const qNews = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsubscribeNews = onSnapshot(qNews, (snapshot) => {
      const newsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNewsItems(newsData);
    });

    const qPVs = query(collection(db, 'commission_pvs'), orderBy('createdAt', 'desc'));
    const unsubscribePVs = onSnapshot(qPVs, (snapshot) => {
      const pvsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCommissionPVs(pvsData);
    });

    const qJobs = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsubscribeJobs = onSnapshot(
      qJobs,
      (snapshot) => {
        setJobItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn('Jobs subscription error:', err);
      }
    );

    const qAllMessages = query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc'));
    let unsubscribeAdminMessages = () => {};
    if (isAdmin) {
      unsubscribeAdminMessages = onSnapshot(
        qAllMessages,
        (snapshot) => {
          setAdminMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        },
        (err) => {
          console.warn('Restricted access to admin messaging queue.', err);
        }
      );
    }

    const qUserMessages = query(
      collection(db, 'contact_messages'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeUserMessages = onSnapshot(qUserMessages, (snapshot) => {
      setUserMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const qPartners = query(collection(db, 'partners'), orderBy('name', 'asc'));
    const unsubscribePartners = onSnapshot(qPartners, async (snapshot) => {
      if (snapshot.empty && isAdmin) {
        // Initial Seed
        const initialPartners = [
          { name: 'Bati Jerba', level: 'Platine', joined: '2024', isVisible: true },
          { name: 'Sika Tunisia', level: 'Or', joined: '2025', isVisible: true },
          { name: 'Meuble Art', level: 'Argent', joined: '2024', isVisible: true },
        ];
        for (const p of initialPartners) {
          await addDoc(collection(db, 'partners'), { ...p, createdAt: serverTimestamp() });
        }
      }
      setPartnersList(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubVilles();
      unsubTypes();
      unsubColors();
      unsubCommissionTypes();
      unsubNewsCategories();
      unsubscribeNews();
      unsubscribePVs();
      unsubscribeJobs();
      unsubscribeAdminMessages();
      unsubscribeUserMessages();
      unsubscribePartners();
    };
  }, [user, isSuperAdmin]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLibraryDocs(docsData);
    });

    return () => unsubscribe();
  }, [user]);

  const needsAdminData =
    isAdmin ||
    can('members_manage') ||
    can('profileRequests_manage') ||
    can('roles_manage') ||
    can('users_editRole') ||
    can('users_editStatus');

  useEffect(() => {
    if (!user || !needsAdminData) {
      setAllUsers([]);
      setProfileRequests([]);
      setRolesList([]);
      return;
    }

    const qUsers = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData = snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setAllUsers(usersData);
    });

    const qRequests = query(collection(db, 'profile_updates'), orderBy('createdAt', 'desc'));
    const unsubscribeRequests = onSnapshot(
      qRequests,
      (snapshot) => {
        const requestsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProfileRequests(requestsData);
      },
      (err) => {
        console.warn('Permission restricted for profile updates list (Admin only).', err);
      }
    );

    const qApps = query(collection(db, 'membership_applications'), orderBy('createdAt', 'desc'));
    const unsubscribeApps = onSnapshot(
      qApps,
      (snapshot) => {
        setMembershipApplications(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn('Permission restricted for membership applications list.', err);
      }
    );

    // The 4 system roles are seeded server-side on every API boot
    // (see api/lib/permissions.php → seed_default_roles_if_missing).
    // The client only needs to subscribe and render.
    const qRoles = query(collection(db, 'roles'), orderBy('name', 'asc'));
    const unsubscribeRoles = onSnapshot(
      qRoles,
      (snapshot) => {
        setRolesList(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Role));
      },
      (err) => {
        console.warn('Permission restricted for roles list.', err);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeRequests();
      unsubscribeApps();
      unsubscribeRoles();
    };
  }, [user, needsAdminData, isSuperAdmin]);

  useEffect(() => {
    if (!user) {
      setPendingUserRequests([]);
      return;
    }
    const q = query(
      collection(db, 'profile_updates'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const requests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setPendingUserRequests(requests);
      },
      (err) => {
        console.error('Error fetching user profile requests:', err);
      }
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (userProfile?.status === 'suspended') {
      handleLogout();
      setError("Votre accès a été suspendu par l'administration.");
    } else if (userProfile?.status === 'archived') {
      handleLogout();
      setError("Votre compte a été archivé. Contactez l'administration pour plus d'informations.");
    }
  }, [userProfile]);

  // Auto-generate Matricule AAJ when birthDate + type letter are set
  useEffect(() => {
    if (!newMember.birthDate || !newMember.memberTypeLetter) return;
    const existing = allUsers
      .map((u: any) => (u?.licenseNumber ? String(u.licenseNumber) : ''))
      .filter(Boolean);
    const idx = computeNextIndex(existing, newMember.birthDate, newMember.memberTypeLetter);
    const generated = buildMatricule(newMember.birthDate, newMember.memberTypeLetter, idx);
    if (generated && generated !== newMember.matricule) {
      setNewMember((prev) => ({ ...prev, matricule: generated }));
    }
  }, [newMember.birthDate, newMember.memberTypeLetter, allUsers]);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    category: 'Architecte',
    address: '',
    email: '',
    licenseNumber: '',
  });

  useEffect(() => {
    if (userProfile) {
      const names = (userProfile.displayName || '').split(' ');
      setProfileForm({
        firstName: userProfile.firstName || names[0] || '',
        lastName: userProfile.lastName || names.slice(1).join(' ') || '',
        mobile: userProfile.mobile || '',
        category: userProfile.category || userProfile.specialty || 'Architecte',
        address: userProfile.address || '',
        email: userProfile.email || user?.email || '',
        licenseNumber: userProfile.licenseNumber || '',
      });
    }
  }, [userProfile, user]);

  // Mock data for commissions
  const commissions = [
    { town: 'Houmt Souk', date: '15 AVR 2026', status: 'Terminé', count: 12 },
    { town: 'Midoun', date: '18 AVR 2026', status: 'En attente', count: 8 },
    { town: 'Ajim', date: '22 AVR 2026', status: 'Prévu', count: 5 },
  ];

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        const docRef = doc(db, 'users', currentUser.uid);
        const unSubProfile = onSnapshot(
          docRef,
          (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile(docSnap.data());
            }
            setLoading(false);
          },
          (err) => {
            console.error('Error fetching profile:', err);
            setLoading(false);
          }
        );
        return () => unSubProfile();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const roleId = userProfile?.role;
    if (!roleId) {
      setUserRole(null);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'roles', roleId),
      (snap) => {
        if (snap.exists()) {
          setUserRole({ id: snap.id, ...snap.data() } as Role);
        } else {
          const fallback = DEFAULT_ROLES.find((r) => r.id === roleId);
          setUserRole(fallback ? { ...fallback } : null);
        }
      },
      (err) => {
        console.warn('Role subscription error (falling back to defaults):', err);
        const fallback = DEFAULT_ROLES.find((r) => r.id === roleId);
        setUserRole(fallback ? { ...fallback } : null);
      }
    );
    return () => unsubscribe();
  }, [userProfile?.role]);

  // Fichier en attente de recadrage. Quand non-null, on affiche la modal.
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  const handleUpdatePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];

    // Garde-fou contre des fichiers énormes (raw JPEG/HEIC d'appareil photo
    // pro). 20 Mo en entrée, on compresse ensuite à ~100 Ko.
    if (file.size > 20 * 1024 * 1024) {
      alert("L'image est trop lourde (max 20 Mo en entrée).");
      e.target.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Veuillez choisir un fichier image.');
      e.target.value = '';
      return;
    }

    setPendingCropFile(file);
    // Reset l'input pour que choisir le même fichier deux fois de suite
    // re-déclenche bien onChange.
    e.target.value = '';
  };

  const handleCroppedPhotoConfirm = async (dataUrl: string) => {
    if (!user) return;
    setPendingCropFile(null);
    try {
      setIsSaving(true);
      await setDoc(
        doc(db, 'users', user.uid),
        {
          photoBase64: dataUrl,
        },
        { merge: true }
      );
      alert('Photo de profil mise à jour avec succès.');
    } catch (err) {
      console.error('Error updating photo:', err);
      alert('Erreur lors de la mise à jour de la photo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleForcedPasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setForcePwdError(null);
    if (forcePwdForm.password.length < 6) {
      setForcePwdError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (forcePwdForm.password !== forcePwdForm.confirm) {
      setForcePwdError('Les mots de passe ne correspondent pas.');
      return;
    }
    setForcePwdSubmitting(true);
    try {
      await changePassword(forcePwdForm.password);
      // Refresh local profile state immediately; AuthContext + the users/{uid}
      // subscription will also pick up `mustReset = false` on next tick.
      setUserProfile((prev: any) => (prev ? { ...prev, mustReset: false } : prev));
      setForcePwdForm({ password: '', confirm: '' });
    } catch (err: any) {
      console.error('Forced password change failed:', err);
      setForcePwdError(
        err?.code === 'weak_password'
          ? 'Le mot de passe doit contenir au moins 6 caractères.'
          : 'Impossible de modifier le mot de passe. Veuillez réessayer.'
      );
    } finally {
      setForcePwdSubmitting(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Login Error:', err);
      if (err.status === 401 || err.code === 'invalid_credentials') {
        setError('Email ou mot de passe incorrect.');
      } else if (err.status === 503 || err.code === 'server_misconfigured') {
        setError(
          "Le service d'authentification est momentanément indisponible. Veuillez contacter l'administrateur."
        );
      } else {
        setError('Email ou mot de passe incorrect.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Veuillez saisir votre adresse email pour réinitialiser votre mot de passe.');
      return;
    }
    setError(null);
    setAuthLoading(true);
    try {
      const actionCodeSettings = {
        url: window.location.origin + '/reset-password',
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setResetSent(true);
    } catch (err: any) {
      console.error('Reset Error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Aucun utilisateur trouvé avec cet email.');
      } else {
        setError("Erreur lors de l'envoi de l'email de réinitialisation.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleToggleResetMode = () => {
    setIsResetMode(!isResetMode);
    setError(null);
    setResetSent(false);
  };

  const [newDoc, setNewDoc] = useState<{
    name: string;
    url: string;
    category: string;
    commune: string;
    arrondissement: string;
    approvalDate: string;
    legalType: string;
    fileType: string;
    file: File | null;
    fileName: string;
  }>({
    name: '',
    url: '',
    category: "Plan d'Aménagement",
    commune: 'Houmt Souk',
    arrondissement: '',
    approvalDate: '',
    legalType: 'Contrat',
    fileType: 'pdf',
    file: null,
    fileName: '',
  });

  // ---- Edit / archive state for the library admin panel ----
  // `editingDoc` holds the in-progress patch when an admin clicks "Modifier"
  // on a library row. Mirrors the shape of `newDoc` plus the original id and
  // the existing fileId/url so we know whether to re-upload or keep them.
  type EditingDocState = {
    id: string;
    name: string;
    url: string;
    category: string;
    commune: string;
    arrondissement: string;
    approvalDate: string;
    legalType: string;
    fileType: string;
    file: File | null;
    fileName: string;
    /** id of the file currently stored on disk (to delete if replaced). */
    existingFileId: string | null;
  };
  const [editingDoc, setEditingDoc] = useState<EditingDocState | null>(null);
  const editLibraryFileInputRef = useRef<HTMLInputElement>(null);
  const [archivingDocId, setArchivingDocId] = useState<string | null>(null);
  const [showArchivedDocs, setShowArchivedDocs] = useState(false);

  const handleLibraryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setNewDoc({
      ...newDoc,
      file,
      fileName: file.name,
      fileType: file.name.split('.').pop()?.toLowerCase() || 'pdf',
    });
  };

  const handleAddDocument = async (e: FormEvent) => {
    e.preventDefault();
    if (!can('library_manage')) return;

    if (!newDoc.url && !newDoc.file) {
      alert('Veuillez fournir un lien ou uploader un document.');
      return;
    }

    setIsSaving(true);
    let uploadedFileId: string | null = null;
    try {
      const docData: any = {
        name: newDoc.name,
        category: newDoc.category,
        fileType: newDoc.fileType,
        createdAt: serverTimestamp(),
      };

      if (newDoc.file) {
        // Stream the binary to /api/files (cPanel disk storage). The DB only
        // stores the public URL + file id — no more base64 blobs in MySQL.
        const result = await uploadFile(newDoc.file, 'documents');
        docData.url = result.url;
        docData.fileId = result.path;
        docData.fileName = newDoc.file.name;
        uploadedFileId = result.path;
      } else if (newDoc.url) {
        docData.url = newDoc.url;
      }

      if (newDoc.category === "Plan d'Aménagement") {
        docData.commune = newDoc.commune;
        docData.arrondissement = newDoc.arrondissement;
        docData.subCategory = `${newDoc.commune}${newDoc.arrondissement ? ' - ' + newDoc.arrondissement : ''}`;
        if (newDoc.approvalDate) docData.approvalDate = newDoc.approvalDate;
      } else if (newDoc.category === 'Cadre Contractuel & Légal') {
        docData.subCategory = newDoc.legalType;
      }

      await addDoc(collection(db, 'documents'), docData);

      setNewDoc({
        name: '',
        url: '',
        category: "Plan d'Aménagement",
        commune: 'Houmt Souk',
        arrondissement: '',
        approvalDate: '',
        legalType: 'Contrat',
        fileType: 'pdf',
        file: null,
        fileName: '',
      });
      if (libraryFileInputRef.current) libraryFileInputRef.current.value = '';
      alert('Document ajouté avec succès !');
    } catch (err) {
      // If the file upload succeeded but the DB insert failed, clean up the
      // orphan on disk so /api/files-storage doesn't accumulate dead blobs.
      if (uploadedFileId) {
        try {
          await deleteFile(uploadedFileId);
        } catch {
          /* best-effort */
        }
      }
      console.error('Error adding document:', err);
      const msg = err instanceof Error && err.message ? err.message : "Erreur lors de l'ajout du document.";
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!can('library_manage')) return;
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    // Best-effort cleanup of the underlying file blob on disk.
    const docRecord = libraryDocs.find((d) => d.id === docId);
    try {
      await deleteDoc(doc(db, 'documents', docId));
      if (docRecord?.fileId) {
        await deleteFile(docRecord.fileId);
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Erreur lors de la suppression.');
    }
  };

  /**
   * Open the "Modifier le document" modal pre-filled with the row data.
   * The admin can then change any field (and optionally replace the
   * underlying file) before confirming.
   */
  const handleStartEditDocument = (docRecord: any) => {
    if (!can('library_manage')) return;
    // The doc may live under a "Plan d'Aménagement" subCategory shaped as
    // "Commune - Arrondissement". Split it back so the form can edit each.
    let commune = docRecord.commune || 'Houmt Souk';
    let arrondissement = docRecord.arrondissement || '';
    if (
      docRecord.category === "Plan d'Aménagement" &&
      typeof docRecord.subCategory === 'string' &&
      docRecord.subCategory.includes(' - ') &&
      !docRecord.commune
    ) {
      const [c, a] = docRecord.subCategory.split(' - ');
      commune = c;
      arrondissement = a || '';
    }
    setEditingDoc({
      id: docRecord.id,
      name: docRecord.name || '',
      url: docRecord.url || '',
      category: docRecord.category || "Plan d'Aménagement",
      commune,
      arrondissement,
      approvalDate: docRecord.approvalDate || '',
      legalType: docRecord.subCategory || 'Contrat',
      fileType: docRecord.fileType || 'pdf',
      file: null,
      fileName: docRecord.fileName || '',
      existingFileId: docRecord.fileId || null,
    });
  };

  const handleEditLibraryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingDoc) return;
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setEditingDoc({
      ...editingDoc,
      file,
      fileName: file.name,
      fileType: file.name.split('.').pop()?.toLowerCase() || 'pdf',
    });
  };

  /**
   * Persist the patch from the edit modal. If the admin chose a new file we
   * upload it first, swap the URL/fileId, and then delete the old blob to
   * keep the disk tidy.
   */
  const handleUpdateDocument = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingDoc || !can('library_manage')) return;

    setIsSaving(true);
    let uploadedFileId: string | null = null;
    let oldFileIdToDelete: string | null = null;
    try {
      const patch: any = {
        name: editingDoc.name,
        category: editingDoc.category,
        fileType: editingDoc.fileType,
      };

      if (editingDoc.file) {
        // New file → upload, point url+fileId at it, schedule the old blob
        // for deletion after the DB write succeeds.
        const result = await uploadFile(editingDoc.file, 'documents');
        patch.url = result.url;
        patch.fileId = result.path;
        patch.fileName = editingDoc.file.name;
        uploadedFileId = result.path;
        oldFileIdToDelete = editingDoc.existingFileId;
      } else if (editingDoc.url) {
        patch.url = editingDoc.url;
      }

      if (editingDoc.category === "Plan d'Aménagement") {
        patch.commune = editingDoc.commune;
        patch.arrondissement = editingDoc.arrondissement;
        patch.subCategory = `${editingDoc.commune}${
          editingDoc.arrondissement ? ' - ' + editingDoc.arrondissement : ''
        }`;
        patch.approvalDate = editingDoc.approvalDate || '';
      } else if (editingDoc.category === 'Cadre Contractuel & Légal') {
        patch.subCategory = editingDoc.legalType;
        // Drop approvalDate when the doc is no longer a PAU.
        patch.approvalDate = '';
      }

      await updateDoc(doc(db, 'documents', editingDoc.id), patch);

      // Old file cleanup (best-effort, after the DB has acknowledged the
      // swap so a failure here doesn't strand the row pointing at nothing).
      if (oldFileIdToDelete) {
        try {
          await deleteFile(oldFileIdToDelete);
        } catch {
          /* best-effort */
        }
      }

      setEditingDoc(null);
      if (editLibraryFileInputRef.current) editLibraryFileInputRef.current.value = '';
    } catch (err) {
      // If we uploaded a new file but the DB patch failed, drop the orphan.
      if (uploadedFileId) {
        try {
          await deleteFile(uploadedFileId);
        } catch {
          /* best-effort */
        }
      }
      console.error('Error updating document:', err);
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Erreur lors de la mise à jour du document.';
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Toggle the archived flag on a document. Archived rows stay in the DB
   * (admins can restore them) but are filtered out of the member-facing
   * library listing by the `documents` collection's listFilter on the API.
   */
  const handleToggleArchiveDocument = async (docId: string, currentlyArchived: boolean) => {
    if (!can('library_manage')) return;
    setArchivingDocId(docId);
    try {
      await updateDoc(doc(db, 'documents', docId), { archived: !currentlyArchived });
    } catch (err) {
      console.error('Error archiving document:', err);
      alert(
        currentlyArchived ? 'Erreur lors de la restauration.' : "Erreur lors de l'archivage."
      );
    } finally {
      setArchivingDocId(null);
    }
  };

  const handleNewsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewsUploading(true);
    try {
      const res = await apiClient.uploadFile(file, 'news', 'members');
      setNewNews({
        ...newNews,
        fileUrl: res.url,
        fileName: res.name,
        fileMimeType: res.type || file.type || '',
      });
    } catch (err: any) {
      console.error('Error uploading news file:', err);
      alert(err?.message || "Erreur lors de l'upload du fichier.");
    } finally {
      setNewsUploading(false);
      if (newsFileInputRef.current) newsFileInputRef.current.value = '';
    }
  };

  const handleAddNews = async (e: FormEvent) => {
    e.preventDefault();
    if (!can('news_manage')) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'news'), {
        ...newNews,
        createdAt: serverTimestamp(),
        authorEmail: user?.email,
        authorDisplayName: userProfile?.displayName || user?.email || '',
        authorPhotoBase64: userProfile?.photoBase64 || '',
      });
      setNewNews({
        title: '',
        content: '',
        category: '',
        fileUrl: '',
        fileName: '',
        fileMimeType: '',
      });
      if (newsFileInputRef.current) newsFileInputRef.current.value = '';
      alert('Annonce publiée !');
    } catch (err) {
      console.error('Error adding news:', err);
      alert('Erreur lors de la diffusion.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNewsCategory = async (raw: string) => {
    const cat = raw.trim();
    if (!cat) return;
    if (newsCategoriesList.some((c) => c.toLowerCase() === cat.toLowerCase())) {
      setConfigMessage({ type: 'error', text: 'Cette catégorie existe déjà.' });
      return;
    }
    const next = [...newsCategoriesList, cat];
    setConfigSaving(true);
    try {
      await saveNewsCategories(next);
      setNewsCategoriesList(next);
      setNewNewsCategoryInput('');
      setConfigMessage({ type: 'success', text: `Catégorie "${cat}" ajoutée.` });
    } catch (err) {
      console.error('Error saving news category:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, "Erreur lors de l'enregistrement de la catégorie."),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleRemoveNewsCategory = async (cat: string) => {
    if (!window.confirm(`Supprimer la catégorie "${cat}" ?`)) return;
    const next = newsCategoriesList.filter((c) => c !== cat);
    setConfigSaving(true);
    try {
      await saveNewsCategories(next);
      setNewsCategoriesList(next);
      setConfigMessage({ type: 'success', text: `Catégorie "${cat}" supprimée.` });
    } catch (err) {
      console.error('Error removing news category:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, 'Erreur lors de la suppression.'),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleResetNewsCategories = async () => {
    if (!window.confirm('Réinitialiser la liste des catégories aux valeurs par défaut ?')) return;
    setConfigSaving(true);
    try {
      await saveNewsCategories(DEFAULT_NEWS_CATEGORIES);
      setNewsCategoriesList([...DEFAULT_NEWS_CATEGORIES]);
      setConfigMessage({ type: 'success', text: 'Catégories réinitialisées.' });
    } catch (err) {
      console.error('Error resetting news categories:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, 'Erreur lors de la réinitialisation.'),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAddCommissionType = async (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (commissionTypesList.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setConfigMessage({ type: 'error', text: 'Ce type de commission existe déjà.' });
      return;
    }
    const next = [...commissionTypesList, t];
    setConfigSaving(true);
    try {
      await saveCommissionTypes(next);
      setCommissionTypesList(next);
      setNewCommissionTypeInput('');
      setConfigMessage({ type: 'success', text: `Type "${t}" ajouté.` });
    } catch (err) {
      console.error('Error saving commission type:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, "Erreur lors de l'enregistrement du type."),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleRemoveCommissionType = async (t: string) => {
    if (!window.confirm(`Supprimer le type de commission "${t}" ?`)) return;
    const next = commissionTypesList.filter((x) => x !== t);
    setConfigSaving(true);
    try {
      await saveCommissionTypes(next);
      setCommissionTypesList(next);
      setConfigMessage({ type: 'success', text: `Type "${t}" supprimé.` });
    } catch (err) {
      console.error('Error removing commission type:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, 'Erreur lors de la suppression.'),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleResetCommissionTypes = async () => {
    if (!window.confirm('Réinitialiser les types de commissions aux valeurs par défaut ?')) return;
    setConfigSaving(true);
    try {
      await saveCommissionTypes(DEFAULT_COMMISSION_TYPES);
      setCommissionTypesList([...DEFAULT_COMMISSION_TYPES]);
      setConfigMessage({ type: 'success', text: 'Types de commissions réinitialisés.' });
    } catch (err) {
      console.error('Error resetting commission types:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, 'Erreur lors de la réinitialisation.'),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAddPV = async (e: FormEvent) => {
    e.preventDefault();
    if (!can('commissions_create')) return;
    if (newPV.files.length === 0) {
      alert('Veuillez sélectionner au moins un fichier (image ou PDF).');
      return;
    }
    setIsSaving(true);
    try {
      let filesToSave: PVFile[] = newPV.files;

      // Auto-convert: if the user uploaded ≥2 images (and only images),
      // bundle them into a single PDF so members get a clean PV instead of a
      // sprawl of loose photos. Mixed selections (image+PDF) keep the raw
      // files — merging a PDF into a PDF is out of scope here.
      const allImages =
        newPV.files.length >= 2 &&
        newPV.files.every((f) => (f.type || '').startsWith('image/'));

      if (allImages) {
        try {
          const blob = await imagesToPdfBlob(
            newPV.files.map((f) => ({ src: f.url, name: f.name, type: f.type }))
          );
          const datePart = newPV.date || new Date().toISOString().slice(0, 10);
          const safeTown = (newPV.town || 'commission').replace(/[^a-zA-Z0-9_-]+/g, '_');
          const pdfName = `PV_${safeTown}_${datePart}.pdf`;
          const pdfFile = new File([blob], pdfName, { type: 'application/pdf' });
          const res = await apiClient.uploadFile(pdfFile, 'commission_pvs', 'members');
          filesToSave = [{ id: res.id, url: res.url, name: res.name, type: res.type }];
        } catch (convErr) {
          console.error('Auto-PDF conversion failed, falling back to raw images:', convErr);
          // Fall through with the original images — non-fatal.
        }
      }

      await addDoc(collection(db, 'commission_pvs'), {
        town: newPV.town,
        date: newPV.date,
        count: newPV.count,
        type: newPV.type.trim(),
        files: filesToSave,
        createdAt: serverTimestamp(),
      });
      setNewPV({ town: 'Houmt Souk', date: '', count: '0', type: '', files: [] });
      if (pvFileInputRef.current) pvFileInputRef.current.value = '';
      alert('Avis publié avec succès !');
    } catch (err) {
      console.error('Error adding PV:', err);
      alert("Erreur lors de la publication de l'avis.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePvFilesSelected = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setPvUploading(true);
    try {
      const uploaded: PVFile[] = [];
      for (const file of Array.from(list)) {
        const res = await apiClient.uploadFile(file, 'commission_pvs', 'members');
        uploaded.push({ id: res.id, url: res.url, name: res.name, type: res.type });
      }
      setNewPV((prev) => ({ ...prev, files: [...prev.files, ...uploaded] }));
    } catch (err: any) {
      console.error('Error uploading PV files:', err);
      alert(err?.message || "Erreur lors de l'upload des fichiers.");
    } finally {
      setPvUploading(false);
      if (pvFileInputRef.current) pvFileInputRef.current.value = '';
    }
  };

  const removePvFile = (idx: number) => {
    setNewPV((prev) => ({ ...prev, files: prev.files.filter((_, i) => i !== idx) }));
  };

  // Open the FilePreview modal on a specific file. Used everywhere we
  // previously had `<a download>` links so members can review the attachment
  // before grabbing it.
  const openFilePreview = (files: PreviewFile[], index: number) => {
    if (!Array.isArray(files) || files.length === 0) return;
    setPreviewState({ files, index: Math.max(0, Math.min(index, files.length - 1)) });
  };

  // ---- PV management (delete / archive / edit) ---------------------------

  const handleDeletePV = async (pv: any) => {
    if (!can('commissions_create')) return;
    if (!pv?.id) return;
    if (!window.confirm("Supprimer définitivement cet avis ? Cette action est irréversible.")) {
      return;
    }
    setPvActionInFlight(pv.id);
    try {
      await deleteDoc(doc(db, 'commission_pvs', pv.id));
    } catch (err) {
      console.error('Error deleting PV:', err);
      alert("Erreur lors de la suppression de l'avis.");
    } finally {
      setPvActionInFlight(null);
    }
  };

  const handleArchivePV = async (pv: any) => {
    if (!can('commissions_create')) return;
    if (!pv?.id) return;
    const archiving = !pv.archivedAt;
    if (
      archiving &&
      !window.confirm(
        "Archiver cet avis ? Il restera accessible via la bascule « Voir les archives »."
      )
    ) {
      return;
    }
    setPvActionInFlight(pv.id);
    try {
      await updateDoc(doc(db, 'commission_pvs', pv.id), {
        archivedAt: archiving ? serverTimestamp() : null,
      });
    } catch (err) {
      console.error('Error archiving PV:', err);
      alert("Erreur lors de l'archivage.");
    } finally {
      setPvActionInFlight(null);
    }
  };

  const handleStartEditPV = (pv: any) => {
    if (!can('commissions_create')) return;
    if (!pv?.id) return;
    setEditingPVId(pv.id);
    setEditPVForm({
      date: pv.date || '',
      count: String(pv.count ?? '0'),
      type: pv.type || '',
    });
  };

  const handleCancelEditPV = () => {
    setEditingPVId(null);
    setEditPVForm({ date: '', count: '0', type: '' });
  };

  const handleSaveEditPV = async (pvId: string) => {
    if (!can('commissions_create')) return;
    if (!pvId) return;
    if (!editPVForm.date) {
      alert('La date est requise.');
      return;
    }
    setPvActionInFlight(pvId);
    try {
      await updateDoc(doc(db, 'commission_pvs', pvId), {
        date: editPVForm.date,
        count: editPVForm.count,
        type: editPVForm.type.trim(),
      });
      handleCancelEditPV();
    } catch (err) {
      console.error('Error updating PV:', err);
      alert("Erreur lors de la modification de l'avis.");
    } finally {
      setPvActionInFlight(null);
    }
  };

  const handlePublishJobOffer = async (e: FormEvent) => {
    e.preventDefault();
    if (!can('jobs_create')) return;
    if (!newJob.title.trim() || !newJob.description.trim() || !newJob.contactEmail.trim()) {
      alert('Veuillez remplir le titre, la description et un email de contact.');
      return;
    }
    setIsSaving(true);
    try {
      const authorName = [userProfile?.firstName, userProfile?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || userProfile?.displayName || user?.email || 'Adhérent AAJ';
      await addDoc(collection(db, 'jobs'), {
        kind: 'offer',
        contractType: newJob.contractType,
        title: newJob.title.trim(),
        description: newJob.description.trim(),
        city: newJob.city,
        company: newJob.company.trim(),
        authorUid: user?.uid || null,
        authorName,
        authorRole: userProfile?.category || '',
        authorEmail: newJob.contactEmail.trim(),
        authorPhone: newJob.contactPhone.trim(),
        source: 'member',
        status: 'approved',
        createdAt: serverTimestamp(),
      });
      setNewJob({
        contractType: 'CDI',
        title: '',
        description: '',
        city: 'Houmt Souk',
        company: '',
        contactEmail: userProfile?.email || user?.email || '',
        contactPhone: userProfile?.mobile || '',
      });
      alert('Offre publiée avec succès.');
    } catch (err) {
      console.error('Error publishing job offer:', err);
      alert("Erreur lors de la publication de l'offre.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveJob = async (id: string) => {
    if (!can('jobs_manage')) return;
    try {
      await updateDoc(doc(db, 'jobs', id), { status: 'approved' });
    } catch (err) {
      console.error('Error approving job:', err);
      alert('Erreur lors de la validation.');
    }
  };

  const handleRejectJob = async (id: string) => {
    if (!can('jobs_manage')) return;
    if (!window.confirm('Rejeter cette annonce ?')) return;
    try {
      await updateDoc(doc(db, 'jobs', id), { status: 'rejected' });
    } catch (err) {
      console.error('Error rejecting job:', err);
      alert('Erreur lors du rejet.');
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!can('jobs_manage')) return;
    if (!window.confirm('Supprimer définitivement cette annonce ?')) return;
    try {
      await deleteDoc(doc(db, 'jobs', id));
    } catch (err) {
      console.error('Error deleting job:', err);
      alert('Erreur lors de la suppression.');
    }
  };

  const getMemberStartYear = (member: any): number => {
    const now = new Date().getFullYear();
    const raw = member?.createdAt;
    if (!raw) return now;
    try {
      if (typeof raw?.toDate === 'function') return raw.toDate().getFullYear();
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d.getFullYear();
    } catch {
      return now;
    }
    return now;
  };

  const getCotisationYears = (member: any): string[] => {
    const currentYear = new Date().getFullYear();
    const startYear = Math.min(getMemberStartYear(member), currentYear);
    const endYear = currentYear + 3;
    const years: string[] = [];
    for (let y = startYear; y <= endYear; y++) years.push(String(y));
    Object.keys(member?.cotisations || {}).forEach((y) => {
      if (!years.includes(y)) years.push(y);
    });
    return years.sort();
  };

  const currentYearLabel = String(new Date().getFullYear());

  const openMemberEditor = (member: any) => {
    setEditingMember({
      ...member,
      cotisations: { ...(member.cotisations || {}) },
    });
    setEditSelectedYears([]);
    setEditBulkAmount('');
  };

  const toggleCotisationYear = (year: string) => {
    setEditingMember((prev: any) => {
      if (!prev) return prev;
      const current = prev.cotisations || {};
      const entry = current[year];
      const nextEntry = entry?.paid
        ? { ...entry, paid: false, paidAt: '' }
        : { ...entry, paid: true, paidAt: new Date().toISOString() };
      return { ...prev, cotisations: { ...current, [year]: nextEntry } };
    });
  };

  const updateCotisationAmount = (year: string, amount: string) => {
    setEditingMember((prev: any) => {
      if (!prev) return prev;
      const current = prev.cotisations || {};
      const entry = current[year] || { paid: false };
      const n = amount === '' ? undefined : Number(amount);
      return {
        ...prev,
        cotisations: { ...current, [year]: { ...entry, amount: n } },
      };
    });
  };

  const toggleYearSelection = (year: string) => {
    setEditSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const payMultipleYears = () => {
    if (editSelectedYears.length === 0) return;
    const amountNum = editBulkAmount === '' ? undefined : Number(editBulkAmount);
    setEditingMember((prev: any) => {
      if (!prev) return prev;
      const current = { ...(prev.cotisations || {}) };
      const nowIso = new Date().toISOString();
      editSelectedYears.forEach((year) => {
        current[year] = {
          paid: true,
          paidAt: nowIso,
          ...(amountNum !== undefined ? { amount: amountNum } : {}),
        };
      });
      return { ...prev, cotisations: current };
    });
    setEditSelectedYears([]);
    setEditBulkAmount('');
  };

  const handleSaveMember = async () => {
    if (!can('members_manage') || !editingMember) return;
    setIsSaving(true);
    try {
      const displayName =
        `${editingMember.firstName || ''} ${editingMember.lastName || ''}`.trim() ||
        editingMember.displayName;
      const payload: any = {
        firstName: editingMember.firstName || '',
        lastName: editingMember.lastName || '',
        displayName,
        email: editingMember.email || '',
        mobile: editingMember.mobile || '',
        category: editingMember.category || 'Architecte',
        licenseNumber: editingMember.licenseNumber || '',
        address: editingMember.address || '',
        role: editingMember.role || 'member',
        status: editingMember.status || 'active',
        cotisations: editingMember.cotisations || {},
      };
      await updateDoc(doc(db, 'users', editingMember.uid), payload);
      alert('Fiche adhérent mise à jour avec succès.');
      setEditingMember(null);
      setEditSelectedYears([]);
      setEditBulkAmount('');
    } catch (err) {
      console.error('Error updating member:', err);
      alert("Erreur lors de la mise à jour de l'adhérent.");
    } finally {
      setIsSaving(false);
    }
  };

  const describeFirestoreError = (err: unknown, fallback: string): string => {
    const anyErr = err as { code?: string; message?: string } | null;
    if (anyErr?.code === 'permission-denied') {
      return 'Permissions insuffisantes : déployez les règles Firestore (`firebase deploy --only firestore:rules`).';
    }
    if (anyErr?.message) return `${fallback} — ${anyErr.message}`;
    return fallback;
  };

  const handleAddVille = async (raw: string) => {
    const ville = raw.trim();
    if (!ville) return;
    if (villesList.some((v) => v.toLowerCase() === ville.toLowerCase())) {
      setConfigMessage({ type: 'error', text: 'Cette ville existe déjà.' });
      return;
    }
    const next = [...villesList, ville].sort((a, b) => a.localeCompare(b, 'fr'));
    setConfigSaving(true);
    try {
      await saveVilles(next);
      setVillesList(next);
      setNewVilleInput('');
      setConfigMessage({ type: 'success', text: `Ville "${ville}" ajoutée.` });
    } catch (err) {
      console.error('Error saving ville:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, "Erreur lors de l'enregistrement de la ville."),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleRemoveVille = async (ville: string) => {
    if (!window.confirm(`Supprimer la ville "${ville}" de la liste ?`)) return;
    const next = villesList.filter((v) => v !== ville);
    setConfigSaving(true);
    try {
      await saveVilles(next);
      setVillesList(next);
      setConfigMessage({ type: 'success', text: `Ville "${ville}" supprimée.` });
    } catch (err) {
      console.error('Error removing ville:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, 'Erreur lors de la suppression.'),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleResetVilles = async () => {
    if (
      !window.confirm('Réinitialiser la liste des villes avec toutes les délégations tunisiennes ?')
    )
      return;
    setConfigSaving(true);
    try {
      await saveVilles(DEFAULT_VILLES);
      setVillesList(DEFAULT_VILLES);
      setConfigMessage({ type: 'success', text: 'Liste des villes réinitialisée.' });
    } catch (err) {
      console.error('Error resetting villes:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, 'Erreur lors de la réinitialisation.'),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAddMemberType = async () => {
    const letter = newTypeInput.letter.trim().toUpperCase().slice(0, 1);
    const label = newTypeInput.label.trim();
    if (!letter || !label) {
      setConfigMessage({ type: 'error', text: 'La lettre et le libellé sont requis.' });
      return;
    }
    if (memberTypesList.some((t) => t.letter === letter)) {
      setConfigMessage({ type: 'error', text: `La lettre "${letter}" est déjà utilisée.` });
      return;
    }
    const next = [...memberTypesList, { letter, label }];
    setConfigSaving(true);
    try {
      await saveMemberTypes(next);
      setMemberTypesList(next);
      setNewTypeInput({ letter: '', label: '' });
      setConfigMessage({ type: 'success', text: `Type "${label}" (${letter}) ajouté.` });
    } catch (err) {
      console.error('Error saving member type:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, "Erreur lors de l'enregistrement du type."),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const startEditMemberType = (t: MemberType) => {
    setEditingTypeLetter(t.letter);
    setEditTypeInput({ letter: t.letter, label: t.label });
    setConfigMessage(null);
  };

  const cancelEditMemberType = () => {
    setEditingTypeLetter(null);
    setEditTypeInput({ letter: '', label: '' });
  };

  const handleUpdateMemberType = async () => {
    if (!editingTypeLetter) return;
    const newLetter = editTypeInput.letter.trim().toUpperCase().slice(0, 1);
    const newLabel = editTypeInput.label.trim();
    if (!newLetter || !newLabel) {
      setConfigMessage({ type: 'error', text: 'La lettre et le libellé sont requis.' });
      return;
    }
    if (newLetter !== editingTypeLetter && memberTypesList.some((t) => t.letter === newLetter)) {
      setConfigMessage({ type: 'error', text: `La lettre "${newLetter}" est déjà utilisée.` });
      return;
    }
    const next = memberTypesList.map((t) =>
      t.letter === editingTypeLetter ? { letter: newLetter, label: newLabel } : t
    );
    setConfigSaving(true);
    try {
      await saveMemberTypes(next);
      setMemberTypesList(next);
      setEditingTypeLetter(null);
      setEditTypeInput({ letter: '', label: '' });
      setConfigMessage({
        type: 'success',
        text: `Type "${newLabel}" (${newLetter}) mis à jour.`,
      });
    } catch (err) {
      console.error('Error updating member type:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, 'Erreur lors de la mise à jour du type.'),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleRemoveMemberType = async (letter: string) => {
    const t = memberTypesList.find((x) => x.letter === letter);
    if (!t) return;
    if (!window.confirm(`Supprimer le type "${t.label}" (${letter}) ?`)) return;
    const next = memberTypesList.filter((x) => x.letter !== letter);
    setConfigSaving(true);
    try {
      await saveMemberTypes(next);
      setMemberTypesList(next);
      setConfigMessage({ type: 'success', text: `Type "${t.label}" supprimé.` });
    } catch (err) {
      console.error('Error removing member type:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, 'Erreur lors de la suppression.'),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleResetMemberTypes = async () => {
    if (!window.confirm('Réinitialiser les types de membres par défaut ?')) return;
    setConfigSaving(true);
    try {
      await saveMemberTypes(DEFAULT_MEMBER_TYPES);
      setMemberTypesList(DEFAULT_MEMBER_TYPES);
      setConfigMessage({ type: 'success', text: 'Types de membres réinitialisés.' });
    } catch (err) {
      console.error('Error resetting member types:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, 'Erreur lors de la réinitialisation.'),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleSaveCommissionColors = async () => {
    setConfigSaving(true);
    try {
      // Merge drafts on top of the live colours map.
      const merged: Record<string, string> = { ...commissionColors };
      for (const [town, hex] of Object.entries(colorDrafts)) {
        if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) merged[town] = hex;
      }
      await saveCommissionColors(merged);
      setCommissionColors(merged);
      setColorDrafts({});
      setConfigMessage({
        type: 'success',
        text: 'Couleurs des commissions enregistrées.',
      });
    } catch (err) {
      console.error('Error saving commission colors:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, 'Erreur lors de l’enregistrement des couleurs.'),
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleResetCommissionColors = async () => {
    if (!window.confirm('Réinitialiser les couleurs des commissions par défaut ?')) return;
    setConfigSaving(true);
    try {
      await saveCommissionColors({ ...DEFAULT_COMMISSION_COLORS });
      setCommissionColors({ ...DEFAULT_COMMISSION_COLORS });
      setColorDrafts({});
      setConfigMessage({
        type: 'success',
        text: 'Couleurs des commissions réinitialisées.',
      });
    } catch (err) {
      console.error('Error resetting commission colors:', err);
      setConfigMessage({
        type: 'error',
        text: describeFirestoreError(err, 'Erreur lors de la réinitialisation.'),
      });
    } finally {
      setConfigSaving(false);
    }
  };


  const handleTestMail = async () => {
    if (!can('config_manage')) return;
    setMailTest((s) => ({ ...s, sending: true, result: null, error: null }));
    try {
      const target = mailTest.to.trim() || user?.email || '';
      const result = await apiClient.testMail(target || undefined);
      setMailTest({
        to: result.to,
        sending: false,
        result: {
          ok: result.ok,
          tcpOk: result.tcpOk,
          elapsedMs: result.elapsedMs,
          smtp: result.smtp,
          log: result.log,
        },
        error: null,
      });
    } catch (err: any) {
      setMailTest((s) => ({
        ...s,
        sending: false,
        error: err?.message || String(err),
        result: null,
      }));
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!can('members_manage')) return;
    if (!newMember.birthDate) {
      alert('La date de naissance est requise pour générer le matricule AAJ.');
      return;
    }
    if (!newMember.memberTypeLetter) {
      alert('Le type de membre est requis pour générer le matricule AAJ.');
      return;
    }
    setIsSaving(true);
    try {
      // Recompute matricule at submit to guard against concurrent additions
      const existing = allUsers
        .map((u: any) => (u?.licenseNumber ? String(u.licenseNumber) : ''))
        .filter(Boolean);
      const idx = computeNextIndex(existing, newMember.birthDate, newMember.memberTypeLetter);
      const matricule =
        buildMatricule(newMember.birthDate, newMember.memberTypeLetter, idx) || newMember.matricule;

      const typeEntry = memberTypesList.find((t) => t.letter === newMember.memberTypeLetter);
      const memberTypeLabel = typeEntry?.label || newMember.category;

      const { emailSent, tempPassword } = await adminCreateAccount({
        email: newMember.email,
        displayName: `${newMember.firstName} ${newMember.lastName}`.trim(),
        firstName: newMember.firstName,
        lastName: newMember.lastName,
        mobile: newMember.phone,
        category: memberTypeLabel,
        memberType: memberTypeLabel,
        memberTypeLetter: newMember.memberTypeLetter,
        birthDate: newMember.birthDate,
        licenseNumber: matricule,
        address: newMember.city,
        role: 'member',
        status: 'active',
      });
      setCreatedCredentials({
        matricule,
        email: newMember.email,
        tempPassword,
        emailSent,
        mode: 'created',
      });
      setIsAddMemberModalOpen(false);
      setNewMember({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        category: 'Architecte',
        memberTypeLetter: 'A',
        birthDate: '',
        matricule: '',
        city: 'Houmt Souk',
      });
    } catch (err) {
      console.error('Error adding member:', err);
      alert("Erreur lors de l'ajout du membre.");
    } finally {
      setIsSaving(false);
    }
  };

  const approveApplication = async (
    app: any,
    options: { trial?: boolean } = {}
  ): Promise<void> => {
    if (!can('members_manage')) return;
    if (!app.birthDate || !app.memberTypeLetter) {
      alert(
        'Cette demande ne contient pas la date de naissance ou le type de membre — impossible de générer le matricule AAJ. Demandez au candidat de soumettre une nouvelle demande.'
      );
      return;
    }
    const fullName = `${app.firstName || app.fullName} ${app.lastName || ''}`.trim();
    const confirmMessage = options.trial
      ? `Accorder un accès d'essai de 24h à ${fullName} ?\nUn compte adhérent sera créé et un email contenant le mot de passe temporaire lui sera envoyé. Le compteur de 24h démarre à sa première connexion.`
      : `Valider la demande de ${fullName} ?\nUn compte adhérent sera créé et un email contenant le mot de passe temporaire lui sera envoyé.`;
    if (!window.confirm(confirmMessage)) return;

    setApprovingApplicationId(app.id);
    try {
      const existing = allUsers
        .map((u: any) => (u?.licenseNumber ? String(u.licenseNumber) : ''))
        .filter(Boolean);
      const idx = computeNextIndex(existing, app.birthDate, app.memberTypeLetter);
      const matricule = buildMatricule(app.birthDate, app.memberTypeLetter, idx);

      const typeEntry = memberTypesList.find((t) => t.letter === app.memberTypeLetter);
      const memberTypeLabel = typeEntry?.label || app.category || 'Architecte';

      const firstName = app.firstName || (app.fullName || '').split(/\s+/)[0] || '';
      const lastName = app.lastName || (app.fullName || '').split(/\s+/).slice(1).join(' ') || '';

      const { emailSent, tempPassword } = await adminCreateAccount({
        email: app.email,
        displayName: `${firstName} ${lastName}`.trim() || app.fullName || app.email,
        firstName,
        lastName,
        mobile: app.phone,
        category: memberTypeLabel,
        memberType: memberTypeLabel,
        memberTypeLetter: app.memberTypeLetter,
        birthDate: app.birthDate,
        licenseNumber: matricule,
        address: app.city,
        role: 'member',
        status: 'active',
        ...(options.trial ? { trialStartedAt: new Date().toISOString() } : {}),
      });

      await updateDoc(doc(db, 'membership_applications', app.id), {
        status: 'approved',
        licenseNumber: matricule,
      });

      setCreatedCredentials({
        matricule,
        email: app.email,
        tempPassword,
        emailSent,
        mode: 'approved',
      });
    } catch (err) {
      console.error('Error approving application:', err);
      alert(
        options.trial
          ? "Erreur lors de l'octroi de l'essai de 24h."
          : 'Erreur lors de la validation de la demande.'
      );
    } finally {
      setApprovingApplicationId(null);
    }
  };

  const handleApproveApplication = (app: any) => approveApplication(app, { trial: false });
  const handleGrantTrialApplication = (app: any) => approveApplication(app, { trial: true });

  const handleRejectApplication = async (app: any) => {
    if (!can('members_manage')) return;
    if (!window.confirm(`Rejeter la demande de ${app.firstName || app.fullName} ?`)) return;
    setApprovingApplicationId(app.id);
    try {
      await updateDoc(doc(db, 'membership_applications', app.id), { status: 'rejected' });
    } catch (err) {
      console.error('Error rejecting application:', err);
      alert('Erreur lors du rejet de la demande.');
    } finally {
      setApprovingApplicationId(null);
    }
  };

  const handleDeleteApplication = async (app: any) => {
    if (!can('members_manage')) return;
    if (!window.confirm('Supprimer définitivement cette demande ?')) return;
    try {
      await deleteDoc(doc(db, 'membership_applications', app.id));
    } catch (err) {
      console.error('Error deleting application:', err);
      alert('Erreur lors de la suppression de la demande.');
    }
  };

  const getMemberLabel = (m: any) =>
    m?.displayName ||
    `${m?.firstName || ''} ${m?.lastName || ''}`.trim() ||
    m?.email ||
    'ce membre';

  const handleArchiveMember = async (targetMember: any) => {
    if (!can('members_manage')) return;
    if (targetMember.uid === user?.uid) {
      alert('Vous ne pouvez pas archiver votre propre compte.');
      return;
    }
    if (targetMember.role === 'super-admin') {
      alert('Les super-administrateurs ne peuvent pas être archivés.');
      return;
    }
    const memberLabel = getMemberLabel(targetMember);
    const confirmMessage =
      `Archiver ${memberLabel} ?\n\n` +
      `Le membre perdra l'accès à son compte mais toutes ses données (cotisations, historique) seront conservées. ` +
      `Vous pourrez le restaurer à tout moment depuis la vue « Archivés ».`;
    if (!window.confirm(confirmMessage)) return;
    try {
      await updateDoc(doc(db, 'users', targetMember.uid), {
        status: 'archived',
        archivedAt: new Date().toISOString(),
      });
      if (editingMember?.uid === targetMember.uid) {
        setEditingMember(null);
      }
    } catch (err) {
      console.error('Error archiving member:', err);
      alert("Erreur lors de l'archivage du membre.");
    }
  };

  const handleRestoreMember = async (targetMember: any) => {
    if (!can('members_manage')) return;
    const memberLabel = getMemberLabel(targetMember);
    if (!window.confirm(`Restaurer ${memberLabel} ?\n\nLe membre retrouvera l'accès à son compte.`))
      return;
    try {
      await updateDoc(doc(db, 'users', targetMember.uid), {
        status: 'active',
        archivedAt: null,
      });
      if (editingMember?.uid === targetMember.uid) {
        setEditingMember(null);
      }
    } catch (err) {
      console.error('Error restoring member:', err);
      alert('Erreur lors de la restauration du membre.');
    }
  };

  const handleDeleteMember = async (targetMember: any) => {
    if (!can('members_manage')) return;
    if (targetMember.uid === user?.uid) {
      alert('Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    if (targetMember.role === 'super-admin') {
      alert('Les super-administrateurs ne peuvent pas être supprimés.');
      return;
    }
    const memberLabel = getMemberLabel(targetMember);
    const confirmMessage =
      `⚠️ SUPPRESSION DÉFINITIVE\n\n` +
      `Supprimer définitivement ${memberLabel} ?\n\n` +
      `Cette action est IRRÉVERSIBLE et effacera toutes les données (cotisations, historique, accès). ` +
      `Pour conserver l'historique, utilisez plutôt l'archivage.`;
    if (!window.confirm(confirmMessage)) return;
    if (!window.confirm(`Confirmer la suppression définitive de ${memberLabel} ?`)) return;
    try {
      await deleteDoc(doc(db, 'users', targetMember.uid));
      if (editingMember?.uid === targetMember.uid) {
        setEditingMember(null);
      }
      alert('Membre supprimé définitivement.');
    } catch (err) {
      console.error('Error deleting member:', err);
      alert('Erreur lors de la suppression du membre.');
    }
  };

  const handleContactAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'contact_messages'), {
        userId: user.uid,
        userEmail: user.email,
        userName: userProfile?.displayName || user.email,
        subject: contactForm.subject,
        message: contactForm.message,
        fileBase64: newContactFile.base64,
        fileName: newContactFile.name,
        createdAt: serverTimestamp(),
        status: 'unread',
        replied: false,
      });
      alert("Votre message a été envoyé à l'administration.");
      setIsContactModalOpen(false);
      setContactForm({ subject: '', message: '' });
      setNewContactFile({ base64: '', name: '' });
    } catch (err) {
      console.error('Error sending message:', err);
      alert("Erreur lors de l'envoi du message.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateMessageStatus = async (messageId: string, updates: any) => {
    if (!can('messages_inbox')) return;
    try {
      await updateDoc(doc(db, 'contact_messages', messageId), updates);
    } catch (err) {
      console.error('Error updating message status:', err);
      alert('Erreur lors de la mise à jour du message.');
    }
  };

  // Send an email reply via the admin inbox. The backend updates the row
  // (replied + replied_at + reply_message + status) and returns the fresh
  // view, so we patch local state immediately instead of waiting for the
  // 8s onSnapshot poll.
  const handleSendReply = async (messageId: string) => {
    if (!can('messages_inbox')) return;
    const body = replyBody.trim();
    if (!body) {
      alert('Veuillez saisir une réponse avant d\'envoyer.');
      return;
    }
    setIsSendingReply(true);
    try {
      const res = await apiClient.replyToContactMessage(messageId, body);
      setAdminMessages((prev) => prev.map((m) => (m.id === messageId ? res.item : m)));
      setReplyingMessageId(null);
      setReplyBody('');
      if (res.emailSent) {
        alert('Réponse envoyée par email.');
      } else {
        alert(
          'Réponse enregistrée, mais l\'envoi de l\'email a échoué. Vérifiez la configuration SMTP.',
        );
      }
    } catch (err: any) {
      console.error('Error sending reply:', err);
      alert(err?.message || 'Erreur lors de l\'envoi de la réponse.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleToggleSuspense = async (targetUser: any) => {
    if (!can('users_editStatus')) return;
    const newStatus = targetUser.status === 'suspended' ? 'active' : 'suspended';
    const action = newStatus === 'suspended' ? 'suspendre' : 'reprendre';

    if (
      window.confirm(`Êtes-vous sûr de vouloir ${action} l'accès pour ${targetUser.displayName}?`)
    ) {
      try {
        await updateDoc(doc(db, 'users', targetUser.uid), {
          status: newStatus,
        });
      } catch (err) {
        console.error('Error toggling suspense:', err);
        alert('Erreur lors de la mise à jour du statut.');
      }
    }
  };

  const handleUpdateRole = async (targetUser: any, newRole: string) => {
    if (!can('users_editRole')) return;
    if (targetUser.uid === user?.uid) {
      alert('Vous ne pouvez pas modifier votre propre rôle.');
      return;
    }
    if ((targetUser.role || 'member') === newRole) return;
    if (!window.confirm(`Changer le rôle de ${targetUser.displayName} en « ${newRole} » ?`)) {
      return;
    }
    setRolesUpdatingUid(targetUser.uid);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), { role: newRole });
    } catch (err) {
      console.error('Error updating role:', err);
      alert('Erreur lors de la mise à jour du rôle.');
    } finally {
      setRolesUpdatingUid(null);
    }
  };

  const handleUpdateStatus = async (
    targetUser: any,
    newStatus: 'pending' | 'active' | 'suspended'
  ) => {
    if (!can('users_editStatus')) return;
    if (targetUser.uid === user?.uid) {
      alert('Vous ne pouvez pas modifier votre propre statut.');
      return;
    }
    if ((targetUser.status || 'pending') === newStatus) return;
    setRolesUpdatingUid(targetUser.uid);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), { status: newStatus });
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Erreur lors de la mise à jour du statut.');
    } finally {
      setRolesUpdatingUid(null);
    }
  };

  const handleTogglePermission = async (role: Role, permKey: string, value: boolean) => {
    if (!can('roles_manage')) return;
    if (role.isAllAccess) return;
    setSavingRoleId(role.id);
    // Optimistic update so the checkbox flips immediately, even while the
    // request is in flight.
    setRolesList((prev) =>
      prev.map((r) =>
        r.id === role.id
          ? { ...r, permissions: { ...(r.permissions ?? {}), [permKey]: value } }
          : r
      )
    );
    try {
      const nextPermissions = { ...(role.permissions ?? {}), [permKey]: value };
      await updateDoc(doc(db, 'roles', role.id), { permissions: nextPermissions });
    } catch (err) {
      console.error('Error toggling permission:', err);
      alert('Erreur lors de la mise à jour de la permission.');
      // Roll back optimistic change on failure.
      setRolesList((prev) =>
        prev.map((r) =>
          r.id === role.id
            ? { ...r, permissions: { ...(r.permissions ?? {}), [permKey]: !value } }
            : r
        )
      );
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleCreateRole = async () => {
    if (!can('roles_manage')) return;
    const name = newRoleForm.name.trim();
    if (!name) {
      alert('Le nom du rôle est requis.');
      return;
    }
    const id = sanitizeRoleId(name);
    if (!id) {
      alert('Nom de rôle invalide.');
      return;
    }
    if (rolesList.some((r) => r.id === id)) {
      alert('Un rôle avec cet identifiant existe déjà.');
      return;
    }
    setIsSaving(true);
    try {
      const initialPerms: Record<string, boolean> = Object.fromEntries(
        ALL_PERMISSION_KEYS.map((k) => [k, false])
      );
      await setDoc(doc(db, 'roles', id), {
        id,
        name,
        description: newRoleForm.description.trim() || '',
        permissions: initialPerms,
        isSystem: false,
        isAllAccess: false,
        createdAt: serverTimestamp(),
      });
      setNewRoleForm({ name: '', description: '' });
      setIsAddRoleModalOpen(false);
    } catch (err: any) {
      console.error('Error creating role:', err);
      alert(`Erreur lors de la création du rôle.\n${err?.code || ''} ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!can('roles_manage')) return;
    if (role.isSystem) {
      alert('Les rôles système ne peuvent pas être supprimés.');
      return;
    }
    const affected = allUsers.filter((u) => (u.role || 'member') === role.id).length;
    if (affected > 0) {
      alert(`${affected} utilisateur(s) ont ce rôle. Réassignez-les avant de supprimer le rôle.`);
      return;
    }
    if (!window.confirm(`Supprimer le rôle « ${role.name} » ?`)) return;
    try {
      await deleteDoc(doc(db, 'roles', role.id));
    } catch (err) {
      console.error('Error deleting role:', err);
      alert('Erreur lors de la suppression du rôle.');
    }
  };

  const handleTogglePartnerVisibility = async (partnerId: string, currentVisibility: boolean) => {
    if (!can('partners_manage')) return;
    try {
      await updateDoc(doc(db, 'partners', partnerId), {
        isVisible: !currentVisibility,
      });
    } catch (err) {
      console.error('Error toggling partner visibility:', err);
      alert('Erreur lors de la mise à jour de la visibilité.');
    }
  };

  const handleSubmitProfileChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'profile_updates'), {
        uid: user.uid,
        userEmail: user.email,
        ...profileForm,
        displayName: `${profileForm.firstName} ${profileForm.lastName}`,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setIsRequestModalOpen(false);
      alert("Votre demande de modification a été soumise à l'administration pour validation.");
    } catch (err) {
      console.error('Error submitting profile update:', err);
      alert('Erreur lors de la soumission de la demande.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveProfileChange = async (request: any) => {
    if (!can('profileRequests_manage')) return;
    setIsSaving(true);
    try {
      // 1. Update the user document (using setDoc with merge to avoid 'no document to update' error)
      const userRef = doc(db, 'users', request.uid);
      await setDoc(
        userRef,
        {
          firstName: request.firstName,
          lastName: request.lastName,
          displayName: request.displayName,
          mobile: request.mobile,
          email: request.email,
          category: request.category,
          licenseNumber: request.licenseNumber,
          address: request.address,
        },
        { merge: true }
      );

      // 2. Mark request as approved
      const requestRef = doc(db, 'profile_updates', request.id);
      await updateDoc(requestRef, {
        status: 'approved',
      });

      alert('Modification approuvée et appliquée au profil.');
    } catch (err) {
      console.error('Error approving profile update:', err);
      alert("Erreur lors de l'approbation.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectProfileChange = async (requestId: string) => {
    if (!can('profileRequests_manage')) return;
    if (window.confirm('Êtes-vous sûr de vouloir rejeter cette demande ?')) {
      try {
        await updateDoc(doc(db, 'profile_updates', requestId), {
          status: 'rejected',
        });
      } catch (err) {
        console.error('Error rejecting profile update:', err);
        alert('Erreur lors du rejet.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (err) {
      console.error('Logout Error:', err);
    }
  };

  if (loading) {
    return (
      <div className="pt-16 min-h-[90vh] flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-aaj-royal" size={48} />
      </div>
    );
  }

  if (user) {
    // Sidebar inner content — defined once so it can be rendered either
    // inline (pinned) or inside a body-portal overlay (auto-hidden). We
    // portal in the unpinned case because the `fixed` positioning gets
    // anchored to the nearest transformed ancestor when rendered inside
    // the normal page flow, which produced a broken half-screen overlay.
    const sidebarContent = (
      <>
        <div className="flex items-center justify-between gap-2 mb-5 px-2">
          <span className="text-[9px] uppercase tracking-[3px] text-aaj-cyan font-black">
            Navigation
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleSidebarPinned}
              title={
                sidebarPinned ? 'Désépingler (masquer automatiquement)' : 'Épingler le menu'
              }
              aria-pressed={sidebarPinned}
              className="p-1.5 text-aaj-gray hover:text-aaj-cyan rounded hover:bg-aaj-soft transition-colors"
            >
              {sidebarPinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
            {!sidebarPinned && (
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                title="Fermer"
                className="p-1.5 text-aaj-gray hover:text-aaj-cyan rounded hover:bg-aaj-soft transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <nav className="space-y-1">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: "Vue d'ensemble", badge: 0, perm: 'dashboard_view' },
            { id: 'commissions', icon: <Building2 size={18} />, label: 'Avis Commissions', badge: 0, perm: 'commissions_view' },
            { id: 'bibliotheque', icon: <BookOpen size={18} />, label: 'Bibliothèque', badge: 0, perm: 'library_view' },
            { id: 'documents', icon: <MessageSquare size={18} />, label: 'Messages Admins', badge: 0, perm: 'messages_send' },
            { id: 'member-partners', icon: <Shield size={18} />, label: 'Nos Partenaires', badge: 0, perm: 'partners_view' },
            { id: 'annuaire', icon: <Users size={18} />, label: 'Annuaire des Membres', badge: 0, perm: 'annuaire_view' },
            { id: 'jobs', icon: <Briefcase size={18} />, label: 'Emplois & Stages', badge: 0, perm: 'jobs_view' },
            { id: 'unesco', icon: <Landmark size={18} />, label: 'Djerba UNESCO', badge: 0, perm: 'unesco_view' },
            { id: 'notifications', icon: <Bell size={18} />, label: 'Notifications', badge: notifUnreadCount, perm: null },
            { id: 'notifications-prefs', icon: <SlidersHorizontal size={18} />, label: 'Préférences notifs', badge: 0, perm: null },
            { id: 'settings', icon: <Settings size={18} />, label: 'Mon Profil', badge: 0, perm: null },
          ].filter((item) => item.perm === null || can(item.perm)).map((item) => (
            <button
              key={item.id}
              onClick={() => selectTab(item.id)}
              className={`w-full flex items-center justify-between px-6 py-4 rounded text-[11px] font-black uppercase tracking-[2px] transition-all ${
                activeTab === item.id
                  ? 'bg-aaj-night text-white shadow-[0_0_20px_rgba(0,229,255,0.25)] border border-aaj-cyan/40'
                  : 'text-aaj-gray hover:bg-aaj-soft border border-transparent hover:border-aaj-cyan/30'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={activeTab === item.id ? 'text-aaj-cyan' : ''}>{item.icon}</span>
                {item.label}
              </div>
              {item.badge > 0 && (
                <span className="min-w-5 h-5 px-1.5 bg-aaj-magenta text-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse shadow-[0_0_12px_rgba(255,61,113,0.5)]">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-6 pt-6 border-t border-aaj-border/60">
          <button
            type="button"
            onClick={() => {
              setIsContactModalOpen(true);
              if (!sidebarPinned) setSidebarOpen(false);
            }}
            className="group w-full flex items-center gap-4 px-6 py-4 rounded text-[11px] font-black uppercase tracking-[2px] text-aaj-gray hover:bg-aaj-night hover:text-white border border-aaj-border hover:border-aaj-cyan/40 hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] transition-all"
          >
            <MessageSquare size={18} className="text-aaj-royal group-hover:text-aaj-cyan transition-colors" />
            Contacter l&apos;administration
          </button>
        </div>
        {(() => {
          const adminItems = [
            { id: 'admin-roles', icon: <KeyRound size={18} />, label: 'Rôles & Permissions', perm: 'roles_manage' },
            { id: 'admin-config', icon: <Settings size={18} />, label: 'Paramètres', perm: 'config_manage' },
            {
              id: 'admin-members',
              icon: <Users size={18} />,
              label: 'Gérer Adhésions',
              perm: 'members_manage',
              badge: membershipApplications.filter((a: any) => (a.status || 'pending') === 'pending').length,
            },
            { id: 'admin-partners', icon: <Shield size={18} />, label: 'Gérer Partenaires', perm: 'partners_manage' },
            {
              id: 'admin-profile-requests',
              icon: <CheckCircle2 size={18} />,
              label: 'Validations Profils',
              perm: 'profileRequests_manage',
              badge: profileRequests.filter((r) => r.status === 'pending').length,
            },
            { id: 'admin-documents', icon: <BookOpen size={18} />, label: 'Gérer Bibliothèque', perm: 'library_manage' },
            { id: 'admin-commissions', icon: <Building2 size={18} />, label: 'Dépôts des Avis', perm: 'commissions_create' },
            {
              id: 'publish-job',
              icon: <Briefcase size={18} />,
              label: 'Publier une offre',
              perm: 'jobs_create',
            },
            {
              id: 'admin-jobs',
              icon: <GraduationCap size={18} />,
              label: 'Modérer Emplois',
              perm: 'jobs_manage',
              badge: jobItems.filter((j) => (j.status || 'pending') === 'pending').length,
            },
            { id: 'admin-news', icon: <FileText size={18} />, label: 'Actions & Infos', perm: 'news_manage' },
            { id: 'admin-page-home', icon: <LayoutDashboard size={18} />, label: "Page d'Accueil", perm: 'config_manage' },
            { id: 'admin-page-about', icon: <BookOpen size={18} />, label: 'Page À Propos', perm: 'config_manage' },
            { id: 'admin-page-partners', icon: <Shield size={18} />, label: 'Page Partenaires', perm: 'config_manage' },
            {
              id: 'admin-messages',
              icon: <Mail size={18} />,
              label: 'Messages Entrants',
              perm: 'messages_inbox',
              badge: adminMessages.filter((m) => m.status === 'unread').length,
            },
            {
              id: 'admin-chat',
              icon: <MessagesSquare size={18} />,
              label: 'Modération Discussions',
              perm: 'chat_manage',
              badge: chatPendingApprovals,
            },
            { id: 'admin-unesco', icon: <MapPinned size={18} />, label: 'Paramètres UNESCO', perm: 'unesco_manage' },
            {
              id: 'admin-unesco-requests',
              icon: <ClipboardList size={18} />,
              label: 'Demandes UNESCO',
              perm: 'unesco_requests_manage',
              badge: unescoPendingReview,
            },
          ].filter((item) =>
            // Special-case: the merged Demandes UNESCO tab is also accessible
            // to anyone who held the legacy unesco_permits_review permission.
            item.id === 'admin-unesco-requests'
              ? can('unesco_requests_manage') || can('unesco_permits_review')
              : can(item.perm)
          );

          if (adminItems.length === 0) return null;

          return (
            <div className="mt-12 space-y-1">
              <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-gray px-6 mb-4 mt-8 flex items-center gap-2">
                <Shield size={12} className="text-aaj-cyan" /> Administration
                <span className="flex-1 h-px bg-aaj-cyan/30 ml-2" aria-hidden="true" />
              </h3>
              {adminItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectTab(item.id)}
                  className={`w-full flex items-center justify-between px-6 py-4 rounded text-[11px] font-black uppercase tracking-[2px] transition-all ${
                    activeTab === item.id
                      ? 'bg-aaj-dark text-white shadow-lg'
                      : 'text-aaj-gray hover:bg-slate-50 border border-transparent hover:border-aaj-border'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={activeTab === item.id ? 'text-aaj-cyan' : ''}>{item.icon}</span>
                    {item.label}
                  </div>
                  {item.badge > 0 && (
                    <span className="w-5 h-5 bg-aaj-magenta text-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse shadow-[0_0_12px_rgba(255,61,113,0.5)]">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })()}
      </>
    );

    return (
      <div className="pt-16 min-h-screen bg-white">
        {mustChangePassword && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-aaj-dark/95 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white w-full max-w-md shadow-2xl rounded overflow-hidden"
            >
              <div className="p-8 border-b border-aaj-border bg-slate-50">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-aaj-soft rounded flex items-center justify-center text-aaj-royal flex-shrink-0 border border-aaj-royal/10">
                    <KeyRound size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-aaj-dark">
                      Changement de mot de passe requis
                    </h3>
                    <p className="text-[11px] text-aaj-gray font-bold uppercase tracking-widest mt-2 leading-relaxed">
                      Votre mot de passe temporaire doit être remplacé avant de continuer.
                    </p>
                  </div>
                </div>
              </div>
              <form onSubmit={handleForcedPasswordChange} className="p-8 space-y-6">
                {forcePwdError && (
                  <div className="p-4 bg-aaj-magenta/10 text-aaj-magenta rounded border border-aaj-magenta/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-3">
                    <XCircle size={16} />
                    {forcePwdError}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1">
                    Nouveau mot de passe
                  </label>
                  <PasswordInput
                    value={forcePwdForm.password}
                    onChange={(e) => setForcePwdForm({ ...forcePwdForm, password: e.target.value })}
                    minLength={6}
                    required
                    autoFocus
                    className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal focus:bg-white transition-all text-sm font-medium"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1">
                    Confirmer le mot de passe
                  </label>
                  <PasswordInput
                    value={forcePwdForm.confirm}
                    onChange={(e) => setForcePwdForm({ ...forcePwdForm, confirm: e.target.value })}
                    minLength={6}
                    required
                    className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal focus:bg-white transition-all text-sm font-medium"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forcePwdSubmitting}
                  className="w-full bg-aaj-dark text-white py-4 rounded font-black uppercase tracking-[3px] text-xs hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  {forcePwdSubmitting ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Save size={16} />
                      Enregistrer et continuer
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-[10px] font-black uppercase tracking-[3px] text-aaj-gray hover:text-aaj-dark transition-colors py-2"
                >
                  Se déconnecter
                </button>
              </form>
            </motion.div>
          </div>
        )}
        {showWelcomeBanner && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-aaj-dark/80 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white w-full max-w-lg shadow-2xl rounded overflow-hidden"
            >
              <div className="p-8 border-b border-aaj-border bg-gradient-to-br from-aaj-soft to-white">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-aaj-royal/10 rounded flex items-center justify-center text-aaj-royal flex-shrink-0">
                    <Clock size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black block">
                      Accès d&apos;essai gratuit — 24h
                    </span>
                    <h3 className="text-xl font-black uppercase tracking-tight text-aaj-dark mt-1">
                      Bienvenue sur la plateforme AAJ
                    </h3>
                    {trialExpiresAtMs && trialState === 'in-trial' && (() => {
                      const remainingMs = trialExpiresAtMs - Date.now();
                      const hours = Math.max(0, Math.floor(remainingMs / 3_600_000));
                      const minutes = Math.max(
                        0,
                        Math.floor((remainingMs % 3_600_000) / 60_000)
                      );
                      return (
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-aaj-gray">
                          Temps restant : {hours}h {String(minutes).padStart(2, '0')}min
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="p-8 space-y-5 text-sm text-aaj-dark">
                <p className="leading-relaxed">
                  Pour continuer après cette période, merci de régler votre cotisation
                  annuelle :
                </p>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[2px] text-aaj-royal mb-2">
                    Trésoriers AAJ
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="font-bold">M. Salah Najaa</span>
                      <span className="text-aaj-gray">(Houmt Souk)</span>
                      <span className="ml-auto inline-flex items-center gap-1 text-aaj-royal font-bold">
                        <Phone size={12} /> 52 655 382
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="font-bold">Mme Oumayma Engadi</span>
                      <span className="text-aaj-gray">(Midoun)</span>
                      <span className="ml-auto inline-flex items-center gap-1 text-aaj-royal font-bold">
                        <Phone size={12} /> 94 053 286
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="border border-aaj-border rounded p-4 bg-slate-50/50">
                  <p className="text-[10px] font-black uppercase tracking-[2px] text-aaj-royal mb-2">
                    Virement bancaire — BNA
                  </p>
                  <p className="font-mono text-sm tracking-wide">
                    RIB : 03 902 013 0101 106688 12
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWelcomeBannerDismissed(true)}
                  className="w-full bg-aaj-dark text-white py-3 rounded font-black uppercase tracking-[3px] text-xs hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all active:scale-[0.98]"
                >
                  J&apos;ai compris — accéder à la plateforme
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {trialState === 'expired' && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-aaj-dark/95 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white w-full max-w-lg shadow-2xl rounded overflow-hidden"
            >
              <div className="p-8 border-b border-aaj-border bg-aaj-magenta/10">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-aaj-magenta/15 rounded flex items-center justify-center text-aaj-magenta flex-shrink-0">
                    <XCircle size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-[3px] text-aaj-magenta font-black block">
                      Période d&apos;essai expirée
                    </span>
                    <h3 className="text-xl font-black uppercase tracking-tight text-aaj-dark mt-1">
                      Cotisation requise pour continuer
                    </h3>
                    <p className="text-[11px] text-aaj-gray font-bold uppercase tracking-widest mt-2 leading-relaxed">
                      Vos 24h d&apos;accès d&apos;essai sont écoulées. Réglez votre
                      cotisation annuelle pour réactiver votre compte.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-8 space-y-5 text-sm text-aaj-dark">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[2px] text-aaj-royal mb-2">
                    Trésoriers AAJ
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="font-bold">M. Salah Najaa</span>
                      <span className="text-aaj-gray">(Houmt Souk)</span>
                      <span className="ml-auto inline-flex items-center gap-1 text-aaj-royal font-bold">
                        <Phone size={12} /> 52 655 382
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="font-bold">Mme Oumayma Engadi</span>
                      <span className="text-aaj-gray">(Midoun)</span>
                      <span className="ml-auto inline-flex items-center gap-1 text-aaj-royal font-bold">
                        <Phone size={12} /> 94 053 286
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="border border-aaj-border rounded p-4 bg-slate-50/50">
                  <p className="text-[10px] font-black uppercase tracking-[2px] text-aaj-royal mb-2">
                    Virement bancaire — BNA
                  </p>
                  <p className="font-mono text-sm tracking-wide">
                    RIB : 03 902 013 0101 106688 12
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full bg-aaj-dark text-white py-3 rounded font-black uppercase tracking-[3px] text-xs hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <LogOut size={16} /> Se déconnecter
                </button>
              </div>
            </motion.div>
          </div>
        )}
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 py-4 md:py-6">
          {/* Header Dashboard — welcome strip with cyan accent line */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4"
          >
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-aaj-cyan/40 via-aaj-border to-transparent" aria-hidden="true" />
            <div>
              <div className="inline-flex items-center gap-3 mb-2">
                <span className="w-6 h-px bg-aaj-cyan" aria-hidden="true" />
                <span className="text-[10px] uppercase tracking-[3px] text-aaj-cyan font-black">
                  Espace Privé
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tighter leading-tight break-words">
                Bienvenue, <span className="text-aaj-royal">{userProfile?.displayName || 'Cher Confrère'}</span>
              </h1>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-4">
              <div className="text-right">
                <span className="block text-[10px] uppercase font-black tracking-widest text-aaj-gray">
                  Statut Adhérent
                </span>
                <span className="text-sm font-bold uppercase tracking-widest text-aaj-cyan">
                  {userProfile?.role === 'admin'
                    ? 'Administrateur'
                    : userProfile?.role === 'representative'
                      ? 'Représentant'
                      : 'Membre Actif 2026'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-10 h-10 border border-aaj-border flex items-center justify-center text-aaj-magenta hover:bg-aaj-magenta hover:text-white hover:border-aaj-magenta transition-all rounded shadow-sm"
                aria-label="Se déconnecter"
              >
                <LogOut size={18} />
              </button>
            </div>
          </motion.div>

          {/* Floating "open menu" button surfaces when the sidebar is
              auto-hidden (pin released) and currently closed. */}
          {!sidebarPinned && !sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
              className="mb-6 inline-flex items-center gap-2 px-4 py-2 border border-aaj-border rounded text-[10px] uppercase tracking-[2px] font-black text-aaj-dark bg-white hover:bg-slate-50"
            >
              <PanelLeftOpen size={14} /> Menu
            </button>
          )}

          <div
            className={
              sidebarPinned
                ? 'flex flex-col lg:flex-row gap-8 lg:gap-12 items-start'
                : 'block'
            }
          >
            {/* Sidebar Navigation — rendered inline only when pinned. When
                auto-hidden we move it into a body-portal below to escape
                any transformed ancestor that would break position: fixed. */}
            {sidebarPinned && (
              <aside className="w-full lg:w-72 lg:shrink-0">{sidebarContent}</aside>
            )}

            {/* Main Dashboard Grid */}
            <main
              className={
                sidebarPinned
                  ? 'flex-1 min-w-0 space-y-12'
                  : 'w-full min-w-0 space-y-12'
              }
            >
              <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && can('dashboard_view') && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-12"
                  >
                    {/* Bento Grid Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="md:col-span-2 border border-aaj-border p-10 bg-slate-50/50 rounded flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black flex items-center gap-4 flex-1">
                              Annonces Internes <span className="h-px flex-1 bg-aaj-border"></span>
                            </h3>
                            <button
                              onClick={() => setActiveTab('news-history')}
                              className="text-[10px] font-black uppercase tracking-widest text-aaj-royal ml-4 hover:underline"
                            >
                              Voir Historique
                            </button>
                          </div>
                          <div className="space-y-4">
                            {newsItems.slice(0, 2).map((item, idx) => (
                              <NewsPostCard
                                key={item.id || idx}
                                item={item}
                                compact
                                onClick={() => setSelectedNews(item)}
                              />
                            ))}
                            {newsItems.length === 0 && (
                              <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest italic py-4">
                                Aucune annonce publiée
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="border border-aaj-border p-10 flex flex-col text-center justify-center bg-white rounded">
                          <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4">
                            Cotisation
                          </span>
                          <div className="text-4xl font-black text-aaj-dark mb-2">2026</div>
                          <div className="inline-block px-3 py-1 bg-aaj-cyan/10 text-aaj-cyan text-[10px] font-black uppercase tracking-[2px] rounded border border-aaj-cyan/30 mx-auto">
                            À jour
                          </div>
                          <p className="text-[10px] text-aaj-gray mt-6 font-bold uppercase tracking-widest leading-relaxed">
                            Prochain renouvellement : <br /> Janvier 2027
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Access Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {['Houmt Souk', 'Midoun', 'Ajim'].map((town) => {
                        const townPVs = commissionPVs.filter((pv) => pv.town === town);
                        const latestPV = townPVs[0];
                        const totalAvis = townPVs.reduce(
                          (acc, curr) => acc + (parseInt(curr.count) || 0),
                          0
                        );
                        const townColor = colorForTown(town, commissionColors);
                        const formattedDate = latestPV?.date
                          ? new Date(latestPV.date).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : null;

                        return (
                          <div
                            key={town}
                            onClick={() => {
                              setSelectedCommune(town);
                              setActiveTab('commissions');
                            }}
                            className="border border-aaj-border rounded bg-white group hover:border-aaj-royal transition-all cursor-pointer overflow-hidden"
                          >
                            <div
                              className="h-1.5"
                              style={{ backgroundColor: townColor }}
                              aria-hidden="true"
                            />
                            <div className="p-6">
                              <span
                                className="text-[9px] font-black uppercase tracking-widest mb-2 block"
                                style={{ color: townColor }}
                              >
                                {town}
                              </span>
                              <div className="flex justify-between items-end">
                                <div>
                                  <p className="text-2xl font-black uppercase tracking-tighter">
                                    {totalAvis} Avis
                                  </p>
                                  {latestPV ? (
                                    <p className="text-[10px] font-bold text-aaj-gray uppercase mt-1">
                                      Dernière : {formattedDate}
                                      {latestPV.type ? ` · ${latestPV.type}` : ''}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] font-bold text-aaj-gray uppercase mt-1 italic">
                                      Aucun avis
                                    </p>
                                  )}
                                </div>
                                <div
                                  className={`text-[9px] font-black px-2 py-1 uppercase rounded bg-aaj-cyan/10 text-aaj-cyan group-hover:bg-aaj-royal group-hover:text-white transition-all`}
                                >
                                  Consulter
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Carte Administration : gestion des demandes UNESCO.
                        Visible uniquement pour les rôles ayant accès à
                        l'onglet "Demandes UNESCO" (Agent d'administration
                        ou Administrateur). Click → ouvre l'onglet de gestion. */}
                    {(can('unesco_requests_manage') || can('unesco_permits_review')) && (
                      <div>
                        <h3 className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black flex items-center gap-4 mb-6">
                          Administration <span className="h-px flex-1 bg-aaj-border"></span>
                        </h3>
                        <button
                          type="button"
                          onClick={() => setActiveTab('admin-unesco-requests')}
                          aria-label="Ouvrir la gestion des demandes UNESCO"
                          className="w-full text-left border border-aaj-border rounded bg-white group hover:border-aaj-royal transition-all overflow-hidden"
                        >
                          <div className="h-1.5 bg-aaj-royal" aria-hidden="true" />
                          <div className="p-6 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                            <div className="flex items-center gap-4 md:flex-1">
                              <div className="w-12 h-12 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-aaj-royal group-hover:bg-aaj-royal group-hover:text-white transition-colors shrink-0">
                                <ClipboardList size={20} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-aaj-royal block">
                                  Djerba UNESCO
                                </span>
                                <p className="text-lg font-black uppercase tracking-tight">
                                  Gestion des demandes
                                </p>
                                <p className="text-[10px] font-bold text-aaj-gray uppercase tracking-wide mt-0.5">
                                  Consultation, instruction, décision
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 md:gap-6 flex-wrap">
                              <DashStat
                                label="En attente"
                                value={unescoPendingReview}
                                tone="indigo"
                              />
                              <DashStat
                                label="Favorables"
                                value={unescoStatusCounts.approved || 0}
                                tone="emerald"
                              />
                              <DashStat
                                label="Défavorables"
                                value={unescoStatusCounts.rejected || 0}
                                tone="red"
                              />
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-[2px] px-4 py-2 rounded bg-blue-50 text-aaj-royal group-hover:bg-aaj-royal group-hover:text-white transition-all md:ml-auto">
                              Gérer →
                            </div>
                          </div>
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'annuaire' && can('annuaire_view') && (
                  <motion.div
                    key="annuaire"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-8 pb-6 border-b border-aaj-border">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">
                        Annuaire des Adhérents
                      </h2>
                      <div className="flex items-center gap-6">
                        <div className="flex bg-slate-100 p-1 rounded">
                          <button
                            onClick={() => setAnnuaireViewMode('grid')}
                            className={`p-2 rounded transition-all ${annuaireViewMode === 'grid' ? 'bg-white shadow text-aaj-royal' : 'text-aaj-gray hover:text-aaj-dark'}`}
                          >
                            <Grid size={16} />
                          </button>
                          <button
                            onClick={() => setAnnuaireViewMode('list')}
                            className={`p-2 rounded transition-all ${annuaireViewMode === 'list' ? 'bg-white shadow text-aaj-royal' : 'text-aaj-gray hover:text-aaj-dark'}`}
                          >
                            <List size={16} />
                          </button>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                          {allUsers.filter((m) => m.status !== 'archived').length} Architectes
                        </div>
                      </div>
                    </div>

                    {annuaireViewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {allUsers
                          .filter((m) => m.status !== 'suspended' && m.status !== 'archived')
                          .map((member) => (
                            <div
                              key={member.uid}
                              className="p-6 border border-aaj-border rounded bg-white hover:shadow-xl transition-shadow group"
                            >
                              <div className="flex gap-6">
                                <div className="w-16 h-16 bg-slate-50 border border-aaj-border rounded flex items-center justify-center text-aaj-royal group-hover:bg-aaj-royal group-hover:text-white transition-colors overflow-hidden">
                                  {member.photoBase64 ? (
                                    <img
                                      src={member.photoBase64}
                                      alt={member.displayName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <UserCircle size={32} />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-black uppercase tracking-tight mb-1">
                                    {member.displayName}
                                  </h3>
                                  <p className="text-[10px] font-black text-aaj-royal uppercase tracking-widest mb-4">
                                    {member.category}
                                  </p>
                                  <div className="space-y-2">
                                    {member.mobile && (
                                      <div className="flex items-center gap-2 text-[11px] text-aaj-gray font-bold uppercase tracking-wide">
                                        <Phone size={12} /> {member.mobile}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 text-[11px] text-aaj-gray font-bold uppercase tracking-wide">
                                      <Mail size={12} /> {member.email}
                                    </div>
                                    {member.address && (
                                      <div className="flex items-center gap-2 text-[11px] text-aaj-gray font-bold uppercase tracking-wide">
                                        <MapPin size={12} /> {member.address}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="border border-aaj-border rounded overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 border-b border-aaj-border">
                            <tr>
                              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                                Architecte
                              </th>
                              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                                Contact
                              </th>
                              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray text-right">
                                Localité
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-aaj-border">
                            {allUsers
                              .filter((m) => m.status !== 'suspended' && m.status !== 'archived')
                              .map((member) => (
                                <tr
                                  key={member.uid}
                                  className="hover:bg-slate-50/50 transition-all group"
                                >
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-aaj-gray group-hover:text-aaj-royal transition-colors overflow-hidden">
                                        {member.photoBase64 ? (
                                          <img
                                            src={member.photoBase64}
                                            alt={member.displayName}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <UserCircle size={18} />
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-sm font-black uppercase tracking-tight">
                                          {member.displayName}
                                        </p>
                                        <p className="text-[9px] text-aaj-royal font-black uppercase tracking-widest">
                                          {member.category}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold text-aaj-dark uppercase">
                                        {member.email}
                                      </p>
                                      <p className="text-[10px] font-bold text-aaj-gray uppercase">
                                        {member.mobile || 'N/A'}
                                      </p>
                                    </div>
                                  </td>
                                  <td className="p-4 text-right">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-aaj-dark">
                                      {member.address || 'N/A'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'commissions' && can('commissions_view') && (
                  <motion.div
                    key="commissions"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-aaj-border">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">
                        {selectedCommune
                          ? `Avis Commissions : ${selectedCommune}`
                          : 'Avis des Commissions Techniques'}
                      </h2>
                      {selectedCommune && (
                        <button
                          onClick={() => setSelectedCommune(null)}
                          className="text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:text-aaj-royal flex items-center gap-2 border border-aaj-border px-4 py-2 rounded"
                        >
                          <XCircle size={14} /> Vue d&apos;ensemble
                        </button>
                      )}
                    </div>

                    {selectedCommune ? (
                      <div className="space-y-4">
                        {can('commissions_create') && (() => {
                          const archivedCount = commissionPVs.filter(
                            (pv) => pv.town === selectedCommune && pv.archivedAt
                          ).length;
                          if (archivedCount === 0 && !showArchivedPVs) return null;
                          return (
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => setShowArchivedPVs((v) => !v)}
                                className={[
                                  'inline-flex items-center gap-2 px-3 py-2 rounded text-[10px] font-black uppercase tracking-widest border transition-colors',
                                  showArchivedPVs
                                    ? 'bg-aaj-dark text-white border-aaj-dark'
                                    : 'bg-white text-aaj-dark border-aaj-border hover:border-aaj-royal',
                                ].join(' ')}
                              >
                                {showArchivedPVs ? (
                                  <ArchiveRestore size={12} />
                                ) : (
                                  <Archive size={12} />
                                )}
                                {showArchivedPVs
                                  ? 'Masquer les archives'
                                  : `Voir les archives (${archivedCount})`}
                              </button>
                            </div>
                          );
                        })()}
                        {commissionPVs
                          .filter((pv) => pv.town === selectedCommune)
                          .filter((pv) => (showArchivedPVs ? true : !pv.archivedAt))
                          .map((pv, idx) => {
                            const pvFiles: PVFile[] = Array.isArray(pv.files) && pv.files.length > 0
                              ? pv.files
                              : pv.fileBase64
                                ? [{
                                    id: `legacy-${idx}`,
                                    url: pv.fileBase64,
                                    name: pv.fileName || `PV_Commission_${selectedCommune}_${pv.date}.pdf`,
                                    type: 'application/pdf',
                                  }]
                                : [];
                            const isEditing = editingPVId === pv.id;
                            const isArchived = !!pv.archivedAt;
                            const inFlight = pvActionInFlight === pv.id;
                            return (
                            <div
                              key={pv.id || idx}
                              className={[
                                'p-6 border rounded bg-white hover:border-aaj-royal group transition-all space-y-4',
                                isArchived
                                  ? 'border-aaj-amber/50 bg-aaj-amber/10'
                                  : 'border-aaj-border',
                              ].join(' ')}
                            >
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                                    <span
                                      className="text-[10px] font-black uppercase tracking-widest"
                                      style={{ color: colorForTown(pv.town, commissionColors) }}
                                    >
                                      Commission du{' '}
                                      {new Date(pv.date).toLocaleDateString('fr-FR', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                      })}
                                    </span>
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    <span className="text-[11px] font-black uppercase tracking-tighter">
                                      {pv.count} Dossiers traités
                                    </span>
                                    {pv.type && (
                                      <>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                        <span
                                          className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border"
                                          style={{
                                            color: colorForTown(pv.town, commissionColors),
                                            borderColor: colorForTown(pv.town, commissionColors) + '40',
                                          }}
                                        >
                                          {pv.type}
                                        </span>
                                      </>
                                    )}
                                    {isArchived && (
                                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-aaj-amber/15 text-aaj-amber border border-aaj-amber/40 flex items-center gap-1">
                                        <Archive size={10} /> Archivé
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">
                                    {pvFiles.length} fichier{pvFiles.length > 1 ? 's' : ''} joint{pvFiles.length > 1 ? 's' : ''}
                                  </p>
                                </div>
                                {can('commissions_create') && !isEditing && (
                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditPV(pv)}
                                      disabled={inFlight}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-aaj-border bg-white text-[10px] font-black uppercase tracking-widest text-aaj-dark hover:border-aaj-royal hover:text-aaj-royal transition-colors disabled:opacity-50"
                                      title="Modifier"
                                    >
                                      <Pencil size={12} /> Modifier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleArchivePV(pv)}
                                      disabled={inFlight}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-aaj-border bg-white text-[10px] font-black uppercase tracking-widest text-aaj-dark hover:border-aaj-amber hover:text-aaj-amber transition-colors disabled:opacity-50"
                                      title={isArchived ? 'Désarchiver' : 'Archiver'}
                                    >
                                      {isArchived ? (
                                        <>
                                          <ArchiveRestore size={12} /> Désarchiver
                                        </>
                                      ) : (
                                        <>
                                          <Archive size={12} /> Archiver
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePV(pv)}
                                      disabled={inFlight}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-aaj-border bg-white text-[10px] font-black uppercase tracking-widest text-aaj-dark hover:border-aaj-magenta hover:text-aaj-magenta transition-colors disabled:opacity-50"
                                      title="Supprimer"
                                    >
                                      <Trash2 size={12} /> Supprimer
                                    </button>
                                  </div>
                                )}
                              </div>
                              {isEditing && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border border-aaj-border rounded bg-slate-50">
                                  <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-aaj-gray mb-1">
                                      Date
                                    </label>
                                    <input
                                      type="date"
                                      value={editPVForm.date}
                                      onChange={(e) =>
                                        setEditPVForm({ ...editPVForm, date: e.target.value })
                                      }
                                      className="w-full bg-white border border-aaj-border rounded px-3 py-2 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-aaj-gray mb-1">
                                      Dossiers
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={editPVForm.count}
                                      onChange={(e) =>
                                        setEditPVForm({ ...editPVForm, count: e.target.value })
                                      }
                                      className="w-full bg-white border border-aaj-border rounded px-3 py-2 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-aaj-gray mb-1">
                                      Type
                                    </label>
                                    <input
                                      type="text"
                                      list="commission-types-edit"
                                      value={editPVForm.type}
                                      onChange={(e) =>
                                        setEditPVForm({ ...editPVForm, type: e.target.value })
                                      }
                                      placeholder="Ordinaire, Extraordinaire..."
                                      className="w-full bg-white border border-aaj-border rounded px-3 py-2 text-xs"
                                    />
                                    <datalist id="commission-types-edit">
                                      {commissionTypesList.map((t) => (
                                        <option key={t} value={t} />
                                      ))}
                                    </datalist>
                                  </div>
                                  <div className="sm:col-span-3 flex items-center justify-end gap-2 pt-2">
                                    <button
                                      type="button"
                                      onClick={handleCancelEditPV}
                                      disabled={inFlight}
                                      className="px-4 py-2 rounded border border-aaj-border bg-white text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:text-aaj-dark transition-colors disabled:opacity-50"
                                    >
                                      Annuler
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => pv.id && handleSaveEditPV(pv.id)}
                                      disabled={inFlight}
                                      className="inline-flex items-center gap-2 px-4 py-2 rounded bg-aaj-royal text-white text-[10px] font-black uppercase tracking-widest hover:bg-aaj-dark transition-colors disabled:opacity-50"
                                    >
                                      {inFlight ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <Save size={12} />
                                      )}
                                      Enregistrer
                                    </button>
                                  </div>
                                </div>
                              )}
                              {pvFiles.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                  {pvFiles.map((f, fi) => {
                                    const isImg = (f.type || '').startsWith('image/');
                                    return (
                                      <button
                                        key={f.id || fi}
                                        type="button"
                                        onClick={() => openFilePreview(pvFiles, fi)}
                                        className="text-left block border border-aaj-border rounded overflow-hidden bg-slate-50 hover:border-aaj-royal transition-all w-full"
                                        title={`Aperçu : ${f.name}`}
                                      >
                                        {isImg ? (
                                          <img
                                            src={f.url}
                                            alt={f.name}
                                            className="w-full aspect-square object-cover"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="w-full aspect-square flex flex-col items-center justify-center gap-2 bg-white">
                                            <FileText size={28} className="text-aaj-royal" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray">
                                              PDF
                                            </span>
                                          </div>
                                        )}
                                        <div className="px-2 py-1.5 bg-white border-t border-aaj-border flex items-center gap-1">
                                          <Eye size={10} className="shrink-0 text-aaj-gray" />
                                          <span className="text-[9px] font-bold truncate text-aaj-dark">
                                            {f.name}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            );
                          })}
                        {commissionPVs.filter((pv) => pv.town === selectedCommune).length === 0 && (
                          <div className="p-12 border border-dashed border-aaj-border rounded text-center opacity-50">
                            <p className="text-xs font-black uppercase tracking-widest text-aaj-gray">
                              Aucun PV publié pour cette commune
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {['Houmt Souk', 'Midoun', 'Ajim'].map((town) => {
                            const townPVs = commissionPVs.filter((pv) => pv.town === town);
                            const latestPV = townPVs[0];
                            const townColor = colorForTown(town, commissionColors);
                            const formattedDate = latestPV?.date
                              ? new Date(latestPV.date).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : null;
                            return (
                              <div
                                key={town}
                                className="border border-aaj-border rounded bg-white flex flex-col justify-between hover:border-aaj-royal transition-all group overflow-hidden"
                              >
                                <div
                                  className="h-1.5"
                                  style={{ backgroundColor: townColor }}
                                  aria-hidden="true"
                                />
                                <div className="p-8 text-center flex-1 flex flex-col justify-between">
                                  <div>
                                    <Building2
                                      size={32}
                                      className="mx-auto mb-4"
                                      style={{ color: townColor }}
                                    />
                                    <h3 className="text-xl font-black uppercase tracking-tighter mb-2">
                                      {town}
                                    </h3>
                                    <p className="text-[10px] font-black text-aaj-gray uppercase tracking-widest mb-2">
                                      Total PVs : {townPVs.length}
                                    </p>
                                    {latestPV ? (
                                      <div className="text-[10px] font-bold text-aaj-dark uppercase tracking-wider mb-6 space-y-0.5">
                                        <p>Dernière : {formattedDate}</p>
                                        <p className="text-aaj-gray">
                                          {latestPV.type
                                            ? `Type : ${latestPV.type}`
                                            : 'Type non renseigné'}
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-[10px] font-bold text-aaj-gray uppercase tracking-wider mb-6 italic">
                                        Aucun avis publié
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => setSelectedCommune(town)}
                                    className="w-full bg-aaj-dark text-white py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all group-hover:scale-[1.02]"
                                  >
                                    Consulter les PV
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <Suspense fallback={<TabLoader />}>
                          <CommissionCalendar
                            events={commissionPVs.map((pv) => ({
                              date: pv.date,
                              town: pv.town,
                              type: pv.type || '',
                              count: parseInt(pv.count) || 0,
                            }))}
                            colors={commissionColors}
                            onDayClick={(_date, evs) => {
                              // If all events on that day belong to the same town, jump to it.
                              const towns = Array.from(new Set(evs.map((e) => e.town)));
                              if (towns.length === 1) setSelectedCommune(towns[0]);
                            }}
                          />
                        </Suspense>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'news-history' && (
                  <motion.div
                    key="news-history"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-aaj-border">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">
                        Historique des Annonces Internes
                      </h2>
                      <button
                        onClick={() => setActiveTab('dashboard')}
                        className="text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:text-aaj-royal flex items-center gap-2 border border-aaj-border px-4 py-2 rounded"
                      >
                        <LayoutDashboard size={14} /> Retour Dashboard
                      </button>
                    </div>

                    <div className="max-w-2xl mx-auto space-y-6">
                      {newsItems.map((item, idx) => (
                        <NewsPostCard
                          key={item.id || idx}
                          item={item}
                          onClick={() => setSelectedNews(item)}
                        />
                      ))}
                      {newsItems.length === 0 && (
                        <div className="p-12 border border-dashed border-aaj-border rounded text-center opacity-50">
                          <p className="text-xs font-black uppercase tracking-widest text-aaj-gray">
                            Aucune annonce dans l&apos;historique
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'bibliotheque' && can('library_view') && (
                  <motion.div
                    key="bibliotheque"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-12"
                  >
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">
                        Bibliothèque Technique & Légale
                      </h2>
                      <p className="text-sm text-aaj-gray font-medium uppercase tracking-widest max-w-2xl mb-12">
                        Accédez aux documents de référence, plans d&apos;aménagement et cadres
                        contractuels essentiels à votre pratique professionnelle sur l&apos;île.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Urbanisme section */}
                        <div className="space-y-6">
                          <div className="flex justify-between items-center bg-slate-50 p-4 border border-aaj-border rounded">
                            <h3 className="text-[10px] uppercase font-black tracking-widest text-aaj-royal">
                              Plan d&apos;Aménagement
                            </h3>
                            <select
                              value={libraryFilterCommune}
                              onChange={(e) => setLibraryFilterCommune(e.target.value)}
                              className="text-[10px] font-black uppercase tracking-widest bg-white border border-aaj-border px-3 py-1.5 rounded outline-none"
                            >
                              <option value="Toutes">Toutes</option>
                              <option value="Houmt Souk">Houmt Souk</option>
                              <option value="Midoun">Midoun</option>
                              <option value="Ajim">Ajim</option>
                            </select>
                          </div>
                          <div className="space-y-3">
                            {libraryDocs
                              .filter((d) => d.category === "Plan d'Aménagement" && !d.archived)
                              .filter(
                                (d) =>
                                  libraryFilterCommune === 'Toutes' ||
                                  d.commune === libraryFilterCommune
                              )
                              .map((doc, i) => (
                                <a
                                  key={doc.id}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-4 p-4 border border-aaj-border rounded hover:bg-slate-50 transition-colors group"
                                >
                                  <DocumentThumbnail
                                    url={doc.url}
                                    name={doc.name}
                                    fileType={doc.fileType}
                                  />
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-3">
                                      <MapPin size={12} className="text-aaj-royal shrink-0" />
                                      <span className="truncate">{doc.name}</span>
                                    </span>
                                    {doc.subCategory && (
                                      <span className="text-[9px] text-aaj-gray font-black uppercase tracking-widest mt-1 ml-6 truncate">
                                        {doc.subCategory}
                                      </span>
                                    )}
                                    {doc.approvalDate && (
                                      <span className="text-[9px] text-aaj-gray font-black uppercase tracking-widest mt-1 ml-6 flex items-center gap-1.5">
                                        <Calendar size={9} className="text-aaj-royal/70 shrink-0" />
                                        Approuvé le{' '}
                                        {new Date(doc.approvalDate).toLocaleDateString('fr-FR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                        })}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-[9px] font-black text-aaj-gray uppercase border border-aaj-border px-2 py-1 rounded group-hover:bg-white transition-colors">
                                      {doc.fileType}
                                    </span>
                                    <Download
                                      size={14}
                                      className="text-aaj-gray group-hover:text-aaj-royal"
                                    />
                                  </div>
                                </a>
                              ))}
                            {libraryDocs.filter((d) => d.category === "Plan d'Aménagement" && !d.archived)
                              .length === 0 && (
                              <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest text-center py-4 italic">
                                Aucun document disponible
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Juridique section */}
                        <div className="space-y-6">
                          <div className="flex justify-between items-center bg-slate-50 p-4 border border-aaj-border rounded">
                            <h3 className="text-[10px] uppercase font-black tracking-widest text-aaj-royal">
                              Cadre Contractuel & Légal
                            </h3>
                            <select
                              value={libraryFilterLegal}
                              onChange={(e) => setLibraryFilterLegal(e.target.value)}
                              className="text-[10px] font-black uppercase tracking-widest bg-white border border-aaj-border px-3 py-1.5 rounded outline-none"
                            >
                              <option value="Tous">Tous</option>
                              <option value="Contrat">Contrats</option>
                              <option value="Texte & Loi">Textes & Lois</option>
                            </select>
                          </div>
                          <div className="space-y-3">
                            {libraryDocs
                              .filter((d) => d.category === 'Cadre Contractuel & Légal' && !d.archived)
                              .filter(
                                (d) =>
                                  libraryFilterLegal === 'Tous' ||
                                  d.subCategory === libraryFilterLegal
                              )
                              .map((doc, i) => (
                                <a
                                  key={doc.id}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-4 p-4 border border-aaj-border rounded hover:bg-slate-50 transition-colors group"
                                >
                                  <DocumentThumbnail
                                    url={doc.url}
                                    name={doc.name}
                                    fileType={doc.fileType}
                                  />
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-3">
                                      {doc.fileType === 'xlsx' || doc.fileType === 'xls' ? (
                                        <FileSpreadsheet size={12} className="text-aaj-royal shrink-0" />
                                      ) : (
                                        <FileText size={12} className="text-aaj-royal shrink-0" />
                                      )}
                                      <span className="truncate">{doc.name}</span>
                                    </span>
                                    {doc.subCategory && (
                                      <span className="text-[9px] text-aaj-gray font-black uppercase tracking-widest mt-1 ml-6 truncate">
                                        {doc.subCategory}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-[9px] font-black text-aaj-gray uppercase border border-aaj-border px-2 py-1 rounded group-hover:bg-white transition-colors">
                                      {doc.fileType}
                                    </span>
                                    <Download
                                      size={14}
                                      className="text-aaj-gray group-hover:text-aaj-royal"
                                    />
                                  </div>
                                </a>
                              ))}
                            {libraryDocs.filter((d) => d.category === 'Cadre Contractuel & Légal' && !d.archived)
                              .length === 0 && (
                              <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest text-center py-4 italic">
                                Aucun document disponible
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {can('library_manage') && activeTab === 'admin-documents' && (
                  <motion.div
                    key="admin-documents"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-12"
                  >
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">
                        Gestion de la Bibliothèque
                      </h2>
                      <p className="text-sm text-aaj-gray font-medium uppercase tracking-widest max-w-2xl mb-12">
                        Ajoutez, organisez et supprimez les documents techniques et légaux mis à
                        disposition des membres.
                      </p>

                      <form
                        onSubmit={handleAddDocument}
                        className="bg-slate-50 border border-aaj-border p-10 rounded mb-12 space-y-8 shadow-sm"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                              Nom du Document
                            </label>
                            <input
                              type="text"
                              required
                              value={newDoc.name}
                              onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
                              placeholder="Plan d'Aménagement Urbain..."
                              className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal focus:border-aaj-royal outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                              Lien Document (Optionnel si fichier chargé)
                            </label>
                            <input
                              type="url"
                              value={newDoc.url}
                              onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
                              placeholder="https://..."
                              className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal focus:border-aaj-royal outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                              Catégorie Utilité
                            </label>
                            <select
                              value={newDoc.category}
                              onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                              className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none appearance-none cursor-pointer"
                            >
                              <option value="Plan d'Aménagement">Plan d&apos;Aménagement</option>
                              <option value="Cadre Contractuel & Légal">
                                Cadre Contractuel & Légal
                              </option>
                            </select>
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                              Document (PC ou Mobile)
                            </label>
                            <div className="flex gap-4">
                              <input
                                type="file"
                                ref={libraryFileInputRef}
                                onChange={handleLibraryFileChange}
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={() => libraryFileInputRef.current?.click()}
                                className="flex-1 bg-white border border-dashed border-aaj-border hover:border-aaj-royal hover:bg-white px-5 py-3.5 rounded text-left flex items-center justify-between group transition-all"
                              >
                                <span className="text-[10px] font-bold uppercase tracking-widest text-aaj-gray group-hover:text-aaj-royal truncate">
                                  {newDoc.fileName || 'Choisir un fichier...'}
                                </span>
                                <Upload
                                  size={14}
                                  className="text-aaj-gray group-hover:text-aaj-royal shrink-0"
                                />
                              </button>
                              {newDoc.file && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewDoc({
                                      ...newDoc,
                                      file: null,
                                      fileName: '',
                                      fileType: 'pdf',
                                    });
                                    if (libraryFileInputRef.current) {
                                      libraryFileInputRef.current.value = '';
                                    }
                                  }}
                                  className="bg-aaj-magenta/10 text-aaj-magenta px-4 rounded hover:bg-aaj-magenta/15 transition-colors"
                                >
                                  <XCircle size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {newDoc.category === "Plan d'Aménagement" ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-200">
                            <div className="space-y-3">
                              <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                                Commune
                              </label>
                              <select
                                value={newDoc.commune}
                                onChange={(e) => setNewDoc({ ...newDoc, commune: e.target.value })}
                                className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none"
                              >
                                <option value="Houmt Souk">Houmt Souk</option>
                                <option value="Midoun">Midoun</option>
                                <option value="Ajim">Ajim</option>
                              </select>
                            </div>
                            <div className="space-y-3">
                              <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                                Arrondissement (Optionnel)
                              </label>
                              <input
                                type="text"
                                value={newDoc.arrondissement}
                                onChange={(e) =>
                                  setNewDoc({ ...newDoc, arrondissement: e.target.value })
                                }
                                placeholder="Ex: Cedghiane, Erriadh..."
                                className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none"
                              />
                            </div>
                            <div className="space-y-3 md:col-span-2">
                              <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1 flex items-center gap-2">
                                <Calendar size={11} className="text-aaj-royal" />
                                Date d&apos;approbation du PAU (Optionnel)
                              </label>
                              <input
                                type="date"
                                value={newDoc.approvalDate}
                                onChange={(e) =>
                                  setNewDoc({ ...newDoc, approvalDate: e.target.value })
                                }
                                className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="pt-4 border-t border-slate-200">
                            <div className="space-y-3 max-w-md">
                              <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                                Type de Document
                              </label>
                              <select
                                value={newDoc.legalType}
                                onChange={(e) =>
                                  setNewDoc({ ...newDoc, legalType: e.target.value })
                                }
                                className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none appearance-none cursor-pointer"
                              >
                                <option value="Contrat">Contrat</option>
                                <option value="Texte & Loi">Texte & Loi</option>
                              </select>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end pt-4">
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-aaj-dark text-white px-12 py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center gap-3 shadow-lg shadow-aaj-dark/20 disabled:bg-aaj-gray"
                          >
                            {isSaving ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <PlusCircle size={16} />
                            )}
                            Ajouter à la bibliothèque
                          </button>
                        </div>
                      </form>

                      {/* Filter bar — admin can flip between active rows and the
                          full archive (incl. hidden docs). Shows live counts. */}
                      <div className="flex items-center justify-between mb-6 px-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                          {(() => {
                            const total = libraryDocs.length;
                            const archived = libraryDocs.filter((d) => d.archived).length;
                            const active = total - archived;
                            return showArchivedDocs
                              ? `${total} document${total > 1 ? 's' : ''} · ${archived} archivé${archived > 1 ? 's' : ''}`
                              : `${active} document${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''}${archived ? ` · ${archived} archivé${archived > 1 ? 's' : ''}` : ''}`;
                          })()}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowArchivedDocs((v) => !v)}
                          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded border transition-colors flex items-center gap-2 ${
                            showArchivedDocs
                              ? 'bg-aaj-royal text-white border-aaj-royal'
                              : 'bg-white text-aaj-gray border-aaj-border hover:border-aaj-royal/40 hover:text-aaj-royal'
                          }`}
                        >
                          {showArchivedDocs ? <Eye size={12} /> : <EyeOff size={12} />}
                          {showArchivedDocs ? 'Tous (archives incluses)' : 'Actifs uniquement'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {libraryDocs
                          .filter((d) => showArchivedDocs || !d.archived)
                          .map((doc) => (
                          <div
                            key={doc.id}
                            className={`flex items-center justify-between p-6 bg-white border rounded transition-all ${
                              doc.archived
                                ? 'border-slate-300 bg-slate-50/60 opacity-70 hover:opacity-100'
                                : 'border-aaj-border hover:border-aaj-royal/30'
                            }`}
                          >
                            <div className="flex items-center gap-6">
                              <div className="w-12 h-12 bg-slate-50 rounded flex items-center justify-center text-aaj-gray">
                                {doc.fileType === 'pdf' ? (
                                  <FileText size={24} />
                                ) : doc.fileType === 'xlsx' ? (
                                  <FileSpreadsheet size={24} />
                                ) : (
                                  <FileCode size={24} />
                                )}
                              </div>
                              <div>
                                <h4 className="font-black uppercase tracking-tight leading-none mb-2">
                                  {doc.name}
                                </h4>
                                <div className="flex items-center gap-3 flex-wrap">
                                  {doc.archived && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-700 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded flex items-center gap-1">
                                      <Archive size={9} />
                                      Archivé
                                    </span>
                                  )}
                                  <span className="text-[9px] font-black uppercase tracking-widest text-aaj-royal bg-aaj-electric/10 px-2 py-0.5 rounded">
                                    {doc.category}
                                  </span>
                                  {doc.subCategory && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray">
                                      {doc.subCategory}
                                    </span>
                                  )}
                                  {doc.approvalDate && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-aaj-royal/80 flex items-center gap-1">
                                      <Calendar size={9} />
                                      {new Date(doc.approvalDate).toLocaleDateString('fr-FR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                      })}
                                    </span>
                                  )}
                                  <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray/50">
                                    {doc.fileType.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-aaj-gray hover:text-aaj-royal transition-colors"
                                title="Télécharger"
                              >
                                <Download size={18} />
                              </a>
                              <button
                                onClick={() => handleStartEditDocument(doc)}
                                className="p-2 text-aaj-gray hover:text-aaj-royal transition-colors"
                                title="Modifier"
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                onClick={() =>
                                  handleToggleArchiveDocument(doc.id, !!doc.archived)
                                }
                                disabled={archivingDocId === doc.id}
                                className={`p-2 transition-colors disabled:opacity-50 ${
                                  doc.archived
                                    ? 'text-aaj-cyan hover:text-aaj-cyan'
                                    : 'text-aaj-gray hover:text-aaj-amber'
                                }`}
                                title={doc.archived ? 'Restaurer' : 'Archiver'}
                              >
                                {archivingDocId === doc.id ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : doc.archived ? (
                                  <ArchiveRestore size={18} />
                                ) : (
                                  <Archive size={18} />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-2 text-aaj-gray hover:text-aaj-magenta transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {libraryDocs.filter((d) => showArchivedDocs || !d.archived).length === 0 && (
                          <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest text-center py-8 italic">
                            {showArchivedDocs
                              ? 'Aucun document dans la bibliothèque'
                              : 'Aucun document actif. Activez "Tous" pour voir les archives.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'admin-chat' && can('chat_manage') && (
                  <motion.div
                    key="admin-chat"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">
                        Modération des Discussions
                      </h2>
                      <p className="text-[11px] text-aaj-gray font-bold uppercase tracking-[2px]">
                        Approuvez ou rejetez les demandes de canaux soumises par les adhérents.
                      </p>
                    </div>
                    {user?.uid && (
                      <Suspense fallback={<TabLoader />}>
                        <ChannelApprovals currentUid={user.uid} />
                      </Suspense>
                    )}
                  </motion.div>
                )}

                {activeTab === 'documents' && can('messages_send') && (
                  <motion.div
                    key="documents"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-12"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                      <div className="flex-1">
                        <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">
                          Messagerie
                        </h2>
                        <p className="text-sm text-aaj-gray font-bold uppercase tracking-widest max-w-2xl mb-8 leading-relaxed">
                          Contactez le bureau exécutif et déposez vos documents officiels. Toute
                          demande sera traitée dans les plus brefs délais.
                        </p>

                        <div
                          onClick={() => setIsContactModalOpen(true)}
                          className="border-2 border-dashed border-aaj-border p-12 rounded text-center bg-slate-50/30 hover:bg-slate-50 transition-colors group cursor-pointer"
                        >
                          <MessageSquare
                            size={40}
                            className="mx-auto text-aaj-gray group-hover:text-aaj-royal transition-colors mb-4"
                          />
                          <p className="text-sm font-black uppercase tracking-widest mb-1">
                            Nouveau Message ou Dépôt
                          </p>
                          <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest">
                            Cliquez pour ouvrir le formulaire
                          </p>
                        </div>
                      </div>

                      <div className="w-full md:w-80 bg-slate-50 p-8 border border-aaj-border rounded">
                        <h3 className="text-[10px] font-black uppercase tracking-[2px] text-aaj-dark mb-4 pb-2 border-b border-aaj-border">
                          Instructions
                        </h3>
                        <ul className="space-y-4">
                          <li className="flex gap-3 items-start">
                            <CheckCircle2 size={12} className="text-aaj-royal mt-0.5" />
                            <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-wide">
                              Réponses par email sous 48h
                            </span>
                          </li>
                          <li className="flex gap-3 items-start">
                            <CheckCircle2 size={12} className="text-aaj-royal mt-0.5" />
                            <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-wide">
                              Documents PDF/Images uniquement
                            </span>
                          </li>
                          <li className="flex gap-3 items-start">
                            <CheckCircle2 size={12} className="text-aaj-royal mt-0.5" />
                            <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-wide">
                              Suivi en temps réel de l&apos;état
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-8 flex items-center gap-4">
                        Historique de mes demandes{' '}
                        <span className="h-px flex-1 bg-aaj-border"></span>
                      </h3>
                      <div className="space-y-4">
                        {userMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className="p-6 border border-aaj-border rounded bg-white hover:border-aaj-royal transition-all group"
                          >
                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-aaj-royal">
                                    {msg.subject}
                                  </span>
                                  <span className="text-[8px] text-aaj-gray">•</span>
                                  <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">
                                    {msg.createdAt?.toDate?.()?.toLocaleDateString('fr-FR', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs text-aaj-dark font-medium line-clamp-1">
                                  {msg.message}
                                </p>
                                {msg.fileName && (
                                  <div className="mt-2 flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-aaj-gray bg-slate-50 px-2 py-0.5 rounded w-fit">
                                    <Download size={10} /> {msg.fileName}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {msg.replied ? (
                                  <span className="text-[9px] font-black text-aaj-cyan bg-aaj-cyan/10 px-2.5 py-1 rounded border border-aaj-cyan/30 uppercase tracking-widest">
                                    Traité
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black text-aaj-amber bg-aaj-amber/10 px-2.5 py-1 rounded border border-aaj-amber/30 uppercase tracking-widest">
                                    En attente
                                  </span>
                                )}
                              </div>
                            </div>

                            {msg.replied && msg.replyMessage && (
                              <div className="mt-4 border-l-4 border-aaj-cyan bg-aaj-cyan/10 p-4 rounded">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle2 size={12} className="text-aaj-cyan" />
                                  <span className="text-[9px] font-black uppercase tracking-widest text-aaj-cyan">
                                    Réponse de l&apos;administration
                                    {formatReplyTimestamp(msg.repliedAt)}
                                  </span>
                                </div>
                                <div className="text-xs text-aaj-dark leading-relaxed font-medium whitespace-pre-wrap">
                                  {msg.replyMessage}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {userMessages.length === 0 && (
                          <div className="text-center py-12 border border-dashed border-aaj-border rounded opacity-50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                              Aucun message envoyé pour le moment
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'notifications' && (
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-aaj-border pb-6">
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Notifications</h2>
                        <p className="text-sm text-slate-600 mt-1">
                          Consultez et gérez l’ensemble de vos notifications.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-aaj-border bg-white overflow-hidden">
                      <Suspense fallback={<TabLoader />}>
                        <NotificationsList maxHeight="70vh" />
                      </Suspense>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'notifications-prefs' && (
                  <motion.div
                    key="notifications-prefs"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div className="border-b border-aaj-border pb-6">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">
                        Préférences de notification
                      </h2>
                      <p className="text-sm text-slate-600 mt-1">
                        Adaptez la fréquence et les canaux pour ne recevoir que ce qui compte.
                      </p>
                    </div>
                    <Suspense fallback={<TabLoader />}>
                      <NotificationPreferences />
                    </Suspense>
                  </motion.div>
                )}

                {activeTab === 'settings' && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-12"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-aaj-border pb-8">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">Mon Profil</h2>
                      <button
                        onClick={() => setIsRequestModalOpen(true)}
                        className="bg-aaj-dark text-white px-8 py-3 rounded text-[11px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center gap-3"
                      >
                        <Settings size={16} />
                        Demander une modification
                      </button>
                    </div>

                    {pendingUserRequests.some((r) => r.status === 'pending') && (
                      <div className="p-4 bg-aaj-amber/10 border border-aaj-amber/30 rounded flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Loader2 size={16} className="text-aaj-amber animate-spin" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-aaj-amber">
                            Une demande de modification est en cours d&apos;examen
                          </p>
                        </div>
                        <span className="text-[9px] font-bold text-aaj-amber italic">
                          Soumis le{' '}
                          {pendingUserRequests
                            .find((r) => r.status === 'pending')
                            ?.createdAt?.toDate?.()
                            ?.toLocaleDateString() || 'récemment'}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                      {/* Left side: Photo and basic info */}
                      <div className="flex flex-col items-center text-center space-y-8">
                        <div
                          className="relative group cursor-pointer"
                          onClick={() => profileFileInputRef.current?.click()}
                        >
                          <input
                            type="file"
                            ref={profileFileInputRef}
                            onChange={handleUpdatePhoto}
                            accept="image/*"
                            className="hidden"
                          />
                          <div className="w-48 h-48 rounded bg-slate-100 border-2 border-aaj-border flex items-center justify-center overflow-hidden">
                            {userProfile?.photoBase64 ? (
                              <img
                                src={userProfile.photoBase64}
                                alt="Profile"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <UserCircle size={120} className="text-aaj-gray" />
                            )}
                          </div>
                          <div className="absolute inset-0 bg-aaj-dark/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <Camera size={24} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-center px-4">
                              Changer la photo
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-aaj-royal">
                            {userProfile?.category}
                          </p>
                          <h3 className="text-xl font-black uppercase tracking-tight mt-1">
                            {userProfile?.displayName || 'Architecte AAJ'}
                          </h3>
                        </div>
                      </div>

                      {/* Right side: Form details (Read only) */}
                      <div className="lg:col-span-2 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                              Prénom
                            </label>
                            <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">
                              {userProfile?.firstName || '-'}
                            </p>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                              Nom
                            </label>
                            <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">
                              {userProfile?.lastName || '-'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                              Mobile / WhatsApp
                            </label>
                            <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">
                              {userProfile?.mobile || '-'}
                            </p>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                              Email de contact
                            </label>
                            <p className="mt-2 text-sm font-bold border-b border-slate-100 pb-2">
                              {userProfile?.email || '-'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                              Catégorie
                            </label>
                            <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">
                              {userProfile?.category || '-'}
                            </p>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                              {userProfile?.category === 'Architecte'
                                ? 'Matricule AAJ'
                                : 'Matricule Étudiant'}
                            </label>
                            <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">
                              {userProfile?.licenseNumber || '-'}
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                            Adresse professionnelle
                          </label>
                          <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">
                            {userProfile?.address || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Admin Sections */}
                {activeTab === 'admin-members' && can('members_manage') && (
                  <motion.div
                    key="admin-members"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-4">
                      <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter break-words">
                        Gestion des Adhésions
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <button
                          onClick={() => setShowArchivedMembers((v) => !v)}
                          className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${
                            showArchivedMembers
                              ? 'bg-slate-200 text-aaj-dark border-slate-300'
                              : 'bg-white text-aaj-gray border-aaj-border hover:text-aaj-dark'
                          }`}
                          title={
                            showArchivedMembers
                              ? 'Revenir aux membres actifs'
                              : 'Afficher les membres archivés'
                          }
                        >
                          {showArchivedMembers
                            ? `Membres actifs (${allUsers.filter((m) => m.status !== 'archived').length})`
                            : `Archivés (${allUsers.filter((m) => m.status === 'archived').length})`}
                        </button>
                        <button
                          onClick={() => setIsAddMemberModalOpen(true)}
                          className="bg-aaj-dark text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center gap-2"
                        >
                          <Plus size={14} /> Ajouter un Membre
                        </button>
                      </div>
                    </div>

                    {/* Demandes d'adhésion en attente (/demander-adhesion) */}
                    {(() => {
                      const pendingApps = membershipApplications.filter(
                        (a: any) => (a.status || 'pending') === 'pending'
                      );
                      if (pendingApps.length === 0) return null;
                      return (
                        <div className="border border-aaj-amber/40 rounded overflow-hidden bg-aaj-amber/10">
                          <div className="bg-aaj-amber/15 px-5 py-3 border-b border-aaj-amber/40 flex items-center gap-3">
                            <Shield size={16} className="text-aaj-amber" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-aaj-amber">
                              Demandes d&apos;adhésion en attente ({pendingApps.length})
                            </h3>
                          </div>
                          <ul className="divide-y divide-amber-100">
                            {pendingApps.map((app: any) => {
                              const displayName =
                                app.fullName ||
                                `${app.firstName ?? ''} ${app.lastName ?? ''}`.trim() ||
                                app.email;
                              const createdAtIso =
                                typeof app.createdAt?.toDate === 'function'
                                  ? app.createdAt.toDate().toISOString()
                                  : app.createdAt;
                              return (
                                <li
                                  key={app.id}
                                  className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black uppercase tracking-tight text-aaj-dark truncate">
                                      {displayName}
                                    </p>
                                    <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-bold uppercase tracking-widest text-aaj-gray">
                                      <span>{app.email}</span>
                                      {app.phone && <span>{app.phone}</span>}
                                      {app.category && (
                                        <span>
                                          {app.category}
                                          {app.memberTypeLetter ? ` (${app.memberTypeLetter})` : ''}
                                        </span>
                                      )}
                                      {app.city && <span>{app.city}</span>}
                                      {app.birthDate && <span>Né(e) {app.birthDate}</span>}
                                      {app.cvFileName && <span>CV : {app.cvFileName}</span>}
                                      {createdAtIso && (
                                        <span className="text-aaj-gray/60">
                                          {new Date(createdAtIso).toLocaleDateString('fr-FR')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                                    <button
                                      onClick={() => handleApproveApplication(app)}
                                      disabled={approvingApplicationId === app.id}
                                      className="px-4 py-2 bg-aaj-cyan text-aaj-night text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      {approvingApplicationId === app.id ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <CheckCircle2 size={12} />
                                      )}
                                      Valider
                                    </button>
                                    <button
                                      onClick={() => handleGrantTrialApplication(app)}
                                      disabled={approvingApplicationId === app.id}
                                      title="Créer le compte avec un accès d'essai de 24h à partir de la première connexion"
                                      className="px-4 py-2 bg-aaj-royal text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-dark transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      <Clock size={12} />
                                      Essai 24h
                                    </button>
                                    <button
                                      onClick={() => handleRejectApplication(app)}
                                      disabled={approvingApplicationId === app.id}
                                      className="px-4 py-2 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      <XCircle size={12} /> Rejeter
                                    </button>
                                    <button
                                      onClick={() => handleDeleteApplication(app)}
                                      disabled={approvingApplicationId === app.id}
                                      className="px-3 py-2 text-aaj-gray hover:text-aaj-magenta transition-colors"
                                      title="Supprimer"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* Recherche & filtres */}
                    <div className="border border-aaj-border rounded p-3 sm:p-4 bg-slate-50/50 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                        {/* Barre de recherche */}
                        <div className="sm:col-span-2 lg:col-span-4 relative">
                          <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-aaj-gray pointer-events-none"
                          />
                          <input
                            type="text"
                            value={adminMembersSearch}
                            onChange={(e) => setAdminMembersSearch(e.target.value)}
                            placeholder="Nom, email, matricule, téléphone…"
                            className="w-full pl-9 pr-9 py-2.5 border border-aaj-border rounded text-xs font-bold tracking-wide bg-white focus:outline-none focus:ring-2 focus:ring-aaj-royal/30 focus:border-aaj-royal placeholder:text-aaj-gray/70"
                          />
                          {adminMembersSearch && (
                            <button
                              onClick={() => setAdminMembersSearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-aaj-gray hover:text-aaj-dark"
                              title="Effacer la recherche"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        {/* Filtre statut */}
                        <div className="lg:col-span-2">
                          <select
                            value={adminMembersStatusFilter}
                            onChange={(e) =>
                              setAdminMembersStatusFilter(
                                e.target.value as 'all' | 'active' | 'suspended'
                              )
                            }
                            className="w-full px-3 py-2.5 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest bg-white focus:outline-none focus:ring-2 focus:ring-aaj-royal/30 focus:border-aaj-royal"
                          >
                            <option value="all">Statut : Tous</option>
                            <option value="active">Actifs</option>
                            <option value="suspended">Suspendus</option>
                          </select>
                        </div>

                        {/* Filtre cotisation */}
                        <div className="lg:col-span-2">
                          <select
                            value={adminMembersCotisationFilter}
                            onChange={(e) =>
                              setAdminMembersCotisationFilter(
                                e.target.value as 'all' | 'paid' | 'unpaid'
                              )
                            }
                            className="w-full px-3 py-2.5 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest bg-white focus:outline-none focus:ring-2 focus:ring-aaj-royal/30 focus:border-aaj-royal"
                          >
                            <option value="all">Cotisation : Toutes</option>
                            <option value="paid">Payée ({currentYearLabel})</option>
                            <option value="unpaid">Non payée ({currentYearLabel})</option>
                          </select>
                        </div>

                        {/* Filtre catégorie */}
                        <div className="lg:col-span-2">
                          <select
                            value={adminMembersCategoryFilter}
                            onChange={(e) => setAdminMembersCategoryFilter(e.target.value)}
                            className="w-full px-3 py-2.5 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest bg-white focus:outline-none focus:ring-2 focus:ring-aaj-royal/30 focus:border-aaj-royal"
                          >
                            <option value="all">Catégorie : Toutes</option>
                            {memberTypesList.map((t) => (
                              <option key={t.letter} value={t.label}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Filtre ville */}
                        <div className="lg:col-span-2">
                          <select
                            value={adminMembersCityFilter}
                            onChange={(e) => setAdminMembersCityFilter(e.target.value)}
                            className="w-full px-3 py-2.5 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest bg-white focus:outline-none focus:ring-2 focus:ring-aaj-royal/30 focus:border-aaj-royal"
                          >
                            <option value="all">Ville : Toutes</option>
                            {villesList.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Lien réinitialiser (visible si au moins un filtre actif) */}
                      {(adminMembersSearch ||
                        adminMembersStatusFilter !== 'all' ||
                        adminMembersCotisationFilter !== 'all' ||
                        adminMembersCategoryFilter !== 'all' ||
                        adminMembersCityFilter !== 'all') && (
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => {
                              setAdminMembersSearch('');
                              setAdminMembersStatusFilter('all');
                              setAdminMembersCotisationFilter('all');
                              setAdminMembersCategoryFilter('all');
                              setAdminMembersCityFilter('all');
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-aaj-royal hover:underline flex items-center gap-1"
                          >
                            <X size={12} /> Réinitialiser les filtres
                          </button>
                        </div>
                      )}
                    </div>

                    {(() => {
                      const searchQuery = adminMembersSearch.trim().toLowerCase();
                      const filteredMembers = allUsers.filter((m) => {
                        // Archivés vs actifs (toggle existant)
                        if (showArchivedMembers) {
                          if (m.status !== 'archived') return false;
                        } else {
                          if (m.status === 'archived') return false;
                        }

                        // Statut (uniquement quand on regarde les membres actifs)
                        if (!showArchivedMembers && adminMembersStatusFilter !== 'all') {
                          if (adminMembersStatusFilter === 'suspended') {
                            if (m.status !== 'suspended') return false;
                          } else if (adminMembersStatusFilter === 'active') {
                            if (m.status === 'suspended') return false;
                          }
                        }

                        // Cotisation année en cours
                        if (adminMembersCotisationFilter !== 'all') {
                          const paid = !!m.cotisations?.[currentYearLabel]?.paid;
                          if (adminMembersCotisationFilter === 'paid' && !paid) return false;
                          if (adminMembersCotisationFilter === 'unpaid' && paid) return false;
                        }

                        // Catégorie
                        if (adminMembersCategoryFilter !== 'all') {
                          if ((m.category || '') !== adminMembersCategoryFilter) return false;
                        }

                        // Ville
                        if (adminMembersCityFilter !== 'all') {
                          if ((m.city || '') !== adminMembersCityFilter) return false;
                        }

                        // Recherche texte
                        if (searchQuery) {
                          const haystack = [
                            m.displayName,
                            m.firstName,
                            m.lastName,
                            m.email,
                            m.matricule,
                            m.licenseNumber,
                            m.mobile,
                            m.phone,
                            m.city,
                            m.category,
                          ]
                            .filter(Boolean)
                            .join(' ')
                            .toLowerCase();
                          if (!haystack.includes(searchQuery)) return false;
                        }

                        return true;
                      });

                      // Tri par colonne — clic sur l'en-tête.
                      const compareName = (a: any, b: any) =>
                        (a.displayName || '').localeCompare(b.displayName || '', 'fr', {
                          sensitivity: 'base',
                        });
                      const statusOrder = (m: any) =>
                        m.status === 'archived' ? 2 : m.status === 'suspended' ? 1 : 0;
                      const paidOrder = (m: any) =>
                        m.cotisations?.[currentYearLabel]?.paid ? 1 : 0;
                      filteredMembers.sort((a, b) => {
                        let cmp = 0;
                        if (adminMembersSort.key === 'name') {
                          cmp = compareName(a, b);
                        } else if (adminMembersSort.key === 'status') {
                          cmp = statusOrder(a) - statusOrder(b);
                          if (cmp === 0) cmp = compareName(a, b);
                        } else if (adminMembersSort.key === 'cotisation') {
                          cmp = paidOrder(a) - paidOrder(b);
                          if (cmp === 0) cmp = compareName(a, b);
                        }
                        return adminMembersSort.dir === 'asc' ? cmp : -cmp;
                      });

                      const totalForView = allUsers.filter((m) =>
                        showArchivedMembers
                          ? m.status === 'archived'
                          : m.status !== 'archived'
                      ).length;

                      return (
                        <>
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-aaj-gray px-1">
                            <span>
                              {filteredMembers.length} / {totalForView}{' '}
                              {showArchivedMembers ? 'membre(s) archivé(s)' : 'membre(s)'}
                            </span>
                          </div>
                          <div className="border border-aaj-border rounded overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[820px]">
                              <thead className="bg-slate-50 border-b border-aaj-border">
                                <tr>
                                  {(
                                    [
                                      { key: 'name', label: 'Architecte' },
                                      { key: 'status', label: 'Statut' },
                                      { key: 'cotisation', label: 'Cotisation' },
                                    ] as const
                                  ).map(({ key, label }) => {
                                    const active = adminMembersSort.key === key;
                                    const Icon = !active
                                      ? ArrowUpDown
                                      : adminMembersSort.dir === 'asc'
                                        ? ArrowUp
                                        : ArrowDown;
                                    return (
                                      <th
                                        key={key}
                                        className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray"
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setAdminMembersSort((prev) =>
                                              prev.key === key
                                                ? {
                                                    key,
                                                    dir: prev.dir === 'asc' ? 'desc' : 'asc',
                                                  }
                                                : { key, dir: 'asc' }
                                            )
                                          }
                                          className={`flex items-center gap-1.5 hover:text-aaj-royal transition-colors ${active ? 'text-aaj-royal' : ''}`}
                                          aria-label={`Trier par ${label}`}
                                        >
                                          <span>{label}</span>
                                          <Icon
                                            size={12}
                                            className={active ? 'opacity-100' : 'opacity-40'}
                                          />
                                        </button>
                                      </th>
                                    );
                                  })}
                                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray text-right">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-aaj-border">
                                {filteredMembers.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={4}
                                      className="p-10 text-center text-[11px] font-black uppercase tracking-widest text-aaj-gray"
                                    >
                                      Aucun membre ne correspond aux filtres.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredMembers.map((member) => {
                                    const currentYearPaid =
                                      !!member.cotisations?.[currentYearLabel]?.paid;
                                    const isArchived = member.status === 'archived';
                                    return (
                                      <tr
                                        key={member.uid}
                                        onClick={() => openMemberEditor(member)}
                                        className={`transition-colors cursor-pointer ${
                                          isArchived
                                            ? 'bg-slate-50/30 opacity-70 hover:opacity-100 hover:bg-slate-100/50'
                                            : 'hover:bg-slate-50/50'
                                        }`}
                                      >
                                        <td className="p-4">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-aaj-gray flex-shrink-0 overflow-hidden">
                                              {member.photoBase64 ? (
                                                <img
                                                  src={member.photoBase64}
                                                  alt={member.displayName}
                                                  className="w-full h-full object-cover"
                                                />
                                              ) : (
                                                <UserCircle size={18} />
                                              )}
                                            </div>
                                            <div>
                                              <p className="text-sm font-black uppercase tracking-tight">
                                                {member.displayName}
                                              </p>
                                              <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest">
                                                {member.email}
                                              </p>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="p-4">
                                          {isArchived ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest border border-slate-200">
                                              <Trash2 size={10} /> Archivé
                                            </span>
                                          ) : member.status === 'suspended' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-aaj-magenta/10 text-aaj-magenta text-[9px] font-black uppercase tracking-widest border border-aaj-magenta/30">
                                              <XCircle size={10} /> Suspendu
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-aaj-cyan/10 text-aaj-cyan text-[9px] font-black uppercase tracking-widest border border-aaj-cyan/30">
                                              <CheckCircle2 size={10} /> Actif
                                            </span>
                                          )}
                                        </td>
                                        <td className="p-4">
                                          <div className="flex items-center gap-2">
                                            <p className="text-xs font-bold text-aaj-dark">
                                              {currentYearLabel}
                                            </p>
                                            {currentYearPaid ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aaj-cyan/10 text-aaj-cyan text-[9px] font-black uppercase tracking-widest border border-aaj-cyan/30">
                                                <CheckCircle2 size={9} /> Payée
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aaj-amber/10 text-aaj-amber text-[9px] font-black uppercase tracking-widest border border-aaj-amber/30">
                                                <XCircle size={9} /> Non payée
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td
                                          className="p-4 text-right"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            onClick={() => openMemberEditor(member)}
                                            className="text-[10px] font-black text-aaj-royal uppercase tracking-widest hover:underline px-3"
                                          >
                                            Éditer
                                          </button>
                                          {isArchived ? (
                                            <>
                                              <button
                                                onClick={() => handleRestoreMember(member)}
                                                className="text-[10px] font-black text-aaj-cyan uppercase tracking-widest hover:underline px-3"
                                              >
                                                Restaurer
                                              </button>
                                              <button
                                                onClick={() => handleDeleteMember(member)}
                                                className="text-[10px] font-black text-aaj-magenta uppercase tracking-widest hover:underline px-3 inline-flex items-center gap-1"
                                                title="Supprimer définitivement — irréversible"
                                              >
                                                <Trash2 size={11} /> Supprimer
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => handleToggleSuspense(member)}
                                                className={`text-[10px] font-black uppercase tracking-widest hover:underline px-3 ${member.status === 'suspended' ? 'text-aaj-cyan' : 'text-aaj-magenta'}`}
                                              >
                                                {member.status === 'suspended'
                                                  ? 'Reprendre'
                                                  : 'Suspendre'}
                                              </button>
                                              <button
                                                onClick={() => handleArchiveMember(member)}
                                                className="text-[10px] font-black text-slate-600 uppercase tracking-widest hover:underline px-3 inline-flex items-center gap-1"
                                                title="Archiver — conserve toutes les données"
                                              >
                                                Archiver
                                              </button>
                                            </>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </>
                      );
                    })()}
                  </motion.div>
                )}

                {activeTab === 'admin-roles' && can('roles_manage') && (
                  <motion.div
                    key="admin-roles"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                      <div>
                        <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-2 block">
                          Super Admin
                        </span>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">
                          Rôles & Permissions
                        </h2>
                        <p className="text-[11px] text-aaj-gray font-bold uppercase tracking-wider mt-2">
                          Gérer finement les autorisations de chaque rôle
                        </p>
                      </div>
                      <button
                        onClick={() => setIsAddRoleModalOpen(true)}
                        className="bg-aaj-dark text-white px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center gap-2"
                      >
                        <Plus size={14} /> Ajouter un rôle
                      </button>
                    </div>

                    {/* Permission Matrix */}
                    <div className="border border-aaj-border rounded overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-aaj-border">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-aaj-dark">
                          Matrice des permissions
                        </h3>
                        <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-wider mt-1">
                          Cochez pour activer une permission sur un rôle. Le super-admin a toujours
                          tous les droits.
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-white border-b border-aaj-border">
                            <tr>
                              <th className="sticky left-0 bg-white p-3 text-[10px] font-black uppercase tracking-widest text-aaj-gray min-w-[220px] border-r border-aaj-border">
                                Permission
                              </th>
                              {rolesList.map((r) => (
                                <th
                                  key={r.id}
                                  className="p-3 text-center text-[10px] font-black uppercase tracking-widest text-aaj-dark min-w-[140px]"
                                >
                                  <div className="flex flex-col items-center gap-1">
                                    <span>{r.name}</span>
                                    {!r.isSystem && (
                                      <button
                                        onClick={() => handleDeleteRole(r)}
                                        className="text-aaj-magenta hover:text-aaj-magenta transition-colors"
                                        title="Supprimer ce rôle"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                    {r.isSystem && (
                                      <span className="text-[8px] font-bold text-aaj-gray">
                                        Système
                                      </span>
                                    )}
                                  </div>
                                </th>
                              ))}
                              {rolesList.length === 0 && (
                                <th className="p-3 text-[10px] text-aaj-gray italic">
                                  Chargement des rôles...
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-aaj-border">
                            {PERMISSION_GROUPS.map((group) => (
                              <Fragment key={group.label}>
                                <tr className="bg-slate-50/60">
                                  <td
                                    colSpan={rolesList.length + 1}
                                    className="p-3 text-[10px] font-black uppercase tracking-[2px] text-aaj-royal"
                                  >
                                    {group.label}
                                  </td>
                                </tr>
                                {group.permissions.map((perm) => (
                                  <tr
                                    key={perm.key}
                                    className="hover:bg-slate-50/30 transition-colors"
                                  >
                                    <td className="sticky left-0 bg-white p-3 text-[11px] font-bold text-aaj-dark border-r border-aaj-border">
                                      <div>{perm.label}</div>
                                      <div className="text-[9px] text-aaj-gray font-mono mt-0.5">
                                        {perm.key}
                                      </div>
                                    </td>
                                    {rolesList.map((r) => {
                                      const checked =
                                        r.isAllAccess === true ||
                                        r.permissions?.[perm.key] === true;
                                      const disabled =
                                        r.isAllAccess === true || savingRoleId === r.id;
                                      return (
                                        <td key={r.id} className="p-3 text-center">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={disabled}
                                            onChange={(e) =>
                                              handleTogglePermission(r, perm.key, e.target.checked)
                                            }
                                            className={`w-4 h-4 accent-aaj-royal ${
                                              disabled
                                                ? 'cursor-not-allowed opacity-60'
                                                : 'cursor-pointer'
                                            }`}
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* User role assignment */}
                    <div className="border border-aaj-border rounded overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-aaj-border">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-aaj-dark">
                          Attribution des rôles aux utilisateurs
                        </h3>
                      </div>
                      <div className="p-4 flex flex-col md:flex-row gap-4 border-b border-aaj-border">
                        <div className="flex-1 relative">
                          <Search
                            size={14}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-aaj-gray"
                          />
                          <input
                            type="text"
                            value={rolesSearch}
                            onChange={(e) => setRolesSearch(e.target.value)}
                            placeholder="Rechercher par nom ou email..."
                            className="w-full pl-11 pr-4 py-3 border border-aaj-border rounded text-sm font-medium focus:border-aaj-royal focus:outline-none"
                          />
                        </div>
                        <select
                          value={rolesRoleFilter}
                          onChange={(e) => setRolesRoleFilter(e.target.value)}
                          className="px-4 py-3 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest bg-white text-aaj-dark focus:outline-none focus:border-aaj-royal"
                        >
                          <option value="all">Tous les rôles</option>
                          {rolesList.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-white border-b border-aaj-border">
                          <tr>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                              Utilisateur
                            </th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                              Rôle
                            </th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                              Statut
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-aaj-border">
                          {allUsers
                            .filter((m) => m.status !== 'archived')
                            .filter(
                              (m) =>
                                rolesRoleFilter === 'all' ||
                                (m.role || 'member') === rolesRoleFilter
                            )
                            .filter((m) => {
                              const s = rolesSearch.trim().toLowerCase();
                              if (!s) return true;
                              return (
                                (m.displayName || '').toLowerCase().includes(s) ||
                                (m.email || '').toLowerCase().includes(s)
                              );
                            })
                            .map((member) => {
                              const isSelf = member.uid === user?.uid;
                              const isUpdating = rolesUpdatingUid === member.uid;
                              const currentRole = member.role || 'member';
                              const currentStatus = member.status || 'pending';
                              return (
                                <tr
                                  key={member.uid}
                                  className="hover:bg-slate-50/50 transition-colors"
                                >
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-aaj-gray flex-shrink-0 overflow-hidden">
                                        {member.photoBase64 ? (
                                          <img
                                            src={member.photoBase64}
                                            alt={member.displayName || ''}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <UserCircle size={18} />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="text-sm font-black uppercase tracking-tight">
                                            {member.displayName || '—'}
                                          </p>
                                          {isSelf && (
                                            <span className="px-2 py-0.5 rounded-full bg-aaj-electric/10 text-aaj-royal text-[8px] font-black uppercase tracking-widest border border-aaj-electric/30">
                                              Vous
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest">
                                          {member.email}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <select
                                      value={currentRole}
                                      disabled={isSelf || isUpdating}
                                      onChange={(e) => handleUpdateRole(member, e.target.value)}
                                      className={`w-full border rounded px-3 py-2 text-[10px] font-black uppercase tracking-widest bg-white ${
                                        isSelf || isUpdating
                                          ? 'text-aaj-gray border-aaj-border cursor-not-allowed'
                                          : 'text-aaj-dark border-aaj-border hover:border-aaj-royal focus:outline-none focus:border-aaj-royal'
                                      }`}
                                    >
                                      {rolesList.length === 0 && (
                                        <option value={currentRole}>{currentRole}</option>
                                      )}
                                      {rolesList.map((r) => (
                                        <option key={r.id} value={r.id}>
                                          {r.name}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-4">
                                    <select
                                      value={currentStatus}
                                      disabled={isSelf || isUpdating}
                                      onChange={(e) =>
                                        handleUpdateStatus(
                                          member,
                                          e.target.value as 'pending' | 'active' | 'suspended'
                                        )
                                      }
                                      className={`w-full border rounded px-3 py-2 text-[10px] font-black uppercase tracking-widest bg-white ${
                                        isSelf || isUpdating
                                          ? 'text-aaj-gray border-aaj-border cursor-not-allowed'
                                          : 'text-aaj-dark border-aaj-border hover:border-aaj-royal focus:outline-none focus:border-aaj-royal'
                                      }`}
                                    >
                                      <option value="pending">En attente</option>
                                      <option value="active">Actif</option>
                                      <option value="suspended">Suspendu</option>
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          {allUsers.length === 0 && (
                            <tr>
                              <td
                                colSpan={3}
                                className="p-8 text-center text-[11px] font-bold text-aaj-gray uppercase tracking-widest"
                              >
                                Aucun utilisateur
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'admin-config' && can('config_manage') && (
                  <motion.div
                    key="admin-config"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-10"
                  >
                    <div>
                      <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-2 block">
                        Super Admin
                      </span>
                      <h2 className="text-2xl font-black uppercase tracking-tighter">Paramètres</h2>
                      <p className="text-[11px] text-aaj-gray font-bold uppercase tracking-wider mt-2">
                        Configurer les listes utilisées lors de l&apos;ajout des adhérents
                      </p>
                    </div>

                    {configMessage && (
                      <div
                        className={`p-4 rounded border text-[11px] font-bold uppercase tracking-widest ${
                          configMessage.type === 'success'
                            ? 'bg-aaj-cyan/10 border-aaj-cyan/30 text-aaj-cyan'
                            : 'bg-aaj-magenta/10 border-aaj-magenta/30 text-aaj-magenta'
                        }`}
                      >
                        {configMessage.text}
                      </div>
                    )}

                    {/* SMTP diagnostic */}
                    <section className="border border-aaj-border rounded overflow-hidden">
                      <div className="p-5 bg-slate-50 border-b border-aaj-border">
                        <h3 className="text-sm font-black uppercase tracking-widest text-aaj-dark">
                          Diagnostic SMTP
                        </h3>
                        <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-wider mt-1">
                          Tester l&apos;envoi d&apos;email (adhésion, mot de passe oublié, compte
                          créé)
                        </p>
                      </div>
                      <div className="p-5 space-y-3">
                        <div className="flex flex-col md:flex-row gap-3">
                          <input
                            type="email"
                            value={mailTest.to}
                            onChange={(e) =>
                              setMailTest((s) => ({ ...s, to: e.target.value }))
                            }
                            placeholder={user?.email || 'destinataire@exemple.com'}
                            className="flex-1 bg-white border border-aaj-border rounded px-4 py-2 text-xs font-medium focus:outline-none focus:border-aaj-royal"
                          />
                          <button
                            type="button"
                            onClick={handleTestMail}
                            disabled={mailTest.sending}
                            className="bg-aaj-dark text-white px-6 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            {mailTest.sending ? (
                              <Loader2 className="animate-spin" size={12} />
                            ) : (
                              <Send size={12} />
                            )}
                            Envoyer un email de test
                          </button>
                        </div>

                        {mailTest.error && (
                          <div className="p-3 rounded border bg-aaj-magenta/10 border-aaj-magenta/30 text-aaj-magenta text-[11px] font-bold uppercase tracking-widest">
                            {mailTest.error}
                          </div>
                        )}

                        {mailTest.result && (
                          <div
                            className={`p-3 rounded border text-[11px] ${
                              mailTest.result.ok
                                ? 'bg-aaj-cyan/10 border-aaj-cyan/30 text-aaj-cyan'
                                : 'bg-aaj-magenta/10 border-aaj-magenta/30 text-aaj-magenta'
                            }`}
                          >
                            <div className="font-black uppercase tracking-widest mb-2">
                              {mailTest.result.ok
                                ? `Email envoyé en ${mailTest.result.elapsedMs} ms`
                                : `Échec d'envoi après ${mailTest.result.elapsedMs} ms`}
                            </div>
                            <div className="font-mono text-[10px] leading-relaxed">
                              host : {mailTest.result.smtp.host}:
                              {mailTest.result.smtp.port} ({mailTest.result.smtp.encryption ||
                                'plain'})
                              <br />
                              from : {mailTest.result.smtp.from_email} (
                              {mailTest.result.smtp.from_name})
                              <br />
                              password :{' '}
                              {mailTest.result.smtp.has_password ? 'configuré' : 'VIDE ⚠'}
                              <br />
                              tcp :{' '}
                              {mailTest.result.tcpOk === null
                                ? 'non testé'
                                : mailTest.result.tcpOk
                                  ? 'port ouvert ✓'
                                  : 'port injoignable ✗'}
                            </div>
                            {mailTest.result.log.length > 0 && (
                              <pre className="mt-2 p-2 bg-white/60 rounded border border-slate-200 text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
                                {mailTest.result.log.join('\n')}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Mails de notifications */}
                    <NotificationSettingsPanel />

                    {/* Member Types */}
                    <section className="border border-aaj-border rounded overflow-hidden">
                      <div className="p-5 bg-slate-50 border-b border-aaj-border flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-widest text-aaj-dark">
                            Types de membres
                          </h3>
                          <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-wider mt-1">
                            Lettre utilisée dans le matricule AAJ + libellé
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetMemberTypes}
                          disabled={configSaving}
                          className="text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:text-aaj-dark border border-aaj-border px-4 py-2 rounded"
                        >
                          Réinitialiser
                        </button>
                      </div>
                      <div className="divide-y divide-aaj-border">
                        {memberTypesList.map((t) =>
                          editingTypeLetter === t.letter ? (
                            <div
                              key={t.letter}
                              className="px-5 py-3 bg-slate-50 grid grid-cols-1 md:grid-cols-[80px_1fr_auto_auto] gap-3 items-center"
                            >
                              <input
                                type="text"
                                value={editTypeInput.letter}
                                onChange={(e) =>
                                  setEditTypeInput({
                                    ...editTypeInput,
                                    letter: e.target.value.toUpperCase().slice(0, 1),
                                  })
                                }
                                placeholder="Lettre"
                                maxLength={1}
                                className="bg-white border border-aaj-border rounded px-3 py-2 text-xs font-black uppercase text-center tracking-widest"
                              />
                              <input
                                type="text"
                                value={editTypeInput.label}
                                onChange={(e) =>
                                  setEditTypeInput({ ...editTypeInput, label: e.target.value })
                                }
                                placeholder="Libellé"
                                className="bg-white border border-aaj-border rounded px-3 py-2 text-xs font-bold"
                              />
                              <button
                                type="button"
                                onClick={handleUpdateMemberType}
                                disabled={configSaving}
                                className="bg-aaj-dark text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center justify-center gap-2"
                              >
                                <CheckCircle2 size={12} /> Enregistrer
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditMemberType}
                                disabled={configSaving}
                                className="border border-aaj-border text-aaj-gray px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <div
                              key={t.letter}
                              className="flex items-center justify-between px-5 py-3"
                            >
                              <div className="flex items-center gap-4">
                                <span className="w-10 h-10 rounded bg-aaj-dark text-white flex items-center justify-center font-black">
                                  {t.letter}
                                </span>
                                <span className="text-xs font-bold text-aaj-dark">{t.label}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => startEditMemberType(t)}
                                  disabled={configSaving}
                                  className="text-aaj-gray hover:text-aaj-royal transition-colors"
                                  title="Modifier"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMemberType(t.letter)}
                                  disabled={configSaving}
                                  className="text-aaj-magenta hover:text-aaj-magenta transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          )
                        )}
                        {memberTypesList.length === 0 && (
                          <div className="px-5 py-4 text-[11px] text-aaj-gray italic">
                            Aucun type configuré.
                          </div>
                        )}
                      </div>
                      <div className="p-5 bg-slate-50 border-t border-aaj-border grid grid-cols-1 md:grid-cols-[80px_1fr_auto] gap-3">
                        <input
                          type="text"
                          value={newTypeInput.letter}
                          onChange={(e) =>
                            setNewTypeInput({
                              ...newTypeInput,
                              letter: e.target.value.toUpperCase().slice(0, 1),
                            })
                          }
                          placeholder="Lettre"
                          maxLength={1}
                          className="bg-white border border-aaj-border rounded px-3 py-2 text-xs font-black uppercase text-center tracking-widest"
                        />
                        <input
                          type="text"
                          value={newTypeInput.label}
                          onChange={(e) =>
                            setNewTypeInput({ ...newTypeInput, label: e.target.value })
                          }
                          placeholder="Libellé du type (ex: Architecte)"
                          className="bg-white border border-aaj-border rounded px-3 py-2 text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={handleAddMemberType}
                          disabled={configSaving}
                          className="bg-aaj-dark text-white px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={12} /> Ajouter
                        </button>
                      </div>
                    </section>

                    {/* Villes / Délégations */}
                    <section className="border border-aaj-border rounded overflow-hidden">
                      <div className="p-5 bg-slate-50 border-b border-aaj-border flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-widest text-aaj-dark">
                            Villes / Délégations
                          </h3>
                          <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-wider mt-1">
                            {villesList.length} délégation{villesList.length > 1 ? 's' : ''}{' '}
                            disponible
                            {villesList.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetVilles}
                          disabled={configSaving}
                          className="text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:text-aaj-dark border border-aaj-border px-4 py-2 rounded"
                        >
                          Restaurer liste complète
                        </button>
                      </div>
                      <div className="p-5 bg-slate-50 border-b border-aaj-border flex gap-3">
                        <input
                          type="text"
                          value={newVilleInput}
                          onChange={(e) => setNewVilleInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddVille(newVilleInput);
                            }
                          }}
                          placeholder="Ajouter une ville / délégation"
                          className="flex-1 bg-white border border-aaj-border rounded px-3 py-2 text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddVille(newVilleInput)}
                          disabled={configSaving}
                          className="bg-aaj-dark text-white px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={12} /> Ajouter
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-aaj-border">
                        {villesList.map((v) => (
                          <div key={v} className="flex items-center justify-between px-5 py-2.5">
                            <span className="text-xs font-bold text-aaj-dark">{v}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveVille(v)}
                              disabled={configSaving}
                              className="text-aaj-magenta hover:text-aaj-magenta transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                        {villesList.length === 0 && (
                          <div className="px-5 py-4 text-[11px] text-aaj-gray italic">
                            Aucune ville configurée.
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Catégories d'annonces */}
                    <section className="border border-aaj-border rounded overflow-hidden">
                      <div className="p-5 bg-slate-50 border-b border-aaj-border flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-widest text-aaj-dark">
                            Catégories d&apos;annonces
                          </h3>
                          <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-wider mt-1">
                            {newsCategoriesList.length} catégorie
                            {newsCategoriesList.length > 1 ? 's' : ''} disponible
                            {newsCategoriesList.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetNewsCategories}
                          disabled={configSaving}
                          className="text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:text-aaj-dark border border-aaj-border px-4 py-2 rounded"
                        >
                          Réinitialiser
                        </button>
                      </div>
                      <div className="p-5 bg-slate-50 border-b border-aaj-border flex gap-3">
                        <input
                          type="text"
                          value={newNewsCategoryInput}
                          onChange={(e) => setNewNewsCategoryInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewsCategory(newNewsCategoryInput);
                            }
                          }}
                          placeholder="Ajouter une catégorie (ex: Important)"
                          className="flex-1 bg-white border border-aaj-border rounded px-3 py-2 text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddNewsCategory(newNewsCategoryInput)}
                          disabled={configSaving}
                          className="bg-aaj-dark text-white px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={12} /> Ajouter
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-aaj-border">
                        {newsCategoriesList.map((cat) => {
                          const style = newsCategoryStyle(cat);
                          return (
                            <div
                              key={cat}
                              className="flex items-center justify-between px-5 py-2.5"
                            >
                              <span
                                className="inline-flex items-center text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                                style={{ backgroundColor: style.bg, color: style.text }}
                              >
                                {cat}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveNewsCategory(cat)}
                                disabled={configSaving}
                                className="text-aaj-magenta hover:text-aaj-magenta transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                        {newsCategoriesList.length === 0 && (
                          <div className="px-5 py-4 text-[11px] text-aaj-gray italic">
                            Aucune catégorie configurée.
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Types de commissions */}
                    <section className="border border-aaj-border rounded overflow-hidden">
                      <div className="p-5 bg-slate-50 border-b border-aaj-border flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-widest text-aaj-dark">
                            Types de commissions
                          </h3>
                          <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-wider mt-1">
                            {commissionTypesList.length} type
                            {commissionTypesList.length > 1 ? 's' : ''} disponible
                            {commissionTypesList.length > 1 ? 's' : ''} pour les avis de commissions
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetCommissionTypes}
                          disabled={configSaving}
                          className="text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:text-aaj-dark border border-aaj-border px-4 py-2 rounded"
                        >
                          Réinitialiser
                        </button>
                      </div>
                      <div className="p-5 bg-slate-50 border-b border-aaj-border flex gap-3">
                        <input
                          type="text"
                          value={newCommissionTypeInput}
                          onChange={(e) => setNewCommissionTypeInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCommissionType(newCommissionTypeInput);
                            }
                          }}
                          placeholder="Ajouter un type (ex: Ordinaire)"
                          className="flex-1 bg-white border border-aaj-border rounded px-3 py-2 text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCommissionType(newCommissionTypeInput)}
                          disabled={configSaving}
                          className="bg-aaj-dark text-white px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={12} /> Ajouter
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-aaj-border">
                        {commissionTypesList.map((t) => (
                          <div key={t} className="flex items-center justify-between px-5 py-2.5">
                            <span className="text-xs font-bold text-aaj-dark">{t}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCommissionType(t)}
                              disabled={configSaving}
                              className="text-aaj-magenta hover:text-aaj-magenta transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                        {commissionTypesList.length === 0 && (
                          <div className="px-5 py-4 text-[11px] text-aaj-gray italic">
                            Aucun type configuré.
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Couleurs des commissions */}
                    <section className="border border-aaj-border rounded overflow-hidden">
                      <div className="p-5 bg-slate-50 border-b border-aaj-border flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-widest text-aaj-dark">
                            Couleurs des commissions
                          </h3>
                          <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-wider mt-1">
                            Couleur affichée sur le calendrier et les cartes de commune
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleResetCommissionColors}
                            disabled={configSaving}
                            className="text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:text-aaj-dark border border-aaj-border px-4 py-2 rounded"
                          >
                            Réinitialiser
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveCommissionColors}
                            disabled={configSaving || Object.keys(colorDrafts).length === 0}
                            className="bg-aaj-dark text-white px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <Save size={12} /> Enregistrer
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-aaj-border">
                        {['Houmt Souk', 'Midoun', 'Ajim'].map((town) => {
                          const current =
                            colorDrafts[town] ?? colorForTown(town, commissionColors);
                          const isDirty = colorDrafts[town] !== undefined;
                          return (
                            <div
                              key={town}
                              className="flex items-center justify-between px-5 py-3 gap-4"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <span
                                  className="w-8 h-8 rounded border border-aaj-border flex-shrink-0"
                                  style={{ backgroundColor: current }}
                                />
                                <div>
                                  <span className="text-xs font-black uppercase tracking-widest text-aaj-dark block">
                                    {town}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-aaj-gray">
                                    {current}
                                    {isDirty && (
                                      <span className="ml-2 text-aaj-amber">· Non enregistré</span>
                                    )}
                                  </span>
                                </div>
                              </div>
                              <input
                                type="color"
                                value={current}
                                onChange={(e) =>
                                  setColorDrafts((d) => ({ ...d, [town]: e.target.value }))
                                }
                                disabled={configSaving}
                                className="h-9 w-16 cursor-pointer rounded border border-aaj-border bg-white"
                                aria-label={`Couleur pour ${town}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </motion.div>
                )}

                {activeTab === 'admin-partners' && can('partners_manage') && (
                  <motion.div
                    key="admin-partners"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">
                        Gestion des Partenaires
                      </h2>
                      <button className="bg-aaj-dark text-white px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center gap-2">
                        <Plus size={14} /> Nouveau Partenaire
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {partnersList.map((partner) => (
                        <div
                          key={partner.id}
                          className="p-8 border border-aaj-border rounded bg-white relative"
                        >
                          <div
                            className={`absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                              partner.level === 'Platine'
                                ? 'bg-aaj-amber/10 text-aaj-amber border-aaj-amber/30'
                                : partner.level === 'Or'
                                  ? 'bg-aaj-amber/10 text-aaj-amber border-aaj-amber/30'
                                  : 'bg-slate-50 text-slate-700 border-slate-100'
                            }`}
                          >
                            {partner.level}
                          </div>
                          <h3 className="text-lg font-black uppercase tracking-tight mb-2">
                            {partner.name}
                          </h3>
                          <p className="text-[10px] font-bold text-aaj-gray uppercase tracking-widest mb-4 border-b border-aaj-border pb-2">
                            Actif depuis : {partner.joined}
                          </p>

                          <div className="flex items-center justify-between gap-4 mb-6">
                            <span className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                              Visibilité membres
                            </span>
                            <button
                              onClick={() =>
                                handleTogglePartnerVisibility(partner.id, partner.isVisible)
                              }
                              className={`w-10 h-5 rounded-full relative transition-all ${partner.isVisible ? 'bg-aaj-royal' : 'bg-slate-200'}`}
                            >
                              <div
                                className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${partner.isVisible ? 'left-6' : 'left-1'}`}
                              />
                            </button>
                          </div>

                          <div className="flex gap-4">
                            <button className="flex-1 text-[9px] font-black uppercase tracking-widest text-aaj-royal border border-aaj-royal/20 py-2 rounded hover:bg-aaj-royal hover:text-white transition-all">
                              Gérer
                            </button>
                            <button className="flex-1 text-[9px] font-black uppercase tracking-widest text-aaj-magenta border border-aaj-magenta/30 py-2 rounded hover:bg-aaj-magenta/10 transition-all">
                              Retirer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'admin-messages' && can('messages_inbox') && (
                  <motion.div
                    key="admin-messages"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">
                        Messages Entrants & Dépôts
                      </h2>
                      <div className="flex gap-4">
                        <div className="bg-slate-100 px-4 py-2 rounded border border-slate-200 text-[10px] font-black uppercase tracking-widest text-aaj-gray flex items-center gap-2">
                          {adminMessages.filter((m) => m.status === 'unread').length} Non lus
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {adminMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-8 border rounded transition-all ${msg.status === 'unread' ? 'bg-aaj-electric/10/30 border-aaj-royal/30' : 'bg-white border-aaj-border opacity-70'}`}
                        >
                          <div className="flex flex-col md:flex-row justify-between gap-8">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span
                                  className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${msg.status === 'unread' ? 'bg-aaj-royal text-white' : 'bg-slate-100 text-aaj-gray'}`}
                                >
                                  {msg.status === 'unread' ? 'Nouveau' : 'Lu'}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-aaj-dark underline decoration-aaj-royal/30 decoration-2">
                                  {msg.userName}
                                </span>
                                <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">
                                  • {msg.userEmail}
                                </span>
                              </div>
                              <h4 className="text-sm font-black uppercase tracking-tight text-aaj-dark mb-4">
                                {msg.subject}
                              </h4>
                              <div className="text-xs text-aaj-gray leading-relaxed font-medium mb-6 bg-slate-50/50 p-4 rounded-lg italic">
                                &quot;{msg.message}&quot;
                              </div>

                              {msg.fileBase64 && (
                                <div className="flex items-center gap-4 bg-white border border-aaj-border p-4 rounded group w-fit">
                                  <FileText size={20} className="text-aaj-royal" />
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-aaj-dark">
                                      {msg.fileName}
                                    </span>
                                    <a
                                      href={msg.fileBase64}
                                      download={msg.fileName}
                                      className="text-[8px] font-black uppercase text-aaj-royal hover:underline mt-1 flex items-center gap-1"
                                    >
                                      <Download size={10} /> Télécharger le dépôt
                                    </a>
                                  </div>
                                </div>
                              )}

                              {msg.replied && msg.replyMessage && (
                                <div className="mt-6 border-l-4 border-aaj-cyan bg-aaj-cyan/10 p-4 rounded">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 size={12} className="text-aaj-cyan" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-aaj-cyan">
                                      Réponse envoyée
                                      {formatReplyTimestamp(msg.repliedAt)}
                                    </span>
                                  </div>
                                  <div className="text-xs text-aaj-dark leading-relaxed font-medium whitespace-pre-wrap">
                                    {msg.replyMessage}
                                  </div>
                                </div>
                              )}

                              {replyingMessageId === msg.id && (
                                <div className="mt-6 border border-aaj-royal/30 bg-aaj-royal/5 p-4 rounded">
                                  <label className="block text-[10px] font-black uppercase tracking-widest text-aaj-gray mb-2">
                                    Votre réponse à {msg.userName || msg.userEmail}
                                  </label>
                                  <textarea
                                    value={replyBody}
                                    onChange={(e) => setReplyBody(e.target.value)}
                                    rows={6}
                                    maxLength={10000}
                                    placeholder="Saisissez votre réponse — elle sera envoyée par email à l'expéditeur."
                                    className="w-full p-3 border border-aaj-border rounded text-xs font-medium text-aaj-dark focus:outline-none focus:border-aaj-royal resize-y"
                                    disabled={isSendingReply}
                                  />
                                  <div className="flex gap-3 mt-3">
                                    <button
                                      onClick={() => handleSendReply(msg.id)}
                                      disabled={isSendingReply || !replyBody.trim()}
                                      className="px-4 py-2 bg-aaj-royal text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                      {isSendingReply ? (
                                        <>
                                          <Loader2 size={12} className="animate-spin" /> Envoi…
                                        </>
                                      ) : (
                                        <>
                                          <Send size={12} /> Envoyer la réponse
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setReplyingMessageId(null);
                                        setReplyBody('');
                                      }}
                                      disabled={isSendingReply}
                                      className="px-4 py-2 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:bg-slate-50 transition-all disabled:opacity-50"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="md:w-64 flex flex-col gap-4 justify-between border-l border-aaj-border pl-8">
                              <div className="space-y-4">
                                <div className="flex items-center gap-3 justify-between">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                                    Statut de réponse
                                  </label>
                                  <div
                                    onClick={() =>
                                      handleUpdateMessageStatus(msg.id, { replied: !msg.replied })
                                    }
                                    className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${msg.replied ? 'bg-aaj-cyan/100' : 'bg-slate-200'}`}
                                  >
                                    <div
                                      className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${msg.replied ? 'left-6' : 'left-1'}`}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {msg.replied ? (
                                    <CheckCircle2 size={12} className="text-aaj-cyan" />
                                  ) : (
                                    <Loader2 size={12} className="text-aaj-amber" />
                                  )}
                                  <span
                                    className={`text-[9px] font-black uppercase tracking-widest ${msg.replied ? 'text-aaj-cyan' : 'text-aaj-amber'}`}
                                  >
                                    {msg.replied ? 'Déjà Répondu' : 'En attente de réponse'}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <button
                                  onClick={() => {
                                    if (replyingMessageId === msg.id) {
                                      setReplyingMessageId(null);
                                      setReplyBody('');
                                    } else {
                                      setReplyingMessageId(msg.id);
                                      setReplyBody('');
                                    }
                                  }}
                                  className="w-full py-2 bg-aaj-royal text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-dark transition-all flex items-center justify-center gap-2"
                                >
                                  <Send size={12} />
                                  {msg.replied ? 'Répondre à nouveau' : 'Répondre'}
                                </button>
                                {msg.status === 'unread' && (
                                  <button
                                    onClick={() =>
                                      handleUpdateMessageStatus(msg.id, { status: 'read' })
                                    }
                                    className="w-full py-2 bg-aaj-dark text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all"
                                  >
                                    Marquer comme lu
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleUpdateMessageStatus(msg.id, {
                                      status: msg.status === 'unread' ? 'read' : 'unread',
                                    })
                                  }
                                  className="w-full py-2 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:bg-slate-50 transition-all"
                                >
                                  {msg.status === 'unread' ? 'Archiver' : 'Remettre en non-lu'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {adminMessages.length === 0 && (
                        <div className="text-center py-20 border border-dashed border-aaj-border rounded">
                          <p className="text-[10px] font-black uppercase tracking-widest text-aaj-gray opacity-50">
                            Aucun message reçu pour le moment
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
                {activeTab === 'admin-commissions' && isRepresentative && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <h2 className="text-2xl font-black uppercase tracking-tighter">
                      Dépôt des Avis Commissions
                    </h2>
                    <form
                      onSubmit={handleAddPV}
                      className="max-w-2xl bg-slate-50/50 p-10 border border-aaj-border rounded space-y-8"
                    >
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                            Commune
                          </label>
                          <select
                            value={newPV.town}
                            onChange={(e) => setNewPV({ ...newPV, town: e.target.value })}
                            className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold uppercase tracking-widest"
                          >
                            <option>Houmt Souk</option>
                            <option>Midoun</option>
                            <option>Ajim</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                            Date Commission
                          </label>
                          <input
                            type="date"
                            required
                            value={newPV.date}
                            onChange={(e) => setNewPV({ ...newPV, date: e.target.value })}
                            className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Fichiers PV (images ou PDF)
                        </label>
                        <div className="border border-aaj-border rounded bg-white p-8 text-center relative group overflow-hidden">
                          <input
                            ref={pvFileInputRef}
                            type="file"
                            multiple
                            accept="image/*,application/pdf"
                            disabled={pvUploading}
                            onChange={(e) => handlePvFilesSelected(e.target.files)}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                          />
                          {pvUploading ? (
                            <Loader2 size={24} className="mx-auto text-aaj-royal mb-2 animate-spin" />
                          ) : (
                            <Upload size={24} className="mx-auto text-aaj-royal mb-2" />
                          )}
                          <p className="text-[10px] font-black uppercase tracking-widest group-hover:text-aaj-royal transition-colors">
                            {pvUploading
                              ? 'Envoi en cours…'
                              : newPV.files.length > 0
                                ? `Ajouter d'autres fichiers (${newPV.files.length} sélectionné${newPV.files.length > 1 ? 's' : ''})`
                                : 'Sélectionner une ou plusieurs images / PDF'}
                          </p>
                        </div>
                        {newPV.files.length > 0 && (
                          <ul className="mt-4 space-y-2">
                            {newPV.files.map((f, idx) => {
                              const isImg = (f.type || '').startsWith('image/');
                              return (
                                <li
                                  key={f.id}
                                  className="flex items-center gap-3 p-2 border border-aaj-border rounded bg-white"
                                >
                                  {isImg ? (
                                    <img
                                      src={f.url}
                                      alt={f.name}
                                      className="w-10 h-10 object-cover rounded border border-aaj-border"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 flex items-center justify-center rounded border border-aaj-border bg-slate-50">
                                      <FileText size={16} className="text-aaj-royal" />
                                    </div>
                                  )}
                                  <span className="flex-1 text-[11px] font-bold truncate text-aaj-dark">
                                    {f.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removePvFile(idx)}
                                    className="text-aaj-gray hover:text-aaj-magenta transition-colors"
                                    aria-label="Retirer ce fichier"
                                  >
                                    <X size={16} />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                            Nombre de dossiers
                          </label>
                          <input
                            type="number"
                            required
                            placeholder="Ex: 15"
                            value={newPV.count}
                            onChange={(e) => setNewPV({ ...newPV, count: e.target.value })}
                            className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                            Type de commission
                          </label>
                          <input
                            type="text"
                            list="commission-types"
                            placeholder="Ex: Ordinaire, Extraordinaire…"
                            value={newPV.type}
                            onChange={(e) => setNewPV({ ...newPV, type: e.target.value })}
                            className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                          />
                          <datalist id="commission-types">
                            {commissionTypesList.map((t) => (
                              <option key={t} value={t} />
                            ))}
                          </datalist>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full bg-aaj-royal text-white py-4 rounded font-black uppercase tracking-widest text-[11px] shadow-lg shadow-aaj-royal/20 active:scale-95 transition-all flex justify-center items-center gap-2"
                      >
                        {isSaving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        Publier les avis
                      </button>
                    </form>
                  </motion.div>
                )}

                {activeTab === 'jobs' && can('jobs_view') && (
                  <motion.div
                    key="jobs"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-aaj-border">
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">
                          Emplois & Stages
                        </h2>
                        <p className="text-[11px] font-bold text-aaj-gray uppercase tracking-widest mt-2">
                          Offres déposées par les adhérents · Demandes émises par les candidats
                        </p>
                      </div>
                      {can('jobs_create') && (
                        <button
                          type="button"
                          onClick={() => selectTab('publish-job')}
                          className="inline-flex items-center gap-2 bg-aaj-dark text-white px-5 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all"
                        >
                          <Plus size={14} /> Publier une offre
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: 'all', label: 'Tous' },
                        { key: 'offer', label: 'Offres' },
                        { key: 'request', label: 'Demandes' },
                      ] as { key: 'all' | 'offer' | 'request'; label: string }[]).map((f) => {
                        const active = jobsTabFilter === f.key;
                        const count = jobItems.filter((j) => {
                          if ((j.status || 'pending') !== 'approved') return false;
                          if (f.key === 'all') return true;
                          return j.kind === f.key;
                        }).length;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setJobsTabFilter(f.key)}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-[2px] rounded transition-all ${
                              active
                                ? 'bg-aaj-dark text-white'
                                : 'border border-aaj-border text-aaj-gray hover:border-aaj-dark hover:text-aaj-dark'
                            }`}
                          >
                            {f.label}
                            <span className={`text-[9px] ${active ? 'text-white/70' : 'text-aaj-gray'}`}>
                              ({count})
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const visible = jobItems.filter(
                        (j) =>
                          (j.status || 'pending') === 'approved' &&
                          (jobsTabFilter === 'all' || j.kind === jobsTabFilter)
                      );
                      if (visible.length === 0) {
                        return (
                          <div className="p-12 border border-dashed border-aaj-border rounded text-center bg-slate-50/50">
                            <Briefcase size={40} className="mx-auto text-aaj-gray/40 mb-4" />
                            <p className="text-sm font-black uppercase tracking-widest text-aaj-gray">
                              Aucune annonce pour le moment.
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {visible.map((it) => {
                            const isOffer = it.kind === 'offer';
                            const date = it.createdAt?.toDate?.()?.toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            });
                            return (
                              <button
                                key={it.id}
                                type="button"
                                onClick={() => setJobDetail(it)}
                                className="text-left border border-aaj-border rounded bg-white p-6 hover:border-aaj-royal hover:shadow-md transition-all flex flex-col h-full"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <span
                                    className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[2px] px-2.5 py-1 rounded border ${
                                      isOffer
                                        ? 'bg-aaj-soft text-aaj-royal border-aaj-royal/20'
                                        : 'bg-aaj-cyan/10 text-aaj-cyan border-aaj-cyan/30'
                                    }`}
                                  >
                                    {isOffer ? 'Offre' : 'Demande'}
                                  </span>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray border border-aaj-border px-2 py-0.5 rounded">
                                    {it.contractType || '—'}
                                  </span>
                                </div>
                                <h3 className="text-base font-black uppercase tracking-tight text-aaj-dark mb-2 line-clamp-2">
                                  {it.title}
                                </h3>
                                <p className="text-[12px] text-aaj-gray font-medium leading-relaxed mb-4 line-clamp-3 flex-1">
                                  {it.description}
                                </p>
                                <div className="space-y-1.5 text-[10px] font-bold text-aaj-gray uppercase tracking-tight">
                                  {it.company && (
                                    <div className="flex items-center gap-2">
                                      <Building2 size={11} className="text-aaj-royal" />
                                      <span className="truncate">{it.company}</span>
                                    </div>
                                  )}
                                  {!it.company && it.authorName && (
                                    <div className="flex items-center gap-2">
                                      <UserCircle size={11} className="text-aaj-royal" />
                                      <span className="truncate">{it.authorName}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <MapPin size={11} className="text-aaj-royal" />
                                    <span>{it.city}</span>
                                  </div>
                                  {date && (
                                    <div className="flex items-center gap-2">
                                      <FileText size={11} className="text-aaj-royal" />
                                      <span>{date}</span>
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </motion.div>
                )}

                {activeTab === 'publish-job' && can('jobs_create') && (
                  <motion.div
                    key="publish-job"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-center pb-4 border-b border-aaj-border">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">
                        Publier une offre d&apos;emploi ou de stage
                      </h2>
                      <button
                        type="button"
                        onClick={() => selectTab('jobs')}
                        className="text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:text-aaj-royal flex items-center gap-2 border border-aaj-border px-4 py-2 rounded"
                      >
                        <Briefcase size={14} /> Voir le tableau
                      </button>
                    </div>

                    <form
                      onSubmit={handlePublishJobOffer}
                      className="max-w-3xl bg-slate-50/50 p-10 border border-aaj-border rounded space-y-8"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                            Type de contrat
                          </label>
                          <select
                            value={newJob.contractType}
                            onChange={(e) =>
                              setNewJob({ ...newJob, contractType: e.target.value })
                            }
                            className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold uppercase tracking-widest"
                          >
                            <option>CDI</option>
                            <option>CDD</option>
                            <option>Stage</option>
                            <option>Apprentissage</option>
                            <option>Freelance</option>
                            <option>Autre</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                            Ville
                          </label>
                          <select
                            value={newJob.city}
                            onChange={(e) => setNewJob({ ...newJob, city: e.target.value })}
                            className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold uppercase tracking-widest"
                          >
                            {villesList.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Intitulé du poste
                        </label>
                        <input
                          type="text"
                          required
                          value={newJob.title}
                          onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                          placeholder="Ex: Architecte de projet senior"
                          className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Cabinet / Entreprise
                        </label>
                        <input
                          type="text"
                          value={newJob.company}
                          onChange={(e) => setNewJob({ ...newJob, company: e.target.value })}
                          placeholder="Nom du cabinet ou de la structure"
                          className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Description du poste
                        </label>
                        <textarea
                          required
                          rows={6}
                          value={newJob.description}
                          onChange={(e) =>
                            setNewJob({ ...newJob, description: e.target.value })
                          }
                          placeholder="Missions, profil recherché, compétences attendues, modalités…"
                          className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-medium focus:ring-1 focus:ring-aaj-royal outline-none transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                            Email de contact
                          </label>
                          <input
                            type="email"
                            required
                            value={newJob.contactEmail}
                            onChange={(e) =>
                              setNewJob({ ...newJob, contactEmail: e.target.value })
                            }
                            placeholder="contact@cabinet.com"
                            className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                            Téléphone (optionnel)
                          </label>
                          <input
                            type="tel"
                            value={newJob.contactPhone}
                            onChange={(e) =>
                              setNewJob({ ...newJob, contactPhone: e.target.value })
                            }
                            placeholder="+216 ..."
                            className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-medium focus:ring-1 focus:ring-aaj-royal outline-none transition-all"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full bg-aaj-royal text-white py-4 rounded font-black uppercase tracking-widest text-[11px] shadow-lg shadow-aaj-royal/20 active:scale-95 transition-all flex justify-center items-center gap-2"
                      >
                        {isSaving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        Publier l&apos;offre
                      </button>
                    </form>
                  </motion.div>
                )}

                {activeTab === 'admin-jobs' && can('jobs_manage') && (
                  <motion.div
                    key="admin-jobs"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="pb-4 border-b border-aaj-border">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">
                        Modération des Emplois & Stages
                      </h2>
                      <p className="text-[11px] font-bold text-aaj-gray uppercase tracking-widest mt-2">
                        Validez les demandes envoyées via l&apos;espace public et gérez toutes les
                        annonces.
                      </p>
                    </div>

                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-royal flex items-center gap-2">
                        <Clock size={12} /> En attente de validation
                        <span className="ml-2 px-2 py-0.5 rounded bg-aaj-soft text-aaj-royal text-[9px]">
                          {jobItems.filter((j) => (j.status || 'pending') === 'pending').length}
                        </span>
                      </h3>
                      {jobItems.filter((j) => (j.status || 'pending') === 'pending').length ===
                      0 ? (
                        <div className="p-8 border border-dashed border-aaj-border rounded text-center bg-slate-50/50">
                          <CheckCircle2 size={32} className="mx-auto text-aaj-cyan/40 mb-3" />
                          <p className="text-[11px] font-black uppercase tracking-widest text-aaj-gray">
                            Toutes les demandes ont été traitées.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {jobItems
                            .filter((j) => (j.status || 'pending') === 'pending')
                            .map((j) => (
                              <article
                                key={j.id}
                                className="border border-aaj-border rounded bg-white overflow-hidden"
                              >
                                <div className="px-6 py-4 bg-slate-50 border-b border-aaj-border flex flex-wrap items-center gap-3 justify-between">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[2px] px-2.5 py-1 rounded border ${
                                        j.kind === 'offer'
                                          ? 'bg-aaj-soft text-aaj-royal border-aaj-royal/20'
                                          : 'bg-aaj-cyan/10 text-aaj-cyan border-aaj-cyan/30'
                                      }`}
                                    >
                                      {j.kind === 'offer' ? 'Offre' : 'Demande'}
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray border border-aaj-border px-2 py-0.5 rounded">
                                      {j.contractType || '—'}
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray">
                                      {j.source === 'public' ? 'Espace public' : 'Espace adhérent'}
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray">
                                    {j.createdAt?.toDate?.()?.toLocaleDateString('fr-FR') || ''}
                                  </span>
                                </div>
                                <div className="p-6 space-y-3">
                                  <h4 className="text-base font-black uppercase tracking-tight">
                                    {j.title}
                                  </h4>
                                  <p className="text-[12px] text-aaj-gray font-medium leading-relaxed whitespace-pre-wrap">
                                    {j.description}
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-bold text-aaj-gray uppercase tracking-tight pt-2 border-t border-aaj-border">
                                    <span>{j.authorName || '—'} · {j.city}</span>
                                    <span className="md:text-right">
                                      {j.authorEmail || ''}
                                      {j.authorPhone ? ` · ${j.authorPhone}` : ''}
                                    </span>
                                  </div>
                                  {j.cvFileId && (
                                    <a
                                      href={`/api/files/${encodeURIComponent(j.cvFileId)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-aaj-royal hover:underline"
                                    >
                                      <FileText size={12} />
                                      {j.cvFileName || 'CV / Portfolio'}
                                    </a>
                                  )}
                                </div>
                                <div className="px-6 py-4 bg-slate-50 border-t border-aaj-border flex justify-end gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleRejectJob(j.id)}
                                    className="px-5 py-2 border border-aaj-magenta/30 text-aaj-magenta rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-magenta/10 transition-colors"
                                  >
                                    Rejeter
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveJob(j.id)}
                                    className="px-5 py-2 bg-aaj-cyan text-aaj-night text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-cyan transition-colors shadow-lg shadow-aaj-cyan/20"
                                  >
                                    Publier
                                  </button>
                                </div>
                              </article>
                            ))}
                        </div>
                      )}
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-royal flex items-center gap-2">
                        <FileText size={12} /> Toutes les annonces
                      </h3>
                      <div className="border border-aaj-border rounded overflow-hidden">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-50 border-b border-aaj-border">
                            <tr className="text-[9px] font-black uppercase tracking-widest text-aaj-gray">
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3">Titre</th>
                              <th className="px-4 py-3">Auteur</th>
                              <th className="px-4 py-3">Statut</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobItems.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-4 py-8 text-center text-aaj-gray font-bold uppercase tracking-widest"
                                >
                                  Aucune annonce.
                                </td>
                              </tr>
                            ) : (
                              jobItems.map((j) => {
                                const status = j.status || 'pending';
                                const statusClass =
                                  status === 'approved'
                                    ? 'bg-aaj-cyan/10 text-aaj-cyan border-aaj-cyan/30'
                                    : status === 'rejected'
                                      ? 'bg-aaj-magenta/10 text-aaj-magenta border-aaj-magenta/30'
                                      : 'bg-aaj-amber/10 text-aaj-amber border-aaj-amber/40';
                                return (
                                  <tr
                                    key={j.id}
                                    className="border-t border-aaj-border hover:bg-slate-50/50"
                                  >
                                    <td className="px-4 py-3 font-black uppercase tracking-widest text-aaj-dark text-[10px]">
                                      {j.kind === 'offer' ? 'Offre' : 'Demande'}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-aaj-dark">
                                      <button
                                        type="button"
                                        onClick={() => setJobDetail(j)}
                                        className="text-left hover:text-aaj-royal"
                                      >
                                        {j.title}
                                      </button>
                                    </td>
                                    <td className="px-4 py-3 text-aaj-gray">
                                      {j.authorName || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${statusClass}`}
                                      >
                                        {status === 'approved'
                                          ? 'Publié'
                                          : status === 'rejected'
                                            ? 'Rejeté'
                                            : 'En attente'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="inline-flex items-center gap-2">
                                        {status !== 'approved' && (
                                          <button
                                            type="button"
                                            onClick={() => handleApproveJob(j.id)}
                                            className="text-[9px] font-black uppercase tracking-widest text-aaj-cyan hover:underline"
                                          >
                                            Publier
                                          </button>
                                        )}
                                        {status !== 'rejected' && (
                                          <button
                                            type="button"
                                            onClick={() => handleRejectJob(j.id)}
                                            className="text-[9px] font-black uppercase tracking-widest text-aaj-amber hover:underline"
                                          >
                                            Rejeter
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteJob(j.id)}
                                          className="text-[9px] font-black uppercase tracking-widest text-aaj-magenta hover:underline"
                                        >
                                          Supprimer
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </motion.div>
                )}

                {activeTab === 'admin-profile-requests' && can('profileRequests_manage') && (
                  <motion.div
                    key="admin-profile-requests"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <h2 className="text-2xl font-black uppercase tracking-tighter">
                      Validations des Modifications de Profil
                    </h2>

                    <div className="space-y-6">
                      {profileRequests.filter((r) => r.status === 'pending').length === 0 ? (
                        <div className="p-12 border border-dashed border-aaj-border rounded text-center bg-slate-50/50">
                          <CheckCircle2 size={48} className="mx-auto text-aaj-cyan/40 mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest text-aaj-gray">
                            Toutes les demandes ont été traitées
                          </p>
                        </div>
                      ) : (
                        profileRequests
                          .filter((r) => r.status === 'pending')
                          .map((request) => (
                            <div
                              key={request.id}
                              className="border border-aaj-border rounded bg-white overflow-hidden shadow-sm"
                            >
                              <div className="p-6 bg-slate-50 border-b border-aaj-border flex justify-between items-center">
                                <div>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-aaj-royal bg-white px-2 py-1 border border-aaj-royal/20 rounded mb-2 inline-block">
                                    Demande ID: {request.id.slice(0, 8)}
                                  </span>
                                  <h3 className="text-lg font-black uppercase tracking-tight">
                                    {request.displayName}
                                  </h3>
                                  <p className="text-[10px] font-bold text-aaj-gray uppercase tracking-widest">
                                    {request.userEmail}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-aaj-gray uppercase tracking-widest">
                                    Soumis le
                                  </p>
                                  <p className="text-xs font-bold">
                                    {request.createdAt?.toDate?.()?.toLocaleDateString() ||
                                      'récemment'}
                                  </p>
                                </div>
                              </div>
                              <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                <div>
                                  <label className="text-[9px] font-black uppercase tracking-widest text-aaj-gray block mb-1">
                                    Prénom & Nom
                                  </label>
                                  <p className="text-sm font-bold uppercase">
                                    {request.firstName} {request.lastName}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-[9px] font-black uppercase tracking-widest text-aaj-gray block mb-1">
                                    Mobile
                                  </label>
                                  <p className="text-sm font-bold">{request.mobile || '-'}</p>
                                </div>
                                <div>
                                  <label className="text-[9px] font-black uppercase tracking-widest text-aaj-gray block mb-1">
                                    Catégorie
                                  </label>
                                  <p className="text-sm font-bold uppercase">{request.category}</p>
                                </div>
                                <div>
                                  <label className="text-[9px] font-black uppercase tracking-widest text-aaj-gray block mb-1">
                                    Matricule
                                  </label>
                                  <p className="text-sm font-bold uppercase">
                                    {request.licenseNumber || '-'}
                                  </p>
                                </div>
                                <div className="md:col-span-2">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-aaj-gray block mb-1">
                                    Adresse
                                  </label>
                                  <p className="text-sm font-bold uppercase">
                                    {request.address || '-'}
                                  </p>
                                </div>
                              </div>
                              <div className="p-6 bg-slate-50 border-t border-aaj-border flex justify-end gap-4">
                                <button
                                  onClick={() => handleRejectProfileChange(request.id)}
                                  className="px-6 py-2 border border-aaj-magenta/30 text-aaj-magenta rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-magenta/10 transition-colors"
                                >
                                  Rejeter
                                </button>
                                <button
                                  onClick={() => handleApproveProfileChange(request)}
                                  className="px-6 py-2 bg-aaj-cyan text-aaj-night text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-white transition-colors shadow-lg shadow-aaj-cyan/20"
                                >
                                  Approuver & Appliquer
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'admin-news' && can('news_manage') && (
                  <motion.div
                    key="admin-news"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <h2 className="text-2xl font-black uppercase tracking-tighter">
                      Actions & Informations Internes
                    </h2>
                    <form
                      onSubmit={handleAddNews}
                      className="max-w-2xl bg-white p-10 border border-aaj-border rounded space-y-8 shadow-sm"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Titre de l&apos;annonce
                        </label>
                        <input
                          type="text"
                          required
                          value={newNews.title}
                          onChange={(e) => setNewNews({ ...newNews, title: e.target.value })}
                          placeholder="Ex: Réunion extraordinaire..."
                          className="w-full bg-slate-50 border border-aaj-border rounded px-4 py-3 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Catégorie
                        </label>
                        <select
                          value={newNews.category}
                          onChange={(e) => setNewNews({ ...newNews, category: e.target.value })}
                          className="w-full bg-slate-50 border border-aaj-border rounded px-4 py-3 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none transition-all"
                        >
                          <option value="">— Aucune catégorie —</option>
                          {newsCategoriesList.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Message (Détails)
                        </label>
                        <textarea
                          rows={6}
                          required
                          value={newNews.content}
                          onChange={(e) => setNewNews({ ...newNews, content: e.target.value })}
                          className="w-full bg-slate-50 border border-aaj-border rounded px-4 py-3 text-xs font-bold leading-relaxed resize-none focus:ring-1 focus:ring-aaj-royal outline-none transition-all"
                        ></textarea>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Document Joint (Optionnel)
                        </label>
                        <div className="flex gap-4">
                          <input
                            type="file"
                            ref={newsFileInputRef}
                            onChange={handleNewsFileChange}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => newsFileInputRef.current?.click()}
                            disabled={newsUploading}
                            className="flex-1 bg-slate-50 border border-dashed border-aaj-border hover:border-aaj-royal hover:bg-white px-5 py-3.5 rounded text-left flex items-center justify-between group transition-all disabled:opacity-60"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-widest text-aaj-gray group-hover:text-aaj-royal truncate">
                              {newsUploading
                                ? 'Envoi en cours...'
                                : newNews.fileName || 'Uploader une image, un PDF...'}
                            </span>
                            {newsUploading ? (
                              <Loader2 size={14} className="animate-spin text-aaj-gray shrink-0" />
                            ) : (
                              <Upload
                                size={14}
                                className="text-aaj-gray group-hover:text-aaj-royal shrink-0"
                              />
                            )}
                          </button>
                          {newNews.fileUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setNewNews({
                                  ...newNews,
                                  fileUrl: '',
                                  fileName: '',
                                  fileMimeType: '',
                                })
                              }
                              className="bg-aaj-magenta/10 text-aaj-magenta px-4 rounded hover:bg-aaj-magenta/15 transition-colors"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSaving || newsUploading}
                        className="w-full bg-aaj-dark text-white px-12 py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {isSaving ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                        Diffuser le message
                      </button>
                    </form>

                    <div className="pt-12 border-t border-aaj-border">
                      <h3 className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-8 flex items-center gap-4">
                        Dernières Diffusions <span className="h-px flex-1 bg-aaj-border"></span>
                      </h3>
                      <div className="space-y-4">
                        {newsItems.map((item, idx) => {
                          const catStyle = item.category
                            ? newsCategoryStyle(item.category)
                            : null;
                          return (
                            <div
                              key={idx}
                              className="p-6 border border-aaj-border rounded bg-white flex justify-between items-center gap-4 group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {catStyle && item.category && (
                                    <span
                                      className="inline-flex items-center text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                                      style={{
                                        backgroundColor: catStyle.bg,
                                        color: catStyle.text,
                                      }}
                                    >
                                      {item.category}
                                    </span>
                                  )}
                                  <p className="text-[11px] font-black uppercase tracking-widest truncate">
                                    {item.title}
                                  </p>
                                </div>
                                <p className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">
                                  {item.createdAt?.toDate?.()?.toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                {(item.fileUrl || item.fileBase64) && (
                                  <FileText size={16} className="text-aaj-gray" />
                                )}
                                <button
                                  onClick={async () => {
                                    if (window.confirm('Supprimer cette annonce ?')) {
                                      await deleteDoc(doc(db, 'news', item.id));
                                    }
                                  }}
                                  className="text-aaj-gray hover:text-aaj-magenta transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
                {activeTab === 'admin-page-home' && can('config_manage') && (
                  <Suspense fallback={<TabLoader />}>
                    <HomePageEditor />
                  </Suspense>
                )}
                {activeTab === 'admin-page-about' && can('config_manage') && (
                  <Suspense fallback={<TabLoader />}>
                    <AboutPageEditor />
                  </Suspense>
                )}
                {activeTab === 'admin-page-partners' && can('config_manage') && (
                  <Suspense fallback={<TabLoader />}>
                    <PartnersPageEditor />
                  </Suspense>
                )}
                {activeTab === 'member-partners' && can('partners_view') && (
                  <motion.div
                    key="member-partners"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-12"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-end gap-8">
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">
                          Nos Partenaires Privilégiés
                        </h2>
                        <p className="text-sm text-aaj-gray font-bold uppercase tracking-widest max-w-2xl leading-relaxed">
                          Découvrez les partenaires qui soutiennent l&apos;AAJ et bénéficiez
                          d&apos;offres exclusives réservées aux adhérents.
                        </p>
                      </div>
                      <div className="flex border border-aaj-border rounded overflow-hidden shadow-sm">
                        <button
                          onClick={() => setPartnersViewMode('grid')}
                          className={`p-3 transition-colors ${partnersViewMode === 'grid' ? 'bg-aaj-dark text-white' : 'bg-white text-aaj-gray hover:bg-slate-50'}`}
                        >
                          <Grid size={16} />
                        </button>
                        <button
                          onClick={() => setPartnersViewMode('list')}
                          className={`p-3 transition-colors ${partnersViewMode === 'list' ? 'bg-aaj-dark text-white' : 'bg-white text-aaj-gray hover:bg-slate-50'}`}
                        >
                          <List size={16} />
                        </button>
                      </div>
                    </div>

                    {partnersViewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {partnersList
                          .filter((p) => p.isVisible)
                          .map((partner) => (
                            <div
                              key={partner.id}
                              className="p-8 border border-aaj-border rounded bg-white hover:border-aaj-royal transition-all group flex flex-col items-center text-center shadow-sm"
                            >
                              <div
                                className={`text-[9px] font-black uppercase tracking-[2px] px-3 py-1 rounded border mb-6 ${
                                  partner.level === 'Platine'
                                    ? 'bg-aaj-amber/10 text-aaj-amber border-aaj-amber/30'
                                    : partner.level === 'Or'
                                      ? 'bg-aaj-amber/10 text-aaj-amber border-aaj-amber/30'
                                      : 'bg-slate-50 text-slate-700 border-slate-100'
                                }`}
                              >
                                Partenaire {partner.level}
                              </div>
                              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-aaj-border group-hover:border-aaj-royal transition-colors">
                                <Building2
                                  size={32}
                                  className="text-aaj-gray group-hover:text-aaj-royal"
                                />
                              </div>
                              <h3 className="text-xl font-black uppercase tracking-tight text-aaj-dark mb-2">
                                {partner.name}
                              </h3>
                              <p className="text-[10px] font-bold text-aaj-gray uppercase tracking-widest mb-6">
                                Actif depuis : {partner.joined}
                              </p>
                              <button className="w-full py-3 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest text-aaj-dark hover:bg-aaj-dark hover:text-white transition-all">
                                Consulter l&apos;offre
                              </button>
                            </div>
                          ))}
                        {partnersList.filter((p) => p.isVisible).length === 0 && (
                          <div className="col-span-full py-20 text-center border border-dashed border-aaj-border rounded opacity-50 bg-slate-50/30">
                            <p className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                              Aucun partenaire disponible pour le moment
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {partnersList
                          .filter((p) => p.isVisible)
                          .map((partner) => (
                            <div
                              key={partner.id}
                              className="p-6 border border-aaj-border rounded bg-white hover:border-aaj-royal transition-all flex justify-between items-center group shadow-sm"
                            >
                              <div className="flex items-center gap-6">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center border border-aaj-border group-hover:border-aaj-royal transition-colors">
                                  <Building2
                                    size={18}
                                    className="text-aaj-gray group-hover:text-aaj-royal"
                                  />
                                </div>
                                <div>
                                  <h3 className="text-sm font-black uppercase tracking-tight text-aaj-dark">
                                    {partner.name}
                                  </h3>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">
                                      Partenaire {partner.level}
                                    </span>
                                    <span className="text-[8px] text-aaj-border">•</span>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-aaj-gray">
                                      Actif depuis {partner.joined}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button className="px-6 py-3 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest text-aaj-dark hover:bg-aaj-dark hover:text-white transition-all">
                                Détails
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'unesco' && can('unesco_view') && (
                  <motion.div
                    key="unesco"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <Suspense fallback={<TabLoader />}>
                      <UnescoMemberView canSubmit={can('unesco_permits_submit') || isAdmin} />
                    </Suspense>
                  </motion.div>
                )}

                {activeTab === 'admin-unesco' && can('unesco_manage') && (
                  <motion.div
                    key="admin-unesco"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <Suspense fallback={<TabLoader />}>
                      <UnescoAdminParams />
                    </Suspense>
                  </motion.div>
                )}

                {activeTab === 'admin-unesco-requests' &&
                  (can('unesco_requests_manage') || can('unesco_permits_review')) && (
                    <motion.div
                      key="admin-unesco-requests"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                    >
                      <Suspense fallback={<TabLoader />}>
                        <UnescoAdminRequests />
                      </Suspense>
                    </motion.div>
                  )}
              </AnimatePresence>
            </main>
          </div>
        </div>

        {/* Photo Cropper Modal — recadrage / zoom avant upload */}
        <AnimatePresence>
          <PhotoCropperModal
            file={pendingCropFile}
            onCancel={() => setPendingCropFile(null)}
            onConfirm={handleCroppedPhotoConfirm}
          />
        </AnimatePresence>

        {/* Profile Change Request Modal */}
        <AnimatePresence>
          {isRequestModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsRequestModalOpen(false)}
                className="absolute inset-0 bg-aaj-dark/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white rounded shadow-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-aaj-border flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">
                      Demande de Modification
                    </h3>
                    <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest mt-1">
                      Vos modifications seront soumises à approbation
                    </p>
                  </div>
                  <button
                    onClick={() => setIsRequestModalOpen(false)}
                    className="text-aaj-gray hover:text-aaj-dark transition-colors"
                  >
                    <XCircle size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmitProfileChange}>
                  <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Prénom
                        </label>
                        <input
                          type="text"
                          value={profileForm.firstName}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, firstName: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Nom
                        </label>
                        <input
                          type="text"
                          value={profileForm.lastName}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, lastName: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Mobile / WhatsApp
                        </label>
                        <input
                          type="tel"
                          value={profileForm.mobile}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, mobile: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Email de contact
                        </label>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, email: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Catégorie
                        </label>
                        <select
                          value={profileForm.category}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, category: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                        >
                          <option value="Architecte">Architecte</option>
                          <option value="Architecte Stagiaire">Architecte Stagiaire</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          {profileForm.category === 'Architecte'
                            ? 'Matricule AAJ'
                            : 'Matricule Étudiant'}
                        </label>
                        <input
                          type="text"
                          value={profileForm.licenseNumber}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, licenseNumber: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                        Adresse professionnelle
                      </label>
                      <textarea
                        rows={2}
                        value={profileForm.address}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, address: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal resize-none"
                      ></textarea>
                    </div>
                  </div>

                  <div className="p-8 bg-slate-50 border-t border-aaj-border flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => setIsRequestModalOpen(false)}
                      className="px-8 py-3 rounded text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-aaj-dark text-white px-8 py-3 rounded text-[11px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center gap-3 shadow-lg shadow-aaj-dark/20"
                    >
                      {isSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      Soumettre la demande
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Edit Member Modal */}
        <AnimatePresence>
          {editingMember && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingMember(null)}
                className="absolute inset-0 bg-aaj-dark/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-8 border-b border-aaj-border flex justify-between items-center bg-slate-50">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-black uppercase tracking-tight">
                        Fiche Adhérent
                      </h3>
                      {editingMember.status === 'archived' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-widest border border-slate-300">
                          <Trash2 size={10} /> Archivé
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest mt-1">
                      Édition de : {editingMember.firstName} {editingMember.lastName}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingMember(null)}
                    className="text-aaj-gray hover:text-aaj-dark transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
                  {/* Informations personnelles */}
                  <section className="space-y-4">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-aaj-dark border-b border-aaj-border pb-2">
                      Informations personnelles
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Prénom
                        </label>
                        <input
                          type="text"
                          value={editingMember.firstName || ''}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, firstName: e.target.value })
                          }
                          className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Nom
                        </label>
                        <input
                          type="text"
                          value={editingMember.lastName || ''}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, lastName: e.target.value })
                          }
                          className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={editingMember.email || ''}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, email: e.target.value })
                          }
                          className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Téléphone
                        </label>
                        <input
                          type="tel"
                          value={editingMember.mobile || ''}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, mobile: e.target.value })
                          }
                          className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Catégorie
                        </label>
                        <select
                          value={editingMember.category || 'Architecte'}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, category: e.target.value })
                          }
                          className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold uppercase tracking-widest"
                        >
                          <option value="Architecte">Architecte</option>
                          <option value="Architecte Stagiaire">Architecte Stagiaire</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Matricule
                        </label>
                        <input
                          type="text"
                          value={editingMember.licenseNumber || ''}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, licenseNumber: e.target.value })
                          }
                          className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Ville / Adresse
                        </label>
                        <input
                          type="text"
                          value={editingMember.address || ''}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, address: e.target.value })
                          }
                          className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Rôle & Statut */}
                  <section className="space-y-4">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-aaj-dark border-b border-aaj-border pb-2">
                      Rôle & Statut
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Rôle
                        </label>
                        <select
                          value={editingMember.role || 'member'}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, role: e.target.value })
                          }
                          className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold uppercase tracking-widest"
                        >
                          <option value="member">Membre Standard</option>
                          <option value="representative">Représentant Association</option>
                          <option value="admin">Administrateur (Bureau)</option>
                          <option value="super-admin">Super Admin</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Statut
                        </label>
                        <select
                          value={editingMember.status || 'active'}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, status: e.target.value })
                          }
                          className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold uppercase tracking-widest"
                        >
                          <option value="active">Actif</option>
                          <option value="suspended">Suspendu</option>
                          <option value="pending">En attente</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Cotisations */}
                  <section className="space-y-4">
                    <div className="flex justify-between items-center border-b border-aaj-border pb-2">
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-aaj-dark">
                        Cotisations annuelles
                      </h4>
                      <span className="text-[9px] text-aaj-gray font-bold uppercase tracking-widest">
                        Année en cours : {currentYearLabel}
                      </span>
                    </div>

                    <div className="border border-aaj-border rounded overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-aaj-border">
                          <tr>
                            <th className="p-3 w-10 text-[9px] font-black uppercase tracking-widest text-aaj-gray">
                              <input
                                type="checkbox"
                                checked={
                                  editSelectedYears.length > 0 &&
                                  editSelectedYears.length ===
                                    getCotisationYears(editingMember).length
                                }
                                onChange={(e) => {
                                  if (e.target.checked)
                                    setEditSelectedYears(getCotisationYears(editingMember));
                                  else setEditSelectedYears([]);
                                }}
                              />
                            </th>
                            <th className="p-3 text-[9px] font-black uppercase tracking-widest text-aaj-gray">
                              Année
                            </th>
                            <th className="p-3 text-[9px] font-black uppercase tracking-widest text-aaj-gray">
                              Statut
                            </th>
                            <th className="p-3 text-[9px] font-black uppercase tracking-widest text-aaj-gray">
                              Montant (TND)
                            </th>
                            <th className="p-3 text-[9px] font-black uppercase tracking-widest text-aaj-gray">
                              Date de paiement
                            </th>
                            <th className="p-3 text-[9px] font-black uppercase tracking-widest text-aaj-gray text-right">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-aaj-border">
                          {getCotisationYears(editingMember).map((year) => {
                            const entry = editingMember.cotisations?.[year];
                            const isPaid = !!entry?.paid;
                            const isCurrent = year === currentYearLabel;
                            const isFuture = Number(year) > Number(currentYearLabel);
                            const paidAtStr = entry?.paidAt
                              ? typeof entry.paidAt === 'string'
                                ? new Date(entry.paidAt).toLocaleDateString('fr-FR')
                                : entry.paidAt?.toDate?.()?.toLocaleDateString('fr-FR') || '-'
                              : '-';
                            return (
                              <tr key={year} className={isCurrent ? 'bg-aaj-electric/10/30' : ''}>
                                <td className="p-3">
                                  <input
                                    type="checkbox"
                                    checked={editSelectedYears.includes(year)}
                                    onChange={() => toggleYearSelection(year)}
                                  />
                                </td>
                                <td className="p-3">
                                  <span className="text-xs font-black text-aaj-dark">{year}</span>
                                  {isFuture && (
                                    <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-aaj-royal">
                                      Avance
                                    </span>
                                  )}
                                </td>
                                <td className="p-3">
                                  {isPaid ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aaj-cyan/10 text-aaj-cyan text-[9px] font-black uppercase tracking-widest border border-aaj-cyan/30">
                                      <CheckCircle2 size={9} /> Payée
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aaj-amber/10 text-aaj-amber text-[9px] font-black uppercase tracking-widest border border-aaj-amber/30">
                                      <XCircle size={9} /> Non payée
                                    </span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={entry?.amount ?? ''}
                                    onChange={(e) => updateCotisationAmount(year, e.target.value)}
                                    placeholder="—"
                                    className="w-24 bg-slate-50/50 border border-aaj-border rounded px-2 py-1 text-xs font-bold"
                                  />
                                </td>
                                <td className="p-3 text-xs font-bold text-aaj-gray">{paidAtStr}</td>
                                <td className="p-3 text-right">
                                  <button
                                    onClick={() => toggleCotisationYear(year)}
                                    className={`text-[10px] font-black uppercase tracking-widest hover:underline px-2 ${isPaid ? 'text-aaj-magenta' : 'text-aaj-cyan'}`}
                                  >
                                    {isPaid ? 'Annuler' : 'Valider'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-50 border border-aaj-border rounded p-4 flex flex-wrap items-end gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                          Montant par année (optionnel)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editBulkAmount}
                          onChange={(e) => setEditBulkAmount(e.target.value)}
                          placeholder="Ex: 150"
                          className="w-32 bg-white border border-aaj-border rounded px-3 py-2 text-xs font-bold"
                        />
                      </div>
                      <button
                        onClick={payMultipleYears}
                        disabled={editSelectedYears.length === 0}
                        className="bg-aaj-dark text-white px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <CheckCircle2 size={12} />
                        Payer{' '}
                        {editSelectedYears.length > 0
                          ? `${editSelectedYears.length} année(s)`
                          : 'les années cochées'}
                      </button>
                      <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest flex-1 min-w-[12rem]">
                        Cochez plusieurs années (y compris futures) pour les valider d&apos;un coup
                        — paiement en avance pris en charge.
                      </p>
                    </div>
                  </section>
                </div>

                <div className="p-8 bg-slate-50 border-t border-aaj-border flex gap-4">
                  <button
                    onClick={handleSaveMember}
                    disabled={isSaving}
                    className="flex-1 bg-aaj-dark text-white py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center justify-center gap-3 disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{' '}
                    Enregistrer la fiche
                  </button>
                  {editingMember?.status === 'archived' ? (
                    <>
                      <button
                        onClick={() => handleRestoreMember(editingMember)}
                        disabled={isSaving}
                        className="px-6 border border-aaj-cyan/30 text-aaj-cyan rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-cyan/10 transition-all flex items-center gap-2 disabled:opacity-60"
                      >
                        <CheckCircle2 size={14} /> Restaurer
                      </button>
                      <button
                        onClick={() => handleDeleteMember(editingMember)}
                        disabled={isSaving}
                        className="px-6 border border-aaj-magenta/30 text-aaj-magenta rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-magenta/10 transition-all flex items-center gap-2 disabled:opacity-60"
                        title="Supprimer définitivement — irréversible"
                      >
                        <Trash2 size={14} /> Supprimer
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleArchiveMember(editingMember)}
                      disabled={isSaving}
                      className="px-6 border border-slate-200 text-slate-700 rounded font-black uppercase tracking-widest text-[11px] hover:bg-slate-100 transition-all flex items-center gap-2 disabled:opacity-60"
                      title="Archiver — conserve toutes les données"
                    >
                      <Trash2 size={14} /> Archiver
                    </button>
                  )}
                  <button
                    onClick={() => setEditingMember(null)}
                    className="px-8 border border-aaj-border rounded font-black uppercase tracking-widest text-[11px] text-aaj-gray hover:bg-white transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Modal: News Details */}
          {selectedNews && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedNews(null)}
                className="absolute inset-0 bg-aaj-dark/95 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-transparent w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
              >
                <button
                  onClick={() => setSelectedNews(null)}
                  className="self-end mb-3 p-2 bg-white/10 text-white hover:bg-white/20 transition-colors rounded-full"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
                <div className="overflow-y-auto custom-scrollbar">
                  <NewsPostCard item={selectedNews} />
                </div>
              </motion.div>
            </div>
          )}

          {/* Modal: Job Detail */}
          {jobDetail && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setJobDetail(null)}
                className="absolute inset-0 bg-aaj-dark/90 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded"
              >
                <div className="p-8 border-b border-aaj-border bg-slate-50 flex justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[2px] px-2.5 py-1 rounded border ${
                          jobDetail.kind === 'offer'
                            ? 'bg-aaj-soft text-aaj-royal border-aaj-royal/20'
                            : 'bg-aaj-cyan/10 text-aaj-cyan border-aaj-cyan/30'
                        }`}
                      >
                        {jobDetail.kind === 'offer' ? 'Offre' : 'Demande'}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray border border-aaj-border px-2.5 py-1 rounded">
                        {jobDetail.contractType || '—'}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-aaj-dark">
                      {jobDetail.title}
                    </h3>
                    <p className="text-[10px] font-bold text-aaj-gray uppercase tracking-widest mt-2">
                      {jobDetail.city}
                      {jobDetail.createdAt?.toDate?.()
                        ? ` · Publié le ${jobDetail.createdAt.toDate().toLocaleDateString('fr-FR')}`
                        : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setJobDetail(null)}
                    className="p-2 hover:bg-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-royal mb-3">
                      Description
                    </h4>
                    <p className="text-sm text-aaj-dark font-medium leading-relaxed whitespace-pre-wrap">
                      {jobDetail.description}
                    </p>
                  </div>
                  <div className="border-t border-aaj-border pt-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-royal mb-3">
                      Contact
                    </h4>
                    <div className="space-y-2 text-sm">
                      {jobDetail.company && (
                        <div className="flex items-center gap-3">
                          <Building2 size={14} className="text-aaj-royal" />
                          <span className="font-bold uppercase tracking-tight">
                            {jobDetail.company}
                          </span>
                        </div>
                      )}
                      {jobDetail.authorName && (
                        <div className="flex items-center gap-3">
                          <UserCircle size={14} className="text-aaj-royal" />
                          <span className="font-bold uppercase tracking-tight">
                            {jobDetail.authorName}
                            {jobDetail.authorRole ? ` · ${jobDetail.authorRole}` : ''}
                          </span>
                        </div>
                      )}
                      {jobDetail.authorEmail && (
                        <div className="flex items-center gap-3">
                          <Mail size={14} className="text-aaj-royal" />
                          <a
                            href={`mailto:${jobDetail.authorEmail}`}
                            className="font-bold text-aaj-royal hover:underline"
                          >
                            {jobDetail.authorEmail}
                          </a>
                        </div>
                      )}
                      {jobDetail.authorPhone && (
                        <div className="flex items-center gap-3">
                          <Phone size={14} className="text-aaj-royal" />
                          <a
                            href={`tel:${jobDetail.authorPhone}`}
                            className="font-bold text-aaj-royal hover:underline"
                          >
                            {jobDetail.authorPhone}
                          </a>
                        </div>
                      )}
                      {jobDetail.cvFileId && (
                        <div className="flex items-center gap-3">
                          <FileText size={14} className="text-aaj-royal" />
                          <a
                            href={`/api/files/${encodeURIComponent(jobDetail.cvFileId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-aaj-royal hover:underline"
                          >
                            {jobDetail.cvFileName || 'CV / Portfolio'}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-6 border-t border-aaj-border bg-slate-50 flex justify-end">
                  <button
                    onClick={() => setJobDetail(null)}
                    className="px-8 py-3 border border-aaj-border rounded font-black uppercase tracking-widest text-[11px] text-aaj-dark hover:bg-white transition-all shadow-sm"
                  >
                    Fermer
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Modal: Contact Admin */}
          {isContactModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsContactModalOpen(false)}
                className="absolute inset-0 bg-aaj-dark/90 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="relative bg-white w-full max-w-lg shadow-2xl rounded overflow-hidden"
              >
                <div className="p-8 border-b border-aaj-border bg-slate-50">
                  <h3 className="text-xl font-black uppercase tracking-tighter text-aaj-dark">
                    Contacter l&apos;administration
                  </h3>
                  <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest mt-1">
                    L&apos;équipe bureau de l&apos;AAJ vous répondra par email.
                  </p>
                </div>
                <form onSubmit={handleContactAdmin} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                      Objet du message
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Demande d'information sur ma cotisation"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                      className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                      votre message
                    </label>
                    <textarea
                      required
                      placeholder="Écrivez votre message ici..."
                      rows={6}
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold resize-none"
                    ></textarea>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                      Document joint (Optionnel)
                    </label>
                    <div
                      onClick={() => contactFileInputRef.current?.click()}
                      className="border border-dashed border-aaj-border p-4 rounded bg-slate-50 flex items-center justify-center gap-3 cursor-pointer hover:bg-slate-100 transition-all group"
                    >
                      <input
                        type="file"
                        ref={contactFileInputRef}
                        className="hidden"
                        accept=".pdf,image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const base64 = await fileToBase64(file);
                            setNewContactFile({ base64, name: file.name });
                          }
                        }}
                      />
                      <Upload size={14} className="text-aaj-gray group-hover:text-aaj-royal" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                        {newContactFile.name || 'Joindre un document (PDF / Image)'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 bg-aaj-dark text-white py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}{' '}
                      Envoyer le message
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsContactModalOpen(false)}
                      className="px-8 border border-aaj-border rounded font-black uppercase tracking-widest text-[11px] text-aaj-gray hover:bg-slate-50 transition-all font-bold"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {/* Modal: Add Member Admin */}
          {isAddMemberModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddMemberModalOpen(false)}
                className="absolute inset-0 bg-aaj-dark/95 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white w-full max-w-2xl max-h-[90vh] shadow-2xl rounded overflow-hidden flex flex-col"
              >
                <div className="p-8 border-b border-aaj-border bg-slate-50 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-aaj-dark">
                      Ajouter un nouveau membre
                    </h3>
                    <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest mt-1">
                      Saisie manuelle d&apos;un adhérent par l&apos;administration.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddMemberModalOpen(false)}
                    className="text-aaj-gray hover:text-aaj-dark"
                  >
                    <X size={24} />
                  </button>
                </div>
                <form
                  onSubmit={handleAddMember}
                  className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar"
                >
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                        Prénom
                      </label>
                      <input
                        type="text"
                        required
                        value={newMember.firstName}
                        onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })}
                        className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                        Nom
                      </label>
                      <input
                        type="text"
                        required
                        value={newMember.lastName}
                        onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })}
                        className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={newMember.email}
                        onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                        className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                        Téléphone
                      </label>
                      <input
                        type="tel"
                        required
                        value={newMember.phone}
                        onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                        className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                        Date de naissance
                      </label>
                      <input
                        type="date"
                        required
                        value={newMember.birthDate}
                        onChange={(e) => setNewMember({ ...newMember, birthDate: e.target.value })}
                        className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                        Type de membre
                      </label>
                      <select
                        value={newMember.memberTypeLetter}
                        onChange={(e) => {
                          const letter = e.target.value;
                          const t = memberTypesList.find((x) => x.letter === letter);
                          setNewMember({
                            ...newMember,
                            memberTypeLetter: letter,
                            category: t?.label || newMember.category,
                          });
                        }}
                        required
                        className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold uppercase tracking-widest"
                      >
                        {memberTypesList.map((t) => (
                          <option key={t.letter} value={t.letter}>
                            {t.label} ({t.letter})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                        Matricule AAJ
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={newMember.matricule}
                        placeholder="Généré automatiquement"
                        className="w-full bg-slate-100 border border-aaj-border rounded px-4 py-3 text-xs font-bold text-aaj-royal tracking-widest cursor-not-allowed"
                      />
                      <p className="text-[9px] text-aaj-gray font-bold uppercase tracking-wider ml-1">
                        AAJ + mois + année (2 chiffres) + indice + lettre
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">
                        Ville
                      </label>
                      <SearchableSelect
                        value={newMember.city}
                        onChange={(v) => setNewMember({ ...newMember, city: v })}
                        options={villesList}
                        placeholder="Sélectionner une délégation"
                        required
                      />
                    </div>
                  </div>

                  <div className="bg-aaj-amber/10 border border-aaj-amber/30 p-6 rounded flex items-start gap-4">
                    <Shield size={20} className="text-aaj-amber mt-1 flex-shrink-0" />
                    <p className="text-[10px] text-aaj-amber font-bold uppercase tracking-tight leading-relaxed">
                      En ajoutant un membre manuellement, vous certifiez que ses documents ont été
                      vérifiés par le bureau national. Il recevra un accès immédiat avec le rôle
                      Adhérent.
                    </p>
                  </div>
                </form>
                <div className="p-8 bg-slate-50 border-t border-aaj-border flex gap-4">
                  <button
                    onClick={handleAddMember}
                    disabled={isSaving}
                    className="flex-1 bg-aaj-dark text-white py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center justify-center gap-3"
                  >
                    {isSaving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}{' '}
                    Créer le compte Adhérent
                  </button>
                  <button
                    onClick={() => setIsAddMemberModalOpen(false)}
                    className="px-8 border border-aaj-border rounded font-black uppercase tracking-widest text-[11px] text-aaj-gray hover:bg-white transition-all font-bold"
                  >
                    Annuler
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Modal: Add Role */}
          {isAddRoleModalOpen && can('roles_manage') && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddRoleModalOpen(false)}
                className="absolute inset-0 bg-aaj-dark/95 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white w-full max-w-lg shadow-2xl rounded overflow-hidden"
              >
                <div className="p-8 border-b border-aaj-border bg-slate-50 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-aaj-dark">
                      Nouveau rôle
                    </h3>
                    <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest mt-1">
                      Les permissions sont vides par défaut. Cochez-les ensuite dans la matrice.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddRoleModalOpen(false)}
                    className="text-aaj-gray hover:text-aaj-dark"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="p-8 space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray block mb-2">
                      Nom du rôle *
                    </label>
                    <input
                      type="text"
                      value={newRoleForm.name}
                      onChange={(e) => setNewRoleForm({ ...newRoleForm, name: e.target.value })}
                      placeholder="Ex. Éditeur Bibliothèque"
                      className="w-full px-4 py-3 border border-aaj-border rounded text-sm focus:border-aaj-royal focus:outline-none"
                    />
                    {newRoleForm.name.trim() && (
                      <p className="text-[10px] text-aaj-gray font-mono mt-2">
                        ID généré :{' '}
                        <span className="font-bold">{sanitizeRoleId(newRoleForm.name)}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray block mb-2">
                      Description
                    </label>
                    <textarea
                      value={newRoleForm.description}
                      onChange={(e) =>
                        setNewRoleForm({ ...newRoleForm, description: e.target.value })
                      }
                      rows={3}
                      placeholder="À quoi sert ce rôle ?"
                      className="w-full px-4 py-3 border border-aaj-border rounded text-sm focus:border-aaj-royal focus:outline-none resize-none"
                    />
                  </div>
                </div>
                <div className="p-8 bg-slate-50 border-t border-aaj-border flex gap-3">
                  <button
                    onClick={handleCreateRole}
                    disabled={isSaving || !newRoleForm.name.trim()}
                    className="flex-1 bg-aaj-dark text-white py-3 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Création...' : 'Créer le rôle'}
                  </button>
                  <button
                    onClick={() => setIsAddRoleModalOpen(false)}
                    className="px-6 border border-aaj-border rounded font-black uppercase tracking-widest text-[11px] text-aaj-gray hover:bg-white transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Credentials modal — shown after admin creates/approves a member account */}
        <AnimatePresence>
          {createdCredentials && (
            <div
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => {
                setCreatedCredentials(null);
                setCredentialsCopied(null);
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-white max-w-lg w-full p-8 border border-aaj-border rounded"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      {createdCredentials.emailSent ? (
                        <CheckCircle2 size={22} className="text-aaj-cyan" />
                      ) : (
                        <XCircle size={22} className="text-aaj-magenta" />
                      )}
                      <h3 className="text-xl font-black uppercase tracking-tight text-aaj-dark">
                        {createdCredentials.mode === 'approved'
                          ? 'Demande validée'
                          : 'Membre ajouté'}
                      </h3>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-aaj-gray">
                      {createdCredentials.emailSent
                        ? "Un email a été envoyé au membre (vérifier les spams)"
                        : "L'email n'a pas pu partir — transmettez ces identifiants manuellement"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCreatedCredentials(null);
                      setCredentialsCopied(null);
                    }}
                    className="text-aaj-gray hover:text-aaj-dark transition-colors"
                    aria-label="Fermer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[2px] text-aaj-gray mb-1">
                      Matricule
                    </div>
                    <div className="font-mono text-sm bg-slate-50 border border-aaj-border rounded px-3 py-2 select-all">
                      {createdCredentials.matricule}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[2px] text-aaj-gray mb-1">
                      Email
                    </div>
                    <div className="font-mono text-sm bg-slate-50 border border-aaj-border rounded px-3 py-2 select-all break-all">
                      {createdCredentials.email}
                    </div>
                  </div>
                  {createdCredentials.tempPassword && (
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[2px] text-aaj-gray mb-1">
                        Mot de passe temporaire
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 font-mono text-sm bg-aaj-amber/10 border border-aaj-amber/40 rounded px-3 py-2 select-all">
                          {createdCredentials.tempPassword}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                createdCredentials.tempPassword ?? ''
                              );
                              setCredentialsCopied('pwd');
                              setTimeout(() => setCredentialsCopied(null), 2000);
                            } catch {
                              /* clipboard blocked */
                            }
                          }}
                          className="px-3 rounded border border-aaj-border text-[10px] font-black uppercase tracking-widest text-aaj-dark hover:bg-slate-50 transition-all"
                        >
                          {credentialsCopied === 'pwd' ? 'Copié !' : 'Copier'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      const lines = [
                        `Matricule : ${createdCredentials.matricule}`,
                        `Email : ${createdCredentials.email}`,
                      ];
                      if (createdCredentials.tempPassword) {
                        lines.push(
                          `Mot de passe temporaire : ${createdCredentials.tempPassword}`
                        );
                      }
                      try {
                        await navigator.clipboard.writeText(lines.join('\n'));
                        setCredentialsCopied('all');
                        setTimeout(() => setCredentialsCopied(null), 2000);
                      } catch {
                        /* clipboard blocked */
                      }
                    }}
                    className="flex-1 bg-aaj-dark text-white py-3 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all"
                  >
                    {credentialsCopied === 'all' ? 'Copié !' : 'Copier tout'}
                  </button>
                  <button
                    onClick={() => {
                      setCreatedCredentials(null);
                      setCredentialsCopied(null);
                    }}
                    className="px-6 border border-aaj-border rounded font-black uppercase tracking-widest text-[11px] text-aaj-gray hover:bg-slate-50 transition-all"
                  >
                    Fermer
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Edit Document modal — pre-filled with the existing row, lets the
            admin tweak any field and optionally swap the underlying file.
            Mirrors the "Ajouter" form one-to-one to keep both flows visually
            consistent. */}
        <AnimatePresence>
          {editingDoc && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingDoc(null)}
                className="absolute inset-0 bg-aaj-dark/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-8 border-b border-aaj-border flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-aaj-dark">
                      Modifier le document
                    </h3>
                    <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest mt-1 truncate max-w-md">
                      {editingDoc.name || '—'}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingDoc(null)}
                    className="text-aaj-gray hover:text-aaj-dark transition-colors"
                    aria-label="Fermer"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form
                  onSubmit={handleUpdateDocument}
                  className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                        Nom du Document
                      </label>
                      <input
                        type="text"
                        required
                        value={editingDoc.name}
                        onChange={(e) =>
                          setEditingDoc({ ...editingDoc, name: e.target.value })
                        }
                        className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal focus:border-aaj-royal outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                        Lien Document (Optionnel si fichier chargé)
                      </label>
                      <input
                        type="url"
                        value={editingDoc.url}
                        onChange={(e) =>
                          setEditingDoc({ ...editingDoc, url: e.target.value })
                        }
                        placeholder="https://..."
                        className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal focus:border-aaj-royal outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                        Catégorie Utilité
                      </label>
                      <select
                        value={editingDoc.category}
                        onChange={(e) =>
                          setEditingDoc({ ...editingDoc, category: e.target.value })
                        }
                        className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none appearance-none cursor-pointer"
                      >
                        <option value="Plan d'Aménagement">Plan d&apos;Aménagement</option>
                        <option value="Cadre Contractuel & Légal">
                          Cadre Contractuel & Légal
                        </option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                        Remplacer le fichier (Optionnel)
                      </label>
                      <div className="flex gap-4">
                        <input
                          type="file"
                          ref={editLibraryFileInputRef}
                          onChange={handleEditLibraryFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => editLibraryFileInputRef.current?.click()}
                          className="flex-1 bg-white border border-dashed border-aaj-border hover:border-aaj-royal hover:bg-white px-5 py-3.5 rounded text-left flex items-center justify-between group transition-all"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest text-aaj-gray group-hover:text-aaj-royal truncate">
                            {editingDoc.file
                              ? editingDoc.fileName
                              : editingDoc.fileName
                                ? `Conserver : ${editingDoc.fileName}`
                                : 'Choisir un nouveau fichier...'}
                          </span>
                          <Upload
                            size={14}
                            className="text-aaj-gray group-hover:text-aaj-royal shrink-0"
                          />
                        </button>
                        {editingDoc.file && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDoc({
                                ...editingDoc,
                                file: null,
                                fileName: '',
                              });
                              if (editLibraryFileInputRef.current) {
                                editLibraryFileInputRef.current.value = '';
                              }
                            }}
                            className="bg-aaj-magenta/10 text-aaj-magenta px-4 rounded hover:bg-aaj-magenta/15 transition-colors"
                            aria-label="Annuler le remplacement"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                      {editingDoc.existingFileId && !editingDoc.file && (
                        <p className="text-[9px] font-bold uppercase tracking-widest text-aaj-gray ml-1">
                          Laissez vide pour conserver le fichier actuel.
                        </p>
                      )}
                    </div>
                  </div>

                  {editingDoc.category === "Plan d'Aménagement" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-200">
                      <div className="space-y-3">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Commune
                        </label>
                        <select
                          value={editingDoc.commune}
                          onChange={(e) =>
                            setEditingDoc({ ...editingDoc, commune: e.target.value })
                          }
                          className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none"
                        >
                          <option value="Houmt Souk">Houmt Souk</option>
                          <option value="Midoun">Midoun</option>
                          <option value="Ajim">Ajim</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Arrondissement (Optionnel)
                        </label>
                        <input
                          type="text"
                          value={editingDoc.arrondissement}
                          onChange={(e) =>
                            setEditingDoc({
                              ...editingDoc,
                              arrondissement: e.target.value,
                            })
                          }
                          placeholder="Ex: Cedghiane, Erriadh..."
                          className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none"
                        />
                      </div>
                      <div className="space-y-3 md:col-span-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1 flex items-center gap-2">
                          <Calendar size={11} className="text-aaj-royal" />
                          Date d&apos;approbation du PAU (Optionnel)
                        </label>
                        <input
                          type="date"
                          value={editingDoc.approvalDate}
                          onChange={(e) =>
                            setEditingDoc({
                              ...editingDoc,
                              approvalDate: e.target.value,
                            })
                          }
                          className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-slate-200">
                      <div className="space-y-3 max-w-md">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          Type de Document
                        </label>
                        <select
                          value={editingDoc.legalType}
                          onChange={(e) =>
                            setEditingDoc({ ...editingDoc, legalType: e.target.value })
                          }
                          className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none appearance-none cursor-pointer"
                        >
                          <option value="Contrat">Contrat</option>
                          <option value="Texte & Loi">Texte & Loi</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setEditingDoc(null)}
                      className="px-8 border border-aaj-border rounded font-black uppercase tracking-widest text-[11px] text-aaj-gray hover:bg-slate-50 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-aaj-dark text-white px-12 py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-night hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] transition-all flex items-center gap-3 shadow-lg shadow-aaj-dark/20 disabled:bg-aaj-gray"
                    >
                      {isSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      Enregistrer
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Floating chat widget — sole bottom-right FAB. The "Contacter
            l'administration" entry now lives in the sidebar to avoid stacking
            two near-identical messaging icons. Lazy-loaded : pas de fallback
            visible (le widget est en bas-droite, son apparition différée
            d'~50ms est invisible). */}
        <Suspense fallback={null}>
          <ChatFloatingWidget />
        </Suspense>

        {/* Overlay sidebar — portaled to <body> so `position: fixed`
            anchors to the viewport regardless of any transform / filter /
            backdrop-filter on an ancestor inside the normal page flow. */}
        {!sidebarPinned &&
          typeof document !== 'undefined' &&
          createPortal(
            <>
              {/* Invisible hover strip on the viewport's left edge. Opens
                  the sidebar as soon as the pointer brushes it, giving
                  auto-hide mode a "push to show" feel without having to
                  aim for the Menu button. Rendered only while the sidebar
                  is closed so it can't swallow clicks meant for the
                  backdrop. */}
              {!sidebarOpen && (
                <div
                  onMouseEnter={() => setSidebarOpen(true)}
                  aria-hidden="true"
                  className="fixed top-0 left-0 bottom-0 w-3 z-[9997]"
                />
              )}
              <div
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
                className={`fixed inset-0 z-[9998] bg-black/50 transition-opacity duration-200 ${
                  sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
              <aside
                className={`fixed top-0 left-0 z-[9999] h-screen w-80 max-w-[85vw] bg-white shadow-2xl overflow-y-auto p-6 transition-transform duration-200 ${
                  sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                aria-hidden={!sidebarOpen}
              >
                {sidebarContent}
              </aside>
            </>,
            document.body
          )}
        {previewState && (
          <FilePreview
            files={previewState.files}
            initialIndex={previewState.index}
            onClose={() => setPreviewState(null)}
          />
        )}
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="aaj-dark-surface relative min-h-screen flex items-center justify-center px-4 pt-24 pb-20 overflow-hidden">
        <ParticleField className="z-0" density={70} />

        <div
          aria-hidden="true"
          className="absolute inset-0 aaj-hero-vignette pointer-events-none z-[1]"
        />

        <Reveal direction="up" duration={0.8} className="relative z-[2] w-full max-w-md">
          <div className="aaj-glass-strong rounded-3xl p-10 md:p-12 backdrop-blur-2xl">
            <Reveal direction="up" delay={0.1} className="text-center mb-10">
              <div className="inline-flex items-center justify-center gap-3 mb-6">
                <span className="w-8 h-px bg-aaj-cyan" aria-hidden="true" />
                <span className="text-[10px] uppercase tracking-[5px] text-aaj-cyan font-black">
                  {isResetMode ? 'Réinitialisation' : 'Connexion'}
                </span>
                <span className="w-8 h-px bg-aaj-cyan" aria-hidden="true" />
              </div>
              <div className="relative w-20 h-20 mx-auto mb-8">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(0,229,255,0.4) 0%, transparent 60%)',
                    filter: 'blur(20px)',
                  }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="absolute inset-0 rounded-full border border-aaj-cyan/40 flex items-center justify-center text-aaj-cyan bg-aaj-cyan/5 backdrop-blur-md">
                  <UserCircle size={36} />
                </div>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tighter leading-[0.95] mb-4">
                <GradientReveal
                  as="span"
                  text={isResetMode ? 'Réinitialisation' : 'Espace Adhérents'}
                  className="inline-block aaj-text-gradient-vibrant"
                />
              </h1>
              <p className="text-white/60 text-[11px] font-bold uppercase tracking-[3px]">
                {isResetMode ? 'Saisissez votre email' : 'Veuillez vous identifier'}
              </p>
            </Reveal>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-xl border border-aaj-magenta/30 bg-aaj-magenta/10 text-aaj-magenta text-[11px] font-bold uppercase tracking-wider flex items-center gap-3"
              >
                <Shield size={16} className="shrink-0" />
                {error}
              </motion.div>
            )}

            {resetSent && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-xl border border-aaj-cyan/30 bg-aaj-cyan/10 text-aaj-cyan text-[11px] font-bold uppercase tracking-wider flex items-center gap-3"
              >
                <CheckCircle2 size={16} className="shrink-0" />
                Email de réinitialisation envoyé ! Vérifiez votre boîte de réception.
              </motion.div>
            )}

            <form
              className="space-y-5"
              onSubmit={
                isResetMode
                  ? (e) => {
                      e.preventDefault();
                      handleForgotPassword();
                    }
                  : handleLogin
              }
            >
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-[2.5px] text-white/50 ml-1">
                  Email professionnel
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-aaj-night/60 border border-white/15 text-white rounded-xl px-5 py-4 focus:outline-none focus:border-aaj-cyan focus:bg-aaj-night transition-all text-sm font-medium placeholder:text-white/30"
                  placeholder="architecte@aaj.tn"
                  required
                />
              </div>
              {!isResetMode && (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-[2.5px] text-white/50 ml-1">
                    Mot de passe
                  </label>
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-aaj-night/60 border border-white/15 text-white rounded-xl px-5 py-4 focus:outline-none focus:border-aaj-cyan focus:bg-aaj-night transition-all text-sm font-medium placeholder:text-white/30"
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleToggleResetMode}
                  className="text-[10px] text-white/60 hover:text-aaj-cyan font-black uppercase tracking-[2.5px] transition-colors aaj-link-underline"
                >
                  {isResetMode ? 'Retour à la connexion' : 'Mot de passe oublié ?'}
                </button>
              </div>
              <MagneticButton as="div" strength={0.2} className="w-full">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-aaj-cyan text-aaj-night py-4 rounded-full font-black uppercase tracking-[3px] text-[11px] hover:bg-white transition-colors active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(0,229,255,0.35)]"
                >
                  {authLoading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : isResetMode ? (
                    'Réinitialiser mon mot de passe'
                  ) : (
                    'Se connecter'
                  )}
                </button>
              </MagneticButton>
            </form>

            <div className="mt-10 pt-8 border-t border-white/10 text-center">
              <p className="text-white/50 text-[11px] font-medium leading-relaxed uppercase tracking-wider">
                Accès réservé aux membres de l&apos;AAJ.
                <br />
                <Link
                  to="/demander-adhesion"
                  className="text-aaj-cyan font-black hover:text-white transition-colors mt-2 inline-block aaj-link-underline"
                >
                  Demander une adhésion
                </Link>
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </PageTransition>
  );
};
