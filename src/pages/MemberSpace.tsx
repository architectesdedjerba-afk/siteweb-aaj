/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useRef, Fragment } from 'react';
import { Link } from 'react-router-dom';
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
import type { Role } from '../types';
import {
  PERMISSION_GROUPS,
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLES,
  sanitizeRoleId,
} from '../lib/permissions';
import {
  DEFAULT_MEMBER_TYPES,
  DEFAULT_VILLES,
  MEMBER_TYPES_DOC_PATH,
  VILLES_DOC_PATH,
  buildMatricule,
  computeNextIndex,
  saveMemberTypes,
  saveVilles,
  type MemberType,
} from '../lib/memberConfig';
import { SearchableSelect } from '../components/SearchableSelect';
import { ChatPage } from '../components/chat/ChatPage';
import { ChannelApprovals } from '../components/chat/ChannelApprovals';
import { useChatBadge } from '../lib/useChat';

export const MemberSpacePage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSaving, setIsSaving] = useState(false);
  const [annuaireViewMode, setAnnuaireViewMode] = useState<'grid' | 'list'>('grid');
  const [fabBottom, setFabBottom] = useState(100);
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
  const [profileRequests, setProfileRequests] = useState<any[]>([]);
  const [membershipApplications, setMembershipApplications] = useState<any[]>([]);
  const [approvingApplicationId, setApprovingApplicationId] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [pendingUserRequests, setPendingUserRequests] = useState<any[]>([]);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [commissionPVs, setCommissionPVs] = useState<any[]>([]);
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
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [userMessages, setUserMessages] = useState<any[]>([]);
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
  const [memberTypesList, setMemberTypesList] = useState<MemberType[]>(DEFAULT_MEMBER_TYPES);
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

  const can = (key: string): boolean => {
    if (isSuperAdmin) return true;
    return userRole?.permissions?.[key] === true;
  };

  const chatModerator = isAdmin || userRole?.permissions?.chat_manage === true;
  const { totalUnread: chatUnread, pendingApproval: chatPendingApprovals } = useChatBadge(
    user?.uid ?? null,
    chatModerator
  );

  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const libraryFileInputRef = useRef<HTMLInputElement>(null);
  const newsFileInputRef = useRef<HTMLInputElement>(null);
  const pvFileInputRef = useRef<HTMLInputElement>(null);

  const [newNews, setNewNews] = useState({ title: '', content: '', fileBase64: '', fileName: '' });
  const [newPV, setNewPV] = useState({
    town: 'Houmt Souk',
    date: '',
    count: '0',
    fileBase64: '',
    fileName: '',
  });

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
      unsubscribeNews();
      unsubscribePVs();
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
    }
  }, [userProfile]);

  useEffect(() => {
    const handleScroll = () => {
      const footer = document.querySelector('footer');
      if (footer) {
        const footerRect = footer.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        if (footerRect.top < viewportHeight) {
          const overlap = viewportHeight - footerRect.top;
          setFabBottom(overlap + 85);
        } else {
          setFabBottom(100);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const handleUpdatePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];

    if (file.size > 2 * 1024 * 1024) {
      alert("L'image est trop lourde (max 2Mo).");
      return;
    }

    try {
      setIsSaving(true);
      const base64 = await fileToBase64(file);
      await setDoc(
        doc(db, 'users', user.uid),
        {
          photoURL: base64,
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

  const [newDoc, setNewDoc] = useState({
    name: '',
    url: '',
    category: "Plan d'Aménagement",
    commune: 'Houmt Souk',
    arrondissement: '',
    legalType: 'Contrat',
    fileType: 'pdf',
    fileBase64: '',
    fileName: '',
  });

  const handleLibraryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];

    // Check file size (limit to 1MB for Base64 in Firestore)
    if (file.size > 1024 * 1024) {
      alert('Le fichier est trop lourd (max 1Mo).');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setNewDoc({
        ...newDoc,
        fileBase64: base64,
        fileName: file.name,
        fileType: file.name.split('.').pop() || 'pdf',
      });
    } catch (err) {
      console.error('Error converting file:', err);
      alert('Erreur lors de la lecture du fichier.');
    }
  };

  const handleAddDocument = async (e: FormEvent) => {
    e.preventDefault();
    if (!can('library_manage')) return;

    if (!newDoc.url && !newDoc.fileBase64) {
      alert('Veuillez fournir un lien ou uploader un document.');
      return;
    }

    setIsSaving(true);
    try {
      const docData: any = {
        name: newDoc.name,
        category: newDoc.category,
        fileType: newDoc.fileType,
        createdAt: serverTimestamp(),
      };

      if (newDoc.url) docData.url = newDoc.url;
      if (newDoc.fileBase64) {
        docData.fileBase64 = newDoc.fileBase64;
        docData.fileName = newDoc.fileName;
        if (!docData.url) docData.url = newDoc.fileBase64;
      }

      if (newDoc.category === "Plan d'Aménagement") {
        docData.commune = newDoc.commune;
        docData.arrondissement = newDoc.arrondissement;
        docData.subCategory = `${newDoc.commune}${newDoc.arrondissement ? ' - ' + newDoc.arrondissement : ''}`;
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
        legalType: 'Contrat',
        fileType: 'pdf',
        fileBase64: '',
        fileName: '',
      });
      if (libraryFileInputRef.current) libraryFileInputRef.current.value = '';
      alert('Document ajouté avec succès !');
    } catch (err) {
      console.error('Error adding document:', err);
      alert("Erreur lors de l'ajout du document.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!can('library_manage')) return;
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      try {
        await deleteDoc(doc(db, 'documents', docId));
      } catch (err) {
        console.error('Error deleting document:', err);
        alert('Erreur lors de la suppression.');
      }
    }
  };

  const handleNewsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setNewNews({ ...newNews, fileBase64: base64, fileName: file.name });
      } catch (err) {
        console.error('Error converting file:', err);
      }
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
      });
      setNewNews({ title: '', content: '', fileBase64: '', fileName: '' });
      if (newsFileInputRef.current) newsFileInputRef.current.value = '';
      alert('Annonce publiée !');
    } catch (err) {
      console.error('Error adding news:', err);
      alert('Erreur lors de la diffusion.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPV = async (e: FormEvent) => {
    e.preventDefault();
    if (!can('commissions_create')) return;
    if (!newPV.fileBase64) {
      alert('Veuillez sélectionner un fichier PV.');
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'commission_pvs'), {
        ...newPV,
        createdAt: serverTimestamp(),
        fileType: 'pdf',
      });
      setNewPV({ town: 'Houmt Souk', date: '', count: '0', fileBase64: '', fileName: '' });
      alert('Avis publié avec succès !');
    } catch (err) {
      console.error('Error adding PV:', err);
      alert("Erreur lors de la publication de l'avis.");
    } finally {
      setIsSaving(false);
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
      const pwdLine = tempPassword ? `\nMot de passe temporaire : ${tempPassword}` : '';
      alert(
        emailSent
          ? `Membre ajouté avec succès !\nMatricule : ${matricule}\nEmail : ${newMember.email}${pwdLine}\n\nUn email avec ces identifiants a été envoyé (pensez à vérifier les spams).`
          : `Membre ajouté avec succès !\nMatricule : ${matricule}\nEmail : ${newMember.email}${pwdLine}\n\nATTENTION : l'email de bienvenue n'a pas pu être envoyé — transmettez manuellement les identifiants ci-dessus au nouvel adhérent.`
      );
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

  const handleApproveApplication = async (app: any) => {
    if (!can('members_manage')) return;
    if (!app.birthDate || !app.memberTypeLetter) {
      alert(
        'Cette demande ne contient pas la date de naissance ou le type de membre — impossible de générer le matricule AAJ. Demandez au candidat de soumettre une nouvelle demande.'
      );
      return;
    }
    if (
      !window.confirm(
        `Valider la demande de ${app.firstName || app.fullName} ${app.lastName || ''} ?\nUn compte adhérent sera créé et un email contenant le mot de passe temporaire lui sera envoyé.`
      )
    ) {
      return;
    }
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
      });

      await updateDoc(doc(db, 'membership_applications', app.id), {
        status: 'approved',
        licenseNumber: matricule,
      });

      const pwdLine = tempPassword ? `\nMot de passe temporaire : ${tempPassword}` : '';
      alert(
        emailSent
          ? `Demande validée !\nMatricule : ${matricule}\nEmail : ${app.email}${pwdLine}\n\nUn email avec ces identifiants a été envoyé (pensez à vérifier les spams).`
          : `Demande validée !\nMatricule : ${matricule}\nEmail : ${app.email}${pwdLine}\n\nATTENTION : l'email de bienvenue n'a pas pu être envoyé — transmettez manuellement les identifiants ci-dessus à l'adhérent.`
      );
    } catch (err) {
      console.error('Error approving application:', err);
      alert('Erreur lors de la validation de la demande.');
    } finally {
      setApprovingApplicationId(null);
    }
  };

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
    try {
      await updateDoc(doc(db, 'roles', role.id), {
        [`permissions.${permKey}`]: value,
      });
    } catch (err) {
      console.error('Error toggling permission:', err);
      alert('Erreur lors de la mise à jour de la permission.');
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
                  <div className="p-4 bg-red-50 text-red-600 rounded border border-red-100 text-[11px] font-bold uppercase tracking-wider flex items-center gap-3">
                    <XCircle size={16} />
                    {forcePwdError}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
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
                  <input
                    type="password"
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
                  className="w-full bg-aaj-dark text-white py-4 rounded font-black uppercase tracking-[3px] text-xs hover:bg-aaj-royal transition-all active:scale-[0.98] flex items-center justify-center gap-3"
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
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Header Dashboard */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 pb-8 border-b border-aaj-border">
            <div>
              <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">
                Espace Privé
              </span>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">
                Bienvenue, <br /> {userProfile?.displayName || 'Cher Confrère'}
              </h1>
            </div>
            <div className="mt-8 md:mt-0 flex items-center gap-6">
              <div className="text-right">
                <span className="block text-[10px] uppercase font-black tracking-widest text-aaj-gray">
                  Statut Adhérent
                </span>
                <span className="text-sm font-bold text-aaj-royal uppercase tracking-widest">
                  {userProfile?.role === 'admin'
                    ? 'Administrateur'
                    : userProfile?.role === 'representative'
                      ? 'Représentant'
                      : 'Membre Actif 2026'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-12 h-12 border border-aaj-border flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors rounded"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Sidebar Navigation */}
            <aside className="lg:col-span-3">
              <nav className="space-y-1">
                {[
                  {
                    id: 'dashboard',
                    icon: <LayoutDashboard size={18} />,
                    label: "Vue d'ensemble",
                    badge: 0,
                  },
                  {
                    id: 'commissions',
                    icon: <Building2 size={18} />,
                    label: 'Avis Commissions',
                    badge: 0,
                  },
                  {
                    id: 'bibliotheque',
                    icon: <BookOpen size={18} />,
                    label: 'Bibliothèque',
                    badge: 0,
                  },
                  {
                    id: 'documents',
                    icon: <MessageSquare size={18} />,
                    label: 'Messages Admins',
                    badge: 0,
                  },
                  {
                    id: 'chat',
                    icon: <MessagesSquare size={18} />,
                    label: 'Discussions',
                    badge: chatUnread,
                  },
                  {
                    id: 'member-partners',
                    icon: <Shield size={18} />,
                    label: 'Nos Partenaires',
                    badge: 0,
                  },
                  {
                    id: 'annuaire',
                    icon: <Users size={18} />,
                    label: 'Annuaire des Membres',
                    badge: 0,
                  },
                  { id: 'settings', icon: <Settings size={18} />, label: 'Mon Profil', badge: 0 },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-6 py-4 rounded text-[11px] font-black uppercase tracking-[2px] transition-all ${
                      activeTab === item.id
                        ? 'bg-aaj-dark text-white shadow-lg'
                        : 'text-aaj-gray hover:bg-slate-50 border border-transparent hover:border-aaj-border'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={activeTab === item.id ? 'text-aaj-royal' : ''}>
                        {item.icon}
                      </span>
                      {item.label}
                    </div>
                    {item.badge > 0 && (
                      <span className="min-w-5 h-5 px-1.5 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              {(() => {
                const adminItems = [
                  {
                    id: 'admin-roles',
                    icon: <KeyRound size={18} />,
                    label: 'Rôles & Permissions',
                    perm: 'roles_manage',
                  },
                  {
                    id: 'admin-config',
                    icon: <Settings size={18} />,
                    label: 'Paramètres',
                    perm: 'config_manage',
                  },
                  {
                    id: 'admin-members',
                    icon: <Users size={18} />,
                    label: 'Gérer Adhésions',
                    perm: 'members_manage',
                    badge: membershipApplications.filter(
                      (a: any) => (a.status || 'pending') === 'pending'
                    ).length,
                  },
                  {
                    id: 'admin-partners',
                    icon: <Shield size={18} />,
                    label: 'Gérer Partenaires',
                    perm: 'partners_manage',
                  },
                  {
                    id: 'admin-profile-requests',
                    icon: <CheckCircle2 size={18} />,
                    label: 'Validations Profils',
                    perm: 'profileRequests_manage',
                    badge: profileRequests.filter((r) => r.status === 'pending').length,
                  },
                  {
                    id: 'admin-documents',
                    icon: <BookOpen size={18} />,
                    label: 'Gérer Bibliothèque',
                    perm: 'library_manage',
                  },
                  {
                    id: 'admin-commissions',
                    icon: <Building2 size={18} />,
                    label: 'Dépôts des Avis',
                    perm: 'commissions_create',
                  },
                  {
                    id: 'admin-news',
                    icon: <FileText size={18} />,
                    label: 'Actions & Infos',
                    perm: 'news_manage',
                  },
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
                ].filter((item) => can(item.perm));

                if (adminItems.length === 0) return null;

                return (
                  <div className="mt-12 space-y-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-gray px-6 mb-4 mt-8 flex items-center gap-2">
                      <Shield size={12} className="text-aaj-royal" /> Administration
                    </h3>
                    {adminItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center justify-between px-6 py-4 rounded text-[11px] font-black uppercase tracking-[2px] transition-all ${
                          activeTab === item.id
                            ? 'bg-aaj-dark text-white shadow-lg'
                            : 'text-aaj-gray hover:bg-slate-50 border border-transparent hover:border-aaj-border'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className={activeTab === item.id ? 'text-aaj-royal' : ''}>
                            {item.icon}
                          </span>
                          {item.label}
                        </div>
                        {item.badge > 0 && (
                          <span className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </aside>

            {/* Main Dashboard Grid */}
            <main className="lg:col-span-9 space-y-12">
              <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && (
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
                          <div className="space-y-6">
                            {newsItems.slice(0, 2).map((item, idx) => (
                              <div
                                key={idx}
                                onClick={() => setSelectedNews(item)}
                                className="group cursor-pointer"
                              >
                                <div className="flex justify-between items-start">
                                  <span className="text-[9px] font-black text-aaj-gray uppercase tracking-widest">
                                    {item.createdAt?.toDate?.()?.toLocaleDateString('fr-FR', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    }) || 'Récemment'}
                                  </span>
                                  {item.fileBase64 && (
                                    <a
                                      href={item.fileBase64}
                                      download={item.fileName || 'Annonce_AAJ.pdf'}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[8px] font-black uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded text-aaj-gray hover:bg-aaj-royal hover:text-white transition-all flex items-center gap-1"
                                    >
                                      <Download size={8} /> Document
                                    </a>
                                  )}
                                </div>
                                <h4 className="text-lg font-black uppercase tracking-tighter group-hover:text-aaj-royal transition-colors">
                                  {item.title}
                                </h4>
                                <p className="text-xs text-aaj-gray mt-2 leading-relaxed font-medium line-clamp-2">
                                  {item.content}
                                </p>
                              </div>
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
                          <div className="inline-block px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-[2px] rounded border border-green-100 mx-auto">
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

                        return (
                          <div
                            key={town}
                            onClick={() => {
                              setSelectedCommune(town);
                              setActiveTab('commissions');
                            }}
                            className="p-6 border border-aaj-border rounded bg-white group hover:border-aaj-royal transition-all cursor-pointer"
                          >
                            <span className="text-[9px] font-black text-aaj-royal uppercase tracking-widest mb-2 block">
                              {town}
                            </span>
                            <div className="flex justify-between items-end">
                              <div>
                                <p className="text-2xl font-black uppercase tracking-tighter">
                                  {totalAvis} Avis
                                </p>
                                <p className="text-[10px] font-bold text-aaj-gray uppercase mt-1">
                                  {latestPV
                                    ? `Dernière : ${new Date(latestPV.date).toLocaleDateString()}`
                                    : 'Aucun avis'}
                                </p>
                              </div>
                              <div
                                className={`text-[9px] font-black px-2 py-1 uppercase rounded bg-green-50 text-green-600 group-hover:bg-aaj-royal group-hover:text-white transition-all`}
                              >
                                Consulter
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'annuaire' && (
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
                          {allUsers.length} Architectes
                        </div>
                      </div>
                    </div>

                    {annuaireViewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {allUsers
                          .filter((m) => m.status !== 'suspended')
                          .map((member) => (
                            <div
                              key={member.uid}
                              className="p-6 border border-aaj-border rounded bg-white hover:shadow-xl transition-shadow group"
                            >
                              <div className="flex gap-6">
                                <div className="w-16 h-16 bg-slate-50 border border-aaj-border rounded flex items-center justify-center text-aaj-royal group-hover:bg-aaj-royal group-hover:text-white transition-colors">
                                  <UserCircle size={32} />
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
                              .filter((m) => m.status !== 'suspended')
                              .map((member) => (
                                <tr
                                  key={member.uid}
                                  className="hover:bg-slate-50/50 transition-all group"
                                >
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-aaj-gray group-hover:text-aaj-royal transition-colors">
                                        <UserCircle size={18} />
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

                {activeTab === 'commissions' && (
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
                        {commissionPVs
                          .filter((pv) => pv.town === selectedCommune)
                          .map((pv, idx) => (
                            <div
                              key={idx}
                              className="p-6 border border-aaj-border rounded bg-white hover:border-aaj-royal group transition-all"
                            >
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                  <div className="flex items-center gap-3 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-aaj-royal">
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
                                  </div>
                                  <p className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">
                                    {pv.fileName || 'Procès-verbal de commission'}
                                  </p>
                                </div>
                                <a
                                  href={pv.fileBase64}
                                  download={
                                    pv.fileName || `PV_Commission_${selectedCommune}_${pv.date}.pdf`
                                  }
                                  className="bg-slate-100 text-aaj-dark px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal hover:text-white transition-all flex items-center gap-2 border border-transparent hover:border-aaj-royal"
                                >
                                  <Download size={14} /> Télécharger le PV
                                </a>
                              </div>
                            </div>
                          ))}
                        {commissionPVs.filter((pv) => pv.town === selectedCommune).length === 0 && (
                          <div className="p-12 border border-dashed border-aaj-border rounded text-center opacity-50">
                            <p className="text-xs font-black uppercase tracking-widest text-aaj-gray">
                              Aucun PV publié pour cette commune
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {['Houmt Souk', 'Midoun', 'Ajim'].map((town) => {
                          const townPVs = commissionPVs.filter((pv) => pv.town === town);
                          return (
                            <div
                              key={town}
                              className="p-8 border border-aaj-border rounded bg-white text-center flex flex-col justify-between hover:border-aaj-royal transition-all group"
                            >
                              <div>
                                <Building2 size={32} className="mx-auto text-aaj-royal mb-4" />
                                <h3 className="text-xl font-black uppercase tracking-tighter mb-2">
                                  {town}
                                </h3>
                                <p className="text-[10px] font-black text-aaj-gray uppercase tracking-widest mb-6">
                                  Total PVs : {townPVs.length}
                                </p>
                              </div>
                              <button
                                onClick={() => setSelectedCommune(town)}
                                className="w-full bg-aaj-dark text-white py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all group-hover:scale-[1.02]"
                              >
                                Consulter les PV
                              </button>
                            </div>
                          );
                        })}
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

                    <div className="space-y-6">
                      {newsItems.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedNews(item)}
                          className="p-8 border border-aaj-border rounded bg-white relative hover:border-aaj-royal transition-all group cursor-pointer"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <span className="text-[10px] font-black text-aaj-royal uppercase tracking-widest">
                              {item.createdAt?.toDate?.()?.toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                            {item.fileBase64 && (
                              <a
                                href={item.fileBase64}
                                download={item.fileName}
                                className="text-[10px] font-black uppercase tracking-widest text-aaj-royal flex items-center gap-2 hover:bg-aaj-royal hover:text-white px-3 py-1 rounded transition-all border border-aaj-royal"
                              >
                                <Download size={14} /> Télécharger la pièce jointe
                              </a>
                            )}
                          </div>
                          <h3 className="text-xl font-black uppercase tracking-tighter mb-4 group-hover:text-aaj-royal transition-colors">
                            {item.title}
                          </h3>
                          <div className="text-sm text-aaj-gray leading-relaxed font-medium whitespace-pre-wrap">
                            {item.content}
                          </div>
                        </div>
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

                {activeTab === 'bibliotheque' && (
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
                              .filter((d) => d.category === "Plan d'Aménagement")
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
                                  className="flex items-center justify-between p-4 border border-aaj-border rounded hover:bg-slate-50 transition-colors group"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-3">
                                      <MapPin size={12} className="text-aaj-royal" /> {doc.name}
                                    </span>
                                    {doc.subCategory && (
                                      <span className="text-[9px] text-aaj-gray font-black uppercase tracking-widest mt-1 ml-6">
                                        {doc.subCategory}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
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
                            {libraryDocs.filter((d) => d.category === "Plan d'Aménagement")
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
                              .filter((d) => d.category === 'Cadre Contractuel & Légal')
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
                                  className="flex items-center justify-between p-4 border border-aaj-border rounded hover:bg-slate-50 transition-colors group"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-3">
                                      {doc.fileType === 'xlsx' || doc.fileType === 'xls' ? (
                                        <FileSpreadsheet size={12} className="text-aaj-royal" />
                                      ) : (
                                        <FileText size={12} className="text-aaj-royal" />
                                      )}
                                      {doc.name}
                                    </span>
                                    {doc.subCategory && (
                                      <span className="text-[9px] text-aaj-gray font-black uppercase tracking-widest mt-1 ml-6">
                                        {doc.subCategory}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
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
                            {libraryDocs.filter((d) => d.category === 'Cadre Contractuel & Légal')
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
                              {newDoc.fileBase64 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setNewDoc({
                                      ...newDoc,
                                      fileBase64: '',
                                      fileName: '',
                                      fileType: 'pdf',
                                    })
                                  }
                                  className="bg-red-50 text-red-500 px-4 rounded hover:bg-red-100 transition-colors"
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
                            className="bg-aaj-dark text-white px-12 py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-royal transition-all flex items-center gap-3 shadow-lg shadow-aaj-dark/20 disabled:bg-aaj-gray"
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

                      <div className="grid grid-cols-1 gap-4">
                        {libraryDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-6 bg-white border border-aaj-border rounded hover:border-aaj-royal/30 transition-all"
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
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-aaj-royal bg-blue-50 px-2 py-0.5 rounded">
                                    {doc.category}
                                  </span>
                                  {doc.subCategory && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray">
                                      {doc.subCategory}
                                    </span>
                                  )}
                                  <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray/50">
                                    {doc.fileType.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-aaj-gray hover:text-aaj-royal transition-colors"
                              >
                                <Download size={18} />
                              </a>
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-2 text-aaj-gray hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'chat' && (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">
                        Discussions Internes
                      </h2>
                      <p className="text-[11px] text-aaj-gray font-bold uppercase tracking-[2px]">
                        Échangez en temps réel avec les autres adhérents — canal général & canaux
                        thématiques.
                      </p>
                    </div>
                    <ChatPage />
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
                    {user?.uid && <ChannelApprovals currentUid={user.uid} />}
                  </motion.div>
                )}

                {activeTab === 'documents' && (
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
                                  <span className="text-[9px] font-black text-green-600 bg-green-50 px-2.5 py-1 rounded border border-green-100 uppercase tracking-widest">
                                    Traité
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded border border-amber-100 uppercase tracking-widest">
                                    En attente
                                  </span>
                                )}
                              </div>
                            </div>
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
                        className="bg-aaj-dark text-white px-8 py-3 rounded text-[11px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center gap-3"
                      >
                        <Settings size={16} />
                        Demander une modification
                      </button>
                    </div>

                    {pendingUserRequests.some((r) => r.status === 'pending') && (
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Loader2 size={16} className="text-amber-600 animate-spin" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                            Une demande de modification est en cours d&apos;examen
                          </p>
                        </div>
                        <span className="text-[9px] font-bold text-amber-600 italic">
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
                            {userProfile?.photoURL ? (
                              <img
                                src={userProfile.photoURL}
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
                                ? 'Matricule Ordre'
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
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">
                        Gestion des Adhésions
                      </h2>
                      <button
                        onClick={() => setIsAddMemberModalOpen(true)}
                        className="bg-aaj-dark text-white px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center gap-2"
                      >
                        <Plus size={14} /> Ajouter un Membre
                      </button>
                    </div>

                    {/* Demandes d'adhésion en attente (/demander-adhesion) */}
                    {(() => {
                      const pendingApps = membershipApplications.filter(
                        (a: any) => (a.status || 'pending') === 'pending'
                      );
                      if (pendingApps.length === 0) return null;
                      return (
                        <div className="border border-amber-200 rounded overflow-hidden bg-amber-50/50">
                          <div className="bg-amber-100/60 px-5 py-3 border-b border-amber-200 flex items-center gap-3">
                            <Shield size={16} className="text-amber-700" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-800">
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
                                  <div className="flex gap-2 flex-shrink-0">
                                    <button
                                      onClick={() => handleApproveApplication(app)}
                                      disabled={approvingApplicationId === app.id}
                                      className="px-4 py-2 bg-green-600 text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      {approvingApplicationId === app.id ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <CheckCircle2 size={12} />
                                      )}
                                      Valider
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
                                      className="px-3 py-2 text-aaj-gray hover:text-red-600 transition-colors"
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

                    <div className="border border-aaj-border rounded overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-aaj-border">
                          <tr>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                              Architecte
                            </th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                              Statut
                            </th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                              Cotisation
                            </th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray text-right">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-aaj-border">
                          {allUsers.map((member) => {
                            const currentYearPaid = !!member.cotisations?.[currentYearLabel]?.paid;
                            return (
                              <tr
                                key={member.uid}
                                onClick={() => openMemberEditor(member)}
                                className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                              >
                                <td className="p-4">
                                  <p className="text-sm font-black uppercase tracking-tight">
                                    {member.displayName}
                                  </p>
                                  <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest">
                                    {member.email}
                                  </p>
                                </td>
                                <td className="p-4">
                                  {member.status === 'suspended' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[9px] font-black uppercase tracking-widest border border-red-100">
                                      <XCircle size={10} /> Suspendu
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[9px] font-black uppercase tracking-widest border border-green-100">
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
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[9px] font-black uppercase tracking-widest border border-green-100">
                                        <CheckCircle2 size={9} /> Payée
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest border border-amber-100">
                                        <XCircle size={9} /> Non payée
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => openMemberEditor(member)}
                                    className="text-[10px] font-black text-aaj-royal uppercase tracking-widest hover:underline px-3"
                                  >
                                    Éditer
                                  </button>
                                  <button
                                    onClick={() => handleToggleSuspense(member)}
                                    className={`text-[10px] font-black uppercase tracking-widest hover:underline px-3 ${member.status === 'suspended' ? 'text-green-600' : 'text-red-500'}`}
                                  >
                                    {member.status === 'suspended' ? 'Reprendre' : 'Suspendre'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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
                        className="bg-aaj-dark text-white px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center gap-2"
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
                                        className="text-red-500 hover:text-red-700 transition-colors"
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
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-sm font-black uppercase tracking-tight">
                                        {member.displayName || '—'}
                                      </p>
                                      {isSelf && (
                                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-aaj-royal text-[8px] font-black uppercase tracking-widest border border-blue-100">
                                          Vous
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest">
                                      {member.email}
                                    </p>
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
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                      >
                        {configMessage.text}
                      </div>
                    )}

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
                                className="bg-aaj-dark text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center justify-center gap-2"
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
                                  className="text-red-500 hover:text-red-700 transition-colors"
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
                          className="bg-aaj-dark text-white px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center justify-center gap-2"
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
                          className="bg-aaj-dark text-white px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center justify-center gap-2"
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
                              className="text-red-500 hover:text-red-700 transition-colors"
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
                      <button className="bg-aaj-dark text-white px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center gap-2">
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
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : partner.level === 'Or'
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
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
                            <button className="flex-1 text-[9px] font-black uppercase tracking-widest text-red-500 border border-red-500/20 py-2 rounded hover:bg-red-50 transition-all">
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
                          className={`p-8 border rounded transition-all ${msg.status === 'unread' ? 'bg-blue-50/30 border-aaj-royal/30' : 'bg-white border-aaj-border opacity-70'}`}
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
                                    className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${msg.replied ? 'bg-green-500' : 'bg-slate-200'}`}
                                  >
                                    <div
                                      className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${msg.replied ? 'left-6' : 'left-1'}`}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {msg.replied ? (
                                    <CheckCircle2 size={12} className="text-green-600" />
                                  ) : (
                                    <Loader2 size={12} className="text-amber-500" />
                                  )}
                                  <span
                                    className={`text-[9px] font-black uppercase tracking-widest ${msg.replied ? 'text-green-600' : 'text-amber-600'}`}
                                  >
                                    {msg.replied ? 'Déjà Répondu' : 'En attente de réponse'}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {msg.status === 'unread' && (
                                  <button
                                    onClick={() =>
                                      handleUpdateMessageStatus(msg.id, { status: 'read' })
                                    }
                                    className="w-full py-2 bg-aaj-dark text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all"
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
                          Fichier PV (PDF)
                        </label>
                        <div className="border border-aaj-border rounded bg-white p-8 text-center relative group overflow-hidden">
                          <input
                            type="file"
                            required
                            accept="application/pdf"
                            onChange={async (e) => {
                              if (e.target.files?.[0]) {
                                const file = e.target.files[0];
                                const base64 = await fileToBase64(file);
                                setNewPV({ ...newPV, fileBase64: base64, fileName: file.name });
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <Upload size={24} className="mx-auto text-aaj-royal mb-2" />
                          <p className="text-[10px] font-black uppercase tracking-widest group-hover:text-aaj-royal transition-colors">
                            {newPV.fileName || 'Sélectionner le document officiel'}
                          </p>
                        </div>
                      </div>

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
                          <CheckCircle2 size={48} className="mx-auto text-green-200 mb-4" />
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
                                  className="px-6 py-2 border border-red-200 text-red-500 rounded text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-colors"
                                >
                                  Rejeter
                                </button>
                                <button
                                  onClick={() => handleApproveProfileChange(request)}
                                  className="px-6 py-2 bg-green-600 text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition-colors shadow-lg shadow-green-100"
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
                            className="flex-1 bg-slate-50 border border-dashed border-aaj-border hover:border-aaj-royal hover:bg-white px-5 py-3.5 rounded text-left flex items-center justify-between group transition-all"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-widest text-aaj-gray group-hover:text-aaj-royal truncate">
                              {newNews.fileName || 'Uploader une image, un PDF...'}
                            </span>
                            <Upload
                              size={14}
                              className="text-aaj-gray group-hover:text-aaj-royal shrink-0"
                            />
                          </button>
                          {newNews.fileBase64 && (
                            <button
                              type="button"
                              onClick={() =>
                                setNewNews({ ...newNews, fileBase64: '', fileName: '' })
                              }
                              className="bg-red-50 text-red-500 px-4 rounded hover:bg-red-100 transition-colors"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full bg-aaj-dark text-white px-12 py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-royal transition-all flex items-center justify-center gap-2"
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
                        {newsItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-6 border border-aaj-border rounded bg-white flex justify-between items-center group"
                          >
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-widest">
                                {item.title}
                              </p>
                              <p className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">
                                {item.createdAt?.toDate?.()?.toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {item.fileBase64 && <FileText size={16} className="text-aaj-gray" />}
                              <button
                                onClick={async () => {
                                  if (window.confirm('Supprimer cette annonce ?')) {
                                    await deleteDoc(doc(db, 'news', item.id));
                                  }
                                }}
                                className="text-aaj-gray hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                {activeTab === 'member-partners' && (
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
                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : partner.level === 'Or'
                                      ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
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
              </AnimatePresence>
            </main>
          </div>
        </div>

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
                            ? 'Matricule Ordre'
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
                      className="bg-aaj-dark text-white px-8 py-3 rounded text-[11px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center gap-3 shadow-lg shadow-aaj-dark/20"
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
                    <h3 className="text-xl font-black uppercase tracking-tight">Fiche Adhérent</h3>
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
                              <tr key={year} className={isCurrent ? 'bg-blue-50/30' : ''}>
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
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[9px] font-black uppercase tracking-widest border border-green-100">
                                      <CheckCircle2 size={9} /> Payée
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest border border-amber-100">
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
                                    className={`text-[10px] font-black uppercase tracking-widest hover:underline px-2 ${isPaid ? 'text-red-500' : 'text-green-600'}`}
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
                        className="bg-aaj-dark text-white px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
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
                    className="flex-1 bg-aaj-dark text-white py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-royal transition-all flex items-center justify-center gap-3 disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{' '}
                    Enregistrer la fiche
                  </button>
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
                className="relative bg-white w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded"
              >
                <div className="p-8 border-b border-aaj-border flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-aaj-royal uppercase tracking-widest block mb-2">
                      Annonce Officielle
                    </span>
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-aaj-dark">
                      {selectedNews.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedNews(null)}
                    className="p-2 hover:bg-slate-50 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                  <div className="text-sm font-black text-aaj-gray uppercase tracking-widest mb-6 border-b border-aaj-border pb-4">
                    Publié le{' '}
                    {selectedNews.createdAt?.toDate?.()?.toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-sm text-aaj-dark leading-relaxed font-medium whitespace-pre-wrap mb-8">
                    {selectedNews.content}
                  </div>
                  {selectedNews.fileBase64 && (
                    <div className="bg-slate-50 p-6 border border-aaj-border rounded flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white border border-aaj-border rounded flex items-center justify-center text-aaj-royal">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-aaj-dark mb-0.5 line-clamp-1">
                            {selectedNews.fileName || 'Document Joint'}
                          </p>
                          <p className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">
                            Document PDF / Image
                          </p>
                        </div>
                      </div>
                      <a
                        href={selectedNews.fileBase64}
                        download={selectedNews.fileName}
                        className="bg-aaj-dark text-white px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all"
                      >
                        Télécharger
                      </a>
                    </div>
                  )}
                </div>
                <div className="p-8 border-t border-aaj-border bg-slate-50 flex justify-end">
                  <button
                    onClick={() => setSelectedNews(null)}
                    className="px-8 py-4 border border-aaj-border rounded font-black uppercase tracking-widest text-[11px] text-aaj-dark hover:bg-white transition-all shadow-sm"
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
                      className="flex-1 bg-aaj-dark text-white py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-royal transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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

                  <div className="bg-amber-50 border border-amber-100 p-6 rounded flex items-start gap-4">
                    <Shield size={20} className="text-amber-600 mt-1 flex-shrink-0" />
                    <p className="text-[10px] text-amber-800 font-bold uppercase tracking-tight leading-relaxed">
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
                    className="flex-1 bg-aaj-dark text-white py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-royal transition-all flex items-center justify-center gap-3"
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
                    className="flex-1 bg-aaj-dark text-white py-3 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-royal transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Floating Action Button: Contact Admin */}
        <button
          onClick={() => setIsContactModalOpen(true)}
          style={{ bottom: `${fabBottom}px` }}
          className="fixed right-6 md:right-8 w-14 h-14 bg-aaj-dark text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-aaj-royal hover:scale-110 active:scale-95 transition-all z-40 group border-4 border-white/20"
        >
          <MessageSquare size={24} className="group-hover:rotate-12 transition-all" />
          <div className="absolute right-full mr-4 bg-aaj-dark text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap shadow-xl">
            Contacter l&apos;administration
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-[90vh] flex items-center justify-center bg-white px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 lg:p-14 border border-aaj-border"
      >
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-aaj-soft rounded flex items-center justify-center text-aaj-royal mx-auto mb-6 border border-aaj-royal/10">
            <UserCircle size={40} />
          </div>
          <h1 className="text-3xl font-black mb-2 uppercase tracking-tight">
            {isResetMode ? 'Réinitialisation' : 'Espace Adhérents'}
          </h1>
          <p className="text-aaj-gray font-bold text-[10px] uppercase tracking-[3px]">
            {isResetMode ? 'Saisissez votre email' : 'Veuillez vous identifier'}
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 text-red-600 rounded border border-red-100 text-[11px] font-bold uppercase tracking-wider flex items-center gap-3">
            <Shield size={16} />
            {error}
          </div>
        )}

        {resetSent && (
          <div className="mb-8 p-4 bg-green-50 text-green-600 rounded border border-green-100 text-[11px] font-bold uppercase tracking-wider flex items-center gap-3">
            <CheckCircle2 size={16} />
            Email de réinitialisation envoyé ! Vérifiez votre boîte de réception.
          </div>
        )}

        <form
          className="space-y-6"
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
            <label className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1">
              Email professionnel
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-aaj-border rounded px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal focus:bg-white transition-all text-sm font-medium"
              placeholder="architecte@aaj.tn"
              required
            />
          </div>
          {!isResetMode && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-aaj-border rounded px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal focus:bg-white transition-all text-sm font-medium"
                placeholder="••••••••"
                required
              />
            </div>
          )}
          <div className="flex justify-end">
            {!isResetMode ? (
              <button
                type="button"
                onClick={handleToggleResetMode}
                className="text-[11px] text-aaj-royal font-black uppercase tracking-widest hover:underline"
              >
                Mot de passe oublié ?
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleResetMode}
                className="text-[11px] text-aaj-royal font-black uppercase tracking-widest hover:underline"
              >
                Retour à la connexion
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={authLoading}
            className="w-full bg-aaj-dark text-white py-5 rounded font-black uppercase tracking-[3px] text-xs hover:bg-aaj-royal transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {authLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : isResetMode ? (
              'Réinitialiser mon mot de passe'
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-aaj-border text-center">
          <p className="text-aaj-gray text-[11px] font-medium leading-relaxed uppercase tracking-wider">
            Accès réservé aux membres de l&apos;AAJ. <br />
            <Link to="/demander-adhesion" className="text-aaj-royal font-black hover:underline">
              Demander une adhésion
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
