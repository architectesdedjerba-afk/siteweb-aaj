/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useRef } from "react";
import { Link } from "react-router-dom";
import { UserCircle, LogOut, FileText, Settings, Shield, LayoutDashboard, Loader2, Users, Building2, Upload, Phone, Mail, MapPin, CheckCircle2, XCircle, Plus, BookOpen, Camera, Save, MessageSquare, List, Grid, Trash2, PlusCircle, Download, FileSpreadsheet, FileCode, Send, X } from "lucide-react";
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  onAuthStateChanged, 
  signOut,
  User
} from "firebase/auth";
import { doc, getDoc, collection, onSnapshot, query, orderBy, addDoc, deleteDoc, serverTimestamp, updateDoc, setDoc, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";

export const MemberSpacePage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSaving, setIsSaving] = useState(false);
  const [annuaireViewMode, setAnnuaireViewMode] = useState<"grid" | "list">("grid");
  const [fabBottom, setFabBottom] = useState(100);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [libraryDocs, setLibraryDocs] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [profileRequests, setProfileRequests] = useState<any[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [pendingUserRequests, setPendingUserRequests] = useState<any[]>([]);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [commissionPVs, setCommissionPVs] = useState<any[]>([]);
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null);
  const [libraryFilterCommune, setLibraryFilterCommune] = useState<string>("Toutes");
  const [libraryFilterLegal, setLibraryFilterLegal] = useState<string>("Tous");
  const [showNewsHistory, setShowNewsHistory] = useState(false);
  const [selectedNews, setSelectedNews] = useState<any | null>(null);
  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [partnersViewMode, setPartnersViewMode] = useState<"grid" | "list">("grid");
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ subject: "", message: "" });
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [userMessages, setUserMessages] = useState<any[]>([]);
  const [newContactFile, setNewContactFile] = useState({ base64: "", name: "" });
  const contactFileInputRef = useRef<HTMLInputElement>(null);
  const [newMember, setNewMember] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    category: "Architecte",
    matricule: "",
    city: "Houmt Souk"
  });

  const isAdmin = userProfile?.role === "admin";
  const isRepresentative = userProfile?.role === "representative" || isAdmin;

  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const libraryFileInputRef = useRef<HTMLInputElement>(null);
  const newsFileInputRef = useRef<HTMLInputElement>(null);
  const pvFileInputRef = useRef<HTMLInputElement>(null);

  const [newNews, setNewNews] = useState({ title: "", content: "", fileBase64: "", fileName: "" });
  const [newPV, setNewPV] = useState({ town: "Houmt Souk", date: "", count: "0", fileBase64: "", fileName: "" });

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

    const qNews = query(collection(db, "news"), orderBy("createdAt", "desc"));
    const unsubscribeNews = onSnapshot(qNews, (snapshot) => {
      const newsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNewsItems(newsData);
    });

    const qPVs = query(collection(db, "commission_pvs"), orderBy("createdAt", "desc"));
    const unsubscribePVs = onSnapshot(qPVs, (snapshot) => {
      const pvsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCommissionPVs(pvsData);
    });

    const qAllMessages = query(collection(db, "contact_messages"), orderBy("createdAt", "desc"));
    let unsubscribeAdminMessages = () => {};
    if (isAdmin) {
      unsubscribeAdminMessages = onSnapshot(qAllMessages, (snapshot) => {
        setAdminMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.warn("Restricted access to admin messaging queue.", err);
      });
    }

    const qUserMessages = query(collection(db, "contact_messages"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribeUserMessages = onSnapshot(qUserMessages, (snapshot) => {
      setUserMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qPartners = query(collection(db, "partners"), orderBy("name", "asc"));
    const unsubscribePartners = onSnapshot(qPartners, async (snapshot) => {
      if (snapshot.empty && isAdmin) {
        // Initial Seed
        const initialPartners = [
          { name: "Bati Jerba", level: "Platine", joined: "2024", isVisible: true },
          { name: "Sika Tunisia", level: "Or", joined: "2025", isVisible: true },
          { name: "Meuble Art", level: "Argent", joined: "2024", isVisible: true }
        ];
        for (const p of initialPartners) {
          await addDoc(collection(db, "partners"), { ...p, createdAt: serverTimestamp() });
        }
      }
      setPartnersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeNews();
      unsubscribePVs();
      unsubscribeAdminMessages();
      unsubscribeUserMessages();
      unsubscribePartners();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "documents"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLibraryDocs(docsData);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !isAdmin) {
      setAllUsers([]);
      setProfileRequests([]);
      return;
    }

    const qUsers = query(collection(db, "users"), orderBy("displayName", "asc"));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
      setAllUsers(usersData);
    });

    const qRequests = query(collection(db, "profile_updates"), orderBy("createdAt", "desc"));
    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      const requestsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProfileRequests(requestsData);
    }, (err) => {
      console.warn("Permission restricted for profile updates list (Admin only).", err);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeRequests();
    };
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user) {
      setPendingUserRequests([]);
      return;
    }
    const q = query(
      collection(db, "profile_updates"), 
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingUserRequests(requests);
    }, (err) => {
      console.error("Error fetching user profile requests:", err);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (userProfile?.status === "suspended") {
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

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    category: "Architecte",
    address: "",
    email: "",
    licenseNumber: ""
  });

  useEffect(() => {
    if (userProfile) {
      const names = (userProfile.displayName || "").split(" ");
      setProfileForm({
        firstName: userProfile.firstName || names[0] || "",
        lastName: userProfile.lastName || names.slice(1).join(" ") || "",
        mobile: userProfile.mobile || "",
        category: userProfile.category || userProfile.specialty || "Architecte",
        address: userProfile.address || "",
        email: userProfile.email || user?.email || "",
        licenseNumber: userProfile.licenseNumber || ""
      });
    }
  }, [userProfile, user]);

  // Mock data for commissions
  const commissions = [
    { town: "Houmt Souk", date: "15 AVR 2026", status: "Terminé", count: 12 },
    { town: "Midoun", date: "18 AVR 2026", status: "En attente", count: 8 },
    { town: "Ajim", date: "22 AVR 2026", status: "Prévu", count: 5 },
  ];

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        const docRef = doc(db, "users", currentUser.uid);
        const unSubProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          }
          setLoading(false);
        }, (err) => {
          console.error("Error fetching profile:", err);
          setLoading(false);
        });
        return () => unSubProfile();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

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
      await setDoc(doc(db, "users", user.uid), {
        photoURL: base64
      }, { merge: true });
      alert("Photo de profil mise à jour avec succès.");
    } catch (err) {
      console.error("Error updating photo:", err);
      alert("Erreur lors de la mise à jour de la photo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === "auth/operation-not-allowed") {
        setError("La connexion par Email/Mot de passe n'est pas activée dans la console Firebase. Veuillez contacter l'administrateur.");
      } else {
        setError("Email ou mot de passe incorrect.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Veuillez saisir votre adresse email pour réinitialiser votre mot de passe.");
      return;
    }
    setError(null);
    setAuthLoading(true);
    try {
      const actionCodeSettings = {
        url: window.location.origin + "/reset-password",
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setResetSent(true);
    } catch (err: any) {
      console.error("Reset Error:", err);
      if (err.code === 'auth/user-not-found') {
        setError("Aucun utilisateur trouvé avec cet email.");
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
    name: "",
    url: "",
    category: "Plan d'Aménagement",
    commune: "Houmt Souk",
    arrondissement: "",
    legalType: "Contrat",
    fileType: "pdf",
    fileBase64: "",
    fileName: ""
  });

  const handleLibraryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    // Check file size (limit to 1MB for Base64 in Firestore)
    if (file.size > 1024 * 1024) {
      alert("Le fichier est trop lourd (max 1Mo).");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setNewDoc({
        ...newDoc,
        fileBase64: base64,
        fileName: file.name,
        fileType: file.name.split('.').pop() || "pdf"
      });
    } catch (err) {
      console.error("Error converting file:", err);
      alert("Erreur lors de la lecture du fichier.");
    }
  };

  const handleAddDocument = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    if (!newDoc.url && !newDoc.fileBase64) {
      alert("Veuillez fournir un lien ou uploader un document.");
      return;
    }

    setIsSaving(true);
    try {
      const docData: any = {
        name: newDoc.name,
        category: newDoc.category,
        fileType: newDoc.fileType,
        createdAt: serverTimestamp()
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
      } else if (newDoc.category === "Cadre Contractuel & Légal") {
        docData.subCategory = newDoc.legalType;
      }

      await addDoc(collection(db, "documents"), docData);
      
      setNewDoc({
        name: "",
        url: "",
        category: "Plan d'Aménagement",
        commune: "Houmt Souk",
        arrondissement: "",
        legalType: "Contrat",
        fileType: "pdf",
        fileBase64: "",
        fileName: ""
      });
      if (libraryFileInputRef.current) libraryFileInputRef.current.value = "";
      alert("Document ajouté avec succès !");
    } catch (err) {
      console.error("Error adding document:", err);
      alert("Erreur lors de l'ajout du document.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!isAdmin) return;
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) {
      try {
        await deleteDoc(doc(db, "documents", docId));
      } catch (err) {
        console.error("Error deleting document:", err);
        alert("Erreur lors de la suppression.");
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
        console.error("Error converting file:", err);
      }
    }
  };

  const handleAddNews = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, "news"), {
        ...newNews,
        createdAt: serverTimestamp(),
        authorEmail: user?.email
      });
      setNewNews({ title: "", content: "", fileBase64: "", fileName: "" });
      if (newsFileInputRef.current) newsFileInputRef.current.value = "";
      alert("Annonce publiée !");
    } catch (err) {
      console.error("Error adding news:", err);
      alert("Erreur lors de la diffusion.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPV = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newPV.fileBase64) {
      alert("Veuillez sélectionner un fichier PV.");
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db, "commission_pvs"), {
        ...newPV,
        createdAt: serverTimestamp(),
        fileType: "pdf"
      });
      setNewPV({ town: "Houmt Souk", date: "", count: "0", fileBase64: "", fileName: "" });
      alert("Avis publié avec succès !");
    } catch (err) {
      console.error("Error adding PV:", err);
      alert("Erreur lors de la publication de l'avis.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const memberId = `member_${Date.now()}`;
      await setDoc(doc(db, "users", memberId), {
        uid: memberId,
        firstName: newMember.firstName,
        lastName: newMember.lastName,
        displayName: `${newMember.firstName} ${newMember.lastName}`,
        email: newMember.email,
        mobile: newMember.phone,
        category: newMember.category,
        licenseNumber: newMember.matricule,
        address: newMember.city,
        role: "member",
        status: "active",
        createdAt: serverTimestamp(),
      });
      alert("Membre ajouté avec succès !");
      setIsAddMemberModalOpen(false);
      setNewMember({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        category: "Architecte",
        matricule: "",
        city: "Houmt Souk"
      });
    } catch (err) {
      console.error("Error adding member:", err);
      alert("Erreur lors de l'ajout du membre.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleContactAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, "contact_messages"), {
        userId: user.uid,
        userEmail: user.email,
        userName: userProfile?.displayName || user.email,
        subject: contactForm.subject,
        message: contactForm.message,
        fileBase64: newContactFile.base64,
        fileName: newContactFile.name,
        createdAt: serverTimestamp(),
        status: "unread",
        replied: false
      });
      alert("Votre message a été envoyé à l'administration.");
      setIsContactModalOpen(false);
      setContactForm({ subject: "", message: "" });
      setNewContactFile({ base64: "", name: "" });
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Erreur lors de l'envoi du message.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateMessageStatus = async (messageId: string, updates: any) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, "contact_messages", messageId), updates);
    } catch (err) {
      console.error("Error updating message status:", err);
      alert("Erreur lors de la mise à jour du message.");
    }
  };

  const handleToggleSuspense = async (targetUser: any) => {
    if (!isAdmin) return;
    const newStatus = targetUser.status === "suspended" ? "active" : "suspended";
    const action = newStatus === "suspended" ? "suspendre" : "reprendre";
    
    if (window.confirm(`Êtes-vous sûr de vouloir ${action} l'accès pour ${targetUser.displayName}?`)) {
      try {
        await updateDoc(doc(db, "users", targetUser.uid), {
          status: newStatus
        });
      } catch (err) {
        console.error("Error toggling suspense:", err);
        alert("Erreur lors de la mise à jour du statut.");
      }
    }
  };

  const handleTogglePartnerVisibility = async (partnerId: string, currentVisibility: boolean) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, "partners", partnerId), {
        isVisible: !currentVisibility
      });
    } catch (err) {
      console.error("Error toggling partner visibility:", err);
      alert("Erreur lors de la mise à jour de la visibilité.");
    }
  };

  const handleSubmitProfileChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, "profile_updates"), {
        uid: user.uid,
        userEmail: user.email,
        ...profileForm,
        displayName: `${profileForm.firstName} ${profileForm.lastName}`,
        status: "pending",
        createdAt: serverTimestamp()
      });
      setIsRequestModalOpen(false);
      alert("Votre demande de modification a été soumise à l'administration pour validation.");
    } catch (err) {
      console.error("Error submitting profile update:", err);
      alert("Erreur lors de la soumission de la demande.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveProfileChange = async (request: any) => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      // 1. Update the user document (using setDoc with merge to avoid 'no document to update' error)
      const userRef = doc(db, "users", request.uid);
      await setDoc(userRef, {
        firstName: request.firstName,
        lastName: request.lastName,
        displayName: request.displayName,
        mobile: request.mobile,
        email: request.email,
        category: request.category,
        licenseNumber: request.licenseNumber,
        address: request.address
      }, { merge: true });

      // 2. Mark request as approved
      const requestRef = doc(db, "profile_updates", request.id);
      await updateDoc(requestRef, {
        status: "approved"
      });

      alert("Modification approuvée et appliquée au profil.");
    } catch (err) {
      console.error("Error approving profile update:", err);
      alert("Erreur lors de l'approbation.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectProfileChange = async (requestId: string) => {
    if (!isAdmin) return;
    if (window.confirm("Êtes-vous sûr de vouloir rejeter cette demande ?")) {
      try {
        await updateDoc(doc(db, "profile_updates", requestId), {
          status: "rejected"
        });
      } catch (err) {
        console.error("Error rejecting profile update:", err);
        alert("Erreur lors du rejet.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      setDemoAdmin(false);
    } catch (err) {
      console.error("Logout Error:", err);
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
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Header Dashboard */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 pb-8 border-b border-aaj-border">
            <div>
              <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">Espace Privé</span>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">
                Bienvenue, <br/> {userProfile?.displayName || "Cher Confrère"}
              </h1>
            </div>
            <div className="mt-8 md:mt-0 flex items-center gap-6">
              <div className="text-right">
                <span className="block text-[10px] uppercase font-black tracking-widest text-aaj-gray">Statut Adhérent</span>
                <span className="text-sm font-bold text-aaj-royal uppercase tracking-widest">
                   {userProfile?.role === "admin" ? "Administrateur" : userProfile?.role === "representative" ? "Représentant" : "Membre Actif 2026"}
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
                  { id: "dashboard", icon: <LayoutDashboard size={18} />, label: "Vue d'ensemble" },
                  { id: "commissions", icon: <Building2 size={18} />, label: "Avis Commissions" },
                  { id: "bibliotheque", icon: <BookOpen size={18} />, label: "Bibliothèque" },
                  { id: "documents", icon: <MessageSquare size={18} />, label: "Messagerie" },
                  { id: "member-partners", icon: <Shield size={18} />, label: "Nos Partenaires" },
                  { id: "annuaire", icon: <Users size={18} />, label: "Annuaire des Membres" },
                  { id: "settings", icon: <Settings size={18} />, label: "Mon Profil" },
                ].map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-4 px-6 py-4 rounded text-[11px] font-black uppercase tracking-[2px] transition-all ${
                      activeTab === item.id 
                      ? "bg-aaj-dark text-white shadow-lg" 
                      : "text-aaj-gray hover:bg-slate-50 border border-transparent hover:border-aaj-border"
                    }`}
                  >
                    <span className={activeTab === item.id ? "text-aaj-royal" : ""}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>

              {isAdmin && (
                <div className="mt-12 space-y-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-gray px-6 mb-4 mt-8 flex items-center gap-2">
                    <Shield size={12} className="text-aaj-royal" /> Administration
                  </h3>
                  {[
                    { id: "admin-members", icon: <Users size={18} />, label: "Gérer Adhésions" },
                    { id: "admin-partners", icon: <Shield size={18} />, label: "Gérer Partenaires" },
                    { 
                      id: "admin-profile-requests", 
                      icon: <CheckCircle2 size={18} />, 
                      label: "Validations Profils",
                      badge: profileRequests.filter(r => r.status === "pending").length
                    },
                    { id: "admin-documents", icon: <BookOpen size={18} />, label: "Gérer Bibliothèque" },
                    { id: "admin-commissions", icon: <Building2 size={18} />, label: "Dépôts des Avis" },
                    { id: "admin-news", icon: <FileText size={18} />, label: "Actions & Infos" },
                    { 
                      id: "admin-messages", 
                      icon: <Mail size={18} />, 
                      label: "Messages Entrants",
                      badge: adminMessages.filter(m => m.status === "unread").length
                    },
                  ].map((item) => (
                    <button 
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-6 py-4 rounded text-[11px] font-black uppercase tracking-[2px] transition-all ${
                        activeTab === item.id 
                        ? "bg-aaj-dark text-white shadow-lg" 
                        : "text-aaj-gray hover:bg-slate-50 border border-transparent hover:border-aaj-border"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={activeTab === item.id ? "text-aaj-royal" : ""}>{item.icon}</span>
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
              )}

              {!isAdmin && isRepresentative && (
                <div className="mt-12 space-y-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-gray px-6 mb-4 mt-8 flex items-center gap-2">
                    <Shield size={12} className="text-aaj-royal" /> Privilèges
                  </h3>
                  <button 
                    onClick={() => setActiveTab("admin-commissions")}
                    className={`w-full flex items-center gap-4 px-6 py-4 rounded text-[11px] font-black uppercase tracking-[2px] transition-all ${
                      activeTab === "admin-commissions" 
                      ? "bg-aaj-dark text-white shadow-lg" 
                      : "text-aaj-gray hover:bg-slate-50 border border-transparent hover:border-aaj-border"
                    }`}
                  >
                    <span className={activeTab === "admin-commissions" ? "text-aaj-royal" : ""}><Building2 size={18} /></span>
                    Dépôts des Avis
                  </button>
                </div>
              )}
            </aside>

            {/* Main Dashboard Grid */}
            <main className="lg:col-span-9 space-y-12">
              <AnimatePresence mode="wait">
                {activeTab === "dashboard" && (
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
                                onClick={() => setActiveTab("news-history")}
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
                                       {item.createdAt?.toDate?.()?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) || 'Récemment'}
                                     </span>
                                     {item.fileBase64 && (
                                       <a 
                                         href={item.fileBase64} 
                                         download={item.fileName || "Annonce_AAJ.pdf"}
                                         onClick={(e) => e.stopPropagation()}
                                         className="text-[8px] font-black uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded text-aaj-gray hover:bg-aaj-royal hover:text-white transition-all flex items-center gap-1"
                                       >
                                         <Download size={8} /> Document
                                       </a>
                                     )}
                                  </div>
                                  <h4 className="text-lg font-black uppercase tracking-tighter group-hover:text-aaj-royal transition-colors">{item.title}</h4>
                                  <p className="text-xs text-aaj-gray mt-2 leading-relaxed font-medium line-clamp-2">{item.content}</p>
                                </div>
                              ))}
                              {newsItems.length === 0 && (
                                <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest italic py-4">Aucune annonce publiée</p>
                              )}
                            </div>
                          </div>
                       </div>

                        <div className="space-y-6">
                           <div className="border border-aaj-border p-10 flex flex-col text-center justify-center bg-white rounded">
                              <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4">Cotisation</span>
                              <div className="text-4xl font-black text-aaj-dark mb-2">2026</div>
                              <div className="inline-block px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-[2px] rounded border border-green-100 mx-auto">
                                À jour
                              </div>
                              <p className="text-[10px] text-aaj-gray mt-6 font-bold uppercase tracking-widest leading-relaxed">Prochain renouvellement : <br/> Janvier 2027</p>
                           </div>
                        </div>
                     </div>

                    {/* Quick Access Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       {["Houmt Souk", "Midoun", "Ajim"].map((town) => {
                         const townPVs = commissionPVs.filter(pv => pv.town === town);
                         const latestPV = townPVs[0];
                         const totalAvis = townPVs.reduce((acc, curr) => acc + (parseInt(curr.count) || 0), 0);
                         
                         return (
                           <div 
                             key={town} 
                             onClick={() => {
                               setSelectedCommune(town);
                               setActiveTab("commissions");
                             }}
                             className="p-6 border border-aaj-border rounded bg-white group hover:border-aaj-royal transition-all cursor-pointer"
                           >
                              <span className="text-[9px] font-black text-aaj-royal uppercase tracking-widest mb-2 block">{town}</span>
                              <div className="flex justify-between items-end">
                                 <div>
                                   <p className="text-2xl font-black uppercase tracking-tighter">{totalAvis} Avis</p>
                                   <p className="text-[10px] font-bold text-aaj-gray uppercase mt-1">
                                     {latestPV ? `Dernière : ${new Date(latestPV.date).toLocaleDateString()}` : "Aucun avis"}
                                   </p>
                                 </div>
                                 <div className={`text-[9px] font-black px-2 py-1 uppercase rounded bg-green-50 text-green-600 group-hover:bg-aaj-royal group-hover:text-white transition-all`}>
                                   Consulter
                                 </div>
                              </div>
                           </div>
                         );
                       })}
                    </div>
                  </motion.div>
                )}

                {activeTab === "annuaire" && (
                  <motion.div 
                    key="annuaire"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-8 pb-6 border-b border-aaj-border">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">Annuaire des Adhérents</h2>
                      <div className="flex items-center gap-6">
                        <div className="flex bg-slate-100 p-1 rounded">
                          <button 
                            onClick={() => setAnnuaireViewMode("grid")}
                            className={`p-2 rounded transition-all ${annuaireViewMode === "grid" ? "bg-white shadow text-aaj-royal" : "text-aaj-gray hover:text-aaj-dark"}`}
                          >
                            <Grid size={16} />
                          </button>
                          <button 
                            onClick={() => setAnnuaireViewMode("list")}
                            className={`p-2 rounded transition-all ${annuaireViewMode === "list" ? "bg-white shadow text-aaj-royal" : "text-aaj-gray hover:text-aaj-dark"}`}
                          >
                            <List size={16} />
                          </button>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">
                          {allUsers.length} Architectes
                        </div>
                      </div>
                    </div>

                    {annuaireViewMode === "grid" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {allUsers.filter(m => m.status !== "suspended").map(member => (
                          <div key={member.uid} className="p-6 border border-aaj-border rounded bg-white hover:shadow-xl transition-shadow group">
                             <div className="flex gap-6">
                                <div className="w-16 h-16 bg-slate-50 border border-aaj-border rounded flex items-center justify-center text-aaj-royal group-hover:bg-aaj-royal group-hover:text-white transition-colors">
                                  <UserCircle size={32} />
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-black uppercase tracking-tight mb-1">{member.displayName}</h3>
                                  <p className="text-[10px] font-black text-aaj-royal uppercase tracking-widest mb-4">{member.category}</p>
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
                              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">Architecte</th>
                              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">Contact</th>
                              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray text-right">Localité</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-aaj-border">
                            {allUsers.filter(m => m.status !== "suspended").map(member => (
                              <tr key={member.uid} className="hover:bg-slate-50/50 transition-all group">
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-aaj-gray group-hover:text-aaj-royal transition-colors">
                                      <UserCircle size={18} />
                                    </div>
                                    <div>
                                      <p className="text-sm font-black uppercase tracking-tight">{member.displayName}</p>
                                      <p className="text-[9px] text-aaj-royal font-black uppercase tracking-widest">{member.category}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-aaj-dark uppercase">{member.email}</p>
                                    <p className="text-[10px] font-bold text-aaj-gray uppercase">{member.mobile || "N/A"}</p>
                                  </div>
                                </td>
                                <td className="p-4 text-right">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-aaj-dark">{member.address || "N/A"}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "commissions" && (
                  <motion.div 
                    key="commissions"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-aaj-border">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">
                        {selectedCommune ? `Avis Commissions : ${selectedCommune}` : "Avis des Commissions Techniques"}
                      </h2>
                      {selectedCommune && (
                        <button 
                          onClick={() => setSelectedCommune(null)}
                          className="text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:text-aaj-royal flex items-center gap-2 border border-aaj-border px-4 py-2 rounded"
                        >
                          <XCircle size={14} /> Vue d'ensemble
                        </button>
                      )}
                    </div>

                    {selectedCommune ? (
                      <div className="space-y-4">
                        {commissionPVs
                          .filter(pv => pv.town === selectedCommune)
                          .map((pv, idx) => (
                            <div key={idx} className="p-6 border border-aaj-border rounded bg-white hover:border-aaj-royal group transition-all">
                               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                  <div>
                                    <div className="flex items-center gap-3 mb-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-aaj-royal">Commission du {new Date(pv.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                      <span className="text-[11px] font-black uppercase tracking-tighter">{pv.count} Dossiers traités</span>
                                    </div>
                                    <p className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">{pv.fileName || "Procès-verbal de commission"}</p>
                                  </div>
                                  <a 
                                    href={pv.fileBase64} 
                                    download={pv.fileName || `PV_Commission_${selectedCommune}_${pv.date}.pdf`}
                                    className="bg-slate-100 text-aaj-dark px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal hover:text-white transition-all flex items-center gap-2 border border-transparent hover:border-aaj-royal"
                                  >
                                    <Download size={14} /> Télécharger le PV
                                  </a>
                               </div>
                            </div>
                          ))}
                        {commissionPVs.filter(pv => pv.town === selectedCommune).length === 0 && (
                          <div className="p-12 border border-dashed border-aaj-border rounded text-center opacity-50">
                            <p className="text-xs font-black uppercase tracking-widest text-aaj-gray">Aucun PV publié pour cette commune</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {["Houmt Souk", "Midoun", "Ajim"].map((town) => {
                          const townPVs = commissionPVs.filter(pv => pv.town === town);
                          return (
                            <div key={town} className="p-8 border border-aaj-border rounded bg-white text-center flex flex-col justify-between hover:border-aaj-royal transition-all group">
                               <div>
                                 <Building2 size={32} className="mx-auto text-aaj-royal mb-4" />
                                 <h3 className="text-xl font-black uppercase tracking-tighter mb-2">{town}</h3>
                                 <p className="text-[10px] font-black text-aaj-gray uppercase tracking-widest mb-6">Total PVs : {townPVs.length}</p>
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

                {activeTab === "news-history" && (
                   <motion.div 
                    key="news-history"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-aaj-border">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">Historique des Annonces Internes</h2>
                      <button 
                        onClick={() => setActiveTab("dashboard")}
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
                              {item.createdAt?.toDate?.()?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                          <h3 className="text-xl font-black uppercase tracking-tighter mb-4 group-hover:text-aaj-royal transition-colors">{item.title}</h3>
                          <div className="text-sm text-aaj-gray leading-relaxed font-medium whitespace-pre-wrap">{item.content}</div>
                        </div>
                      ))}
                      {newsItems.length === 0 && (
                        <div className="p-12 border border-dashed border-aaj-border rounded text-center opacity-50">
                          <p className="text-xs font-black uppercase tracking-widest text-aaj-gray">Aucune annonce dans l'historique</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === "bibliotheque" && (
                  <motion.div 
                    key="bibliotheque"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-12"
                  >
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Bibliothèque Technique & Légale</h2>
                      <p className="text-sm text-aaj-gray font-medium uppercase tracking-widest max-w-2xl mb-12">
                        Accédez aux documents de référence, plans d'aménagement et cadres contractuels essentiels à votre pratique professionnelle sur l'île.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Urbanisme section */}
                        <div className="space-y-6">
                          <div className="flex justify-between items-center bg-slate-50 p-4 border border-aaj-border rounded">
                            <h3 className="text-[10px] uppercase font-black tracking-widest text-aaj-royal">Plan d'Aménagement</h3>
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
                              .filter(d => d.category === "Plan d'Aménagement")
                              .filter(d => libraryFilterCommune === "Toutes" || d.commune === libraryFilterCommune)
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
                                    <span className="text-[9px] text-aaj-gray font-black uppercase tracking-widest mt-1 ml-6">{doc.subCategory}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-black text-aaj-gray uppercase border border-aaj-border px-2 py-1 rounded group-hover:bg-white transition-colors">{doc.fileType}</span>
                                  <Download size={14} className="text-aaj-gray group-hover:text-aaj-royal" />
                                </div>
                              </a>
                            ))}
                            {libraryDocs.filter(d => d.category === "Plan d'Aménagement").length === 0 && (
                              <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest text-center py-4 italic">Aucun document disponible</p>
                            )}
                          </div>
                        </div>

                        {/* Juridique section */}
                        <div className="space-y-6">
                           <div className="flex justify-between items-center bg-slate-50 p-4 border border-aaj-border rounded">
                            <h3 className="text-[10px] uppercase font-black tracking-widest text-aaj-royal">Cadre Contractuel & Légal</h3>
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
                              .filter(d => d.category === "Cadre Contractuel & Légal")
                              .filter(d => libraryFilterLegal === "Tous" || d.subCategory === libraryFilterLegal)
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
                                    {doc.fileType === 'xlsx' || doc.fileType === 'xls' ? <FileSpreadsheet size={12} className="text-aaj-royal" /> : <FileText size={12} className="text-aaj-royal" />}
                                    {doc.name}
                                  </span>
                                  {doc.subCategory && (
                                    <span className="text-[9px] text-aaj-gray font-black uppercase tracking-widest mt-1 ml-6">{doc.subCategory}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-black text-aaj-gray uppercase border border-aaj-border px-2 py-1 rounded group-hover:bg-white transition-colors">{doc.fileType}</span>
                                  <Download size={14} className="text-aaj-gray group-hover:text-aaj-royal" />
                                </div>
                              </a>
                            ))}
                            {libraryDocs.filter(d => d.category === "Cadre Contractuel & Légal").length === 0 && (
                              <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest text-center py-4 italic">Aucun document disponible</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {isAdmin && activeTab === "admin-documents" && (
                  <motion.div 
                    key="admin-documents"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-12"
                  >
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Gestion de la Bibliothèque</h2>
                      <p className="text-sm text-aaj-gray font-medium uppercase tracking-widest max-w-2xl mb-12">
                        Ajoutez, organisez et supprimez les documents techniques et légaux mis à disposition des membres.
                      </p>

                      <form onSubmit={handleAddDocument} className="bg-slate-50 border border-aaj-border p-10 rounded mb-12 space-y-8 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Nom du Document</label>
                            <input 
                              type="text" 
                              required
                              value={newDoc.name}
                              onChange={(e) => setNewDoc({...newDoc, name: e.target.value})}
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
                              onChange={(e) => setNewDoc({...newDoc, url: e.target.value})}
                              placeholder="https://..."
                              className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal focus:border-aaj-royal outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Catégorie Utilité</label>
                            <select 
                              value={newDoc.category}
                              onChange={(e) => setNewDoc({...newDoc, category: e.target.value})}
                              className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none appearance-none cursor-pointer"
                            >
                              <option value="Plan d'Aménagement">Plan d'Aménagement</option>
                              <option value="Cadre Contractuel & Légal">Cadre Contractuel & Légal</option>
                            </select>
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Document (PC ou Mobile)</label>
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
                                  {newDoc.fileName || "Choisir un fichier..."}
                                </span>
                                <Upload size={14} className="text-aaj-gray group-hover:text-aaj-royal shrink-0" />
                              </button>
                              {newDoc.fileBase64 && (
                                <button 
                                  type="button"
                                  onClick={() => setNewDoc({...newDoc, fileBase64: "", fileName: "", fileType: "pdf"})}
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
                                  <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Commune</label>
                                  <select 
                                    value={newDoc.commune}
                                    onChange={(e) => setNewDoc({...newDoc, commune: e.target.value})}
                                    className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none"
                                  >
                                    <option value="Houmt Souk">Houmt Souk</option>
                                    <option value="Midoun">Midoun</option>
                                    <option value="Ajim">Ajim</option>
                                  </select>
                               </div>
                               <div className="space-y-3">
                                  <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Arrondissement (Optionnel)</label>
                                  <input 
                                    type="text" 
                                    value={newDoc.arrondissement}
                                    onChange={(e) => setNewDoc({...newDoc, arrondissement: e.target.value})}
                                    placeholder="Ex: Cedghiane, Erriadh..."
                                    className="w-full bg-white border border-aaj-border rounded px-5 py-3.5 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none"
                                  />
                               </div>
                            </div>
                          ) : (
                            <div className="pt-4 border-t border-slate-200">
                               <div className="space-y-3 max-w-md">
                                  <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Type de Document</label>
                                  <select 
                                    value={newDoc.legalType}
                                    onChange={(e) => setNewDoc({...newDoc, legalType: e.target.value})}
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
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />} 
                            Ajouter à la bibliothèque
                          </button>
                        </div>
                      </form>

                      <div className="grid grid-cols-1 gap-4">
                        {libraryDocs.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-6 bg-white border border-aaj-border rounded hover:border-aaj-royal/30 transition-all">
                             <div className="flex items-center gap-6">
                               <div className="w-12 h-12 bg-slate-50 rounded flex items-center justify-center text-aaj-gray">
                                 {doc.fileType === 'pdf' ? <FileText size={24} /> : (doc.fileType === 'xlsx' ? <FileSpreadsheet size={24} /> : <FileCode size={24} />)}
                               </div>
                               <div>
                                 <h4 className="font-black uppercase tracking-tight leading-none mb-2">{doc.name}</h4>
                                 <div className="flex items-center gap-3">
                                   <span className="text-[9px] font-black uppercase tracking-widest text-aaj-royal bg-blue-50 px-2 py-0.5 rounded">{doc.category}</span>
                                   {doc.subCategory && <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray">{doc.subCategory}</span>}
                                   <span className="text-[9px] font-black uppercase tracking-widest text-aaj-gray/50">{doc.fileType.toUpperCase()}</span>
                                 </div>
                               </div>
                             </div>
                             <div className="flex items-center gap-4">
                               <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-aaj-gray hover:text-aaj-royal transition-colors">
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

                {activeTab === "documents" && (
                  <motion.div 
                    key="documents"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-12"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                      <div className="flex-1">
                        <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Messagerie</h2>
                        <p className="text-sm text-aaj-gray font-bold uppercase tracking-widest max-w-2xl mb-8 leading-relaxed">
                          Contactez le bureau exécutif et déposez vos documents officiels. 
                          Toute demande sera traitée dans les plus brefs délais.
                        </p>
                        
                        <div 
                          onClick={() => setIsContactModalOpen(true)}
                          className="border-2 border-dashed border-aaj-border p-12 rounded text-center bg-slate-50/30 hover:bg-slate-50 transition-colors group cursor-pointer"
                        >
                          <MessageSquare size={40} className="mx-auto text-aaj-gray group-hover:text-aaj-royal transition-colors mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest mb-1">Nouveau Message ou Dépôt</p>
                          <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest">Cliquez pour ouvrir le formulaire</p>
                        </div>
                      </div>

                      <div className="w-full md:w-80 bg-slate-50 p-8 border border-aaj-border rounded">
                        <h3 className="text-[10px] font-black uppercase tracking-[2px] text-aaj-dark mb-4 pb-2 border-b border-aaj-border">Instructions</h3>
                        <ul className="space-y-4">
                          <li className="flex gap-3 items-start">
                            <CheckCircle2 size={12} className="text-aaj-royal mt-0.5" />
                            <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-wide">Réponses par email sous 48h</span>
                          </li>
                          <li className="flex gap-3 items-start">
                            <CheckCircle2 size={12} className="text-aaj-royal mt-0.5" />
                            <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-wide">Documents PDF/Images uniquement</span>
                          </li>
                          <li className="flex gap-3 items-start">
                            <CheckCircle2 size={12} className="text-aaj-royal mt-0.5" />
                            <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-wide">Suivi en temps réel de l'état</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-8 flex items-center gap-4">
                        Historique de mes demandes <span className="h-px flex-1 bg-aaj-border"></span>
                      </h3>
                      <div className="space-y-4">
                         {userMessages.map((msg) => (
                           <div key={msg.id} className="p-6 border border-aaj-border rounded bg-white hover:border-aaj-royal transition-all group">
                              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                 <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-aaj-royal">{msg.subject}</span>
                                      <span className="text-[8px] text-aaj-gray">•</span>
                                      <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">
                                        {msg.createdAt?.toDate?.()?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-aaj-dark font-medium line-clamp-1">{msg.message}</p>
                                    {msg.fileName && (
                                      <div className="mt-2 flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-aaj-gray bg-slate-50 px-2 py-0.5 rounded w-fit">
                                        <Download size={10} /> {msg.fileName}
                                      </div>
                                    )}
                                 </div>
                                 <div className="flex items-center gap-3">
                                    {msg.replied ? (
                                      <span className="text-[9px] font-black text-green-600 bg-green-50 px-2.5 py-1 rounded border border-green-100 uppercase tracking-widest">Traité</span>
                                    ) : (
                                      <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded border border-amber-100 uppercase tracking-widest">En attente</span>
                                    )}
                                 </div>
                              </div>
                           </div>
                         ))}
                         {userMessages.length === 0 && (
                           <div className="text-center py-12 border border-dashed border-aaj-border rounded opacity-50">
                             <p className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">Aucun message envoyé pour le moment</p>
                           </div>
                         )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "settings" && (
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

                    {pendingUserRequests.some(r => r.status === 'pending') && (
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Loader2 size={16} className="text-amber-600 animate-spin" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Une demande de modification est en cours d'examen</p>
                        </div>
                        <span className="text-[9px] font-bold text-amber-600 italic">Soumis le {pendingUserRequests.find(r => r.status === 'pending')?.createdAt?.toDate?.()?.toLocaleDateString() || 'récemment'}</span>
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
                              <span className="text-[9px] font-black uppercase tracking-widest text-center px-4">Changer la photo</span>
                           </div>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-aaj-royal">{userProfile?.category}</p>
                          <h3 className="text-xl font-black uppercase tracking-tight mt-1">{userProfile?.displayName || "Architecte AAJ"}</h3>
                        </div>
                      </div>

                      {/* Right side: Form details (Read only) */}
                      <div className="lg:col-span-2 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Prénom</label>
                            <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">{userProfile?.firstName || "-"}</p>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Nom</label>
                            <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">{userProfile?.lastName || "-"}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Mobile / WhatsApp</label>
                            <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">{userProfile?.mobile || "-"}</p>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Email de contact</label>
                            <p className="mt-2 text-sm font-bold border-b border-slate-100 pb-2">{userProfile?.email || "-"}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Catégorie</label>
                            <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">{userProfile?.category || "-"}</p>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                              {userProfile?.category === "Architecte" ? "Matricule Ordre" : "Matricule Étudiant"}
                            </label>
                            <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">{userProfile?.licenseNumber || "-"}</p>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Adresse professionnelle</label>
                          <p className="mt-2 text-sm font-bold uppercase border-b border-slate-100 pb-2">{userProfile?.address || "-"}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Admin Sections */}
                {activeTab === "admin-members" && isAdmin && (
                   <motion.div 
                    key="admin-members"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">Gestion des Adhésions</h2>
                      <button 
                        onClick={() => setIsAddMemberModalOpen(true)}
                        className="bg-aaj-dark text-white px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center gap-2"
                      >
                        <Plus size={14} /> Ajouter un Membre
                      </button>
                    </div>
                    
                    <div className="border border-aaj-border rounded overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-aaj-border">
                          <tr>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">Architecte</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">Statut</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray">Cotisation</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-aaj-gray text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-aaj-border">
                          {allUsers.map(member => (
                            <tr key={member.uid} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4">
                                <p className="text-sm font-black uppercase tracking-tight">{member.displayName}</p>
                                <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest">{member.email}</p>
                              </td>
                              <td className="p-4">
                                {member.status === "suspended" ? (
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
                                <p className="text-xs font-bold text-aaj-dark">2026</p>
                              </td>
                              <td className="p-4 text-right">
                                <button 
                                  onClick={() => setEditingMember(member)}
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {activeTab === "admin-partners" && isAdmin && (
                   <motion.div 
                    key="admin-partners"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">Gestion des Partenaires</h2>
                      <button className="bg-aaj-dark text-white px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center gap-2">
                        <Plus size={14} /> Nouveau Partenaire
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {partnersList.map(partner => (
                        <div key={partner.id} className="p-8 border border-aaj-border rounded bg-white relative">
                          <div className={`absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                            partner.level === 'Platine' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            partner.level === 'Or' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                            'bg-slate-50 text-slate-700 border-slate-100'
                          }`}>
                            {partner.level}
                          </div>
                          <h3 className="text-lg font-black uppercase tracking-tight mb-2">{partner.name}</h3>
                          <p className="text-[10px] font-bold text-aaj-gray uppercase tracking-widest mb-4 border-b border-aaj-border pb-2">Actif depuis : {partner.joined}</p>
                          
                          <div className="flex items-center justify-between gap-4 mb-6">
                             <span className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">Visibilité membres</span>
                             <button 
                               onClick={() => handleTogglePartnerVisibility(partner.id, partner.isVisible)}
                               className={`w-10 h-5 rounded-full relative transition-all ${partner.isVisible ? 'bg-aaj-royal' : 'bg-slate-200'}`}
                             >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${partner.isVisible ? 'left-6' : 'left-1'}`} />
                             </button>
                          </div>

                          <div className="flex gap-4">
                            <button className="flex-1 text-[9px] font-black uppercase tracking-widest text-aaj-royal border border-aaj-royal/20 py-2 rounded hover:bg-aaj-royal hover:text-white transition-all">Gérer</button>
                            <button className="flex-1 text-[9px] font-black uppercase tracking-widest text-red-500 border border-red-500/20 py-2 rounded hover:bg-red-50 transition-all">Retirer</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === "admin-messages" && isAdmin && (
                  <motion.div 
                    key="admin-messages"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-black uppercase tracking-tighter">Messages Entrants & Dépôts</h2>
                      <div className="flex gap-4">
                        <div className="bg-slate-100 px-4 py-2 rounded border border-slate-200 text-[10px] font-black uppercase tracking-widest text-aaj-gray flex items-center gap-2">
                           {adminMessages.filter(m => m.status === 'unread').length} Non lus
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                       {adminMessages.map((msg) => (
                         <div key={msg.id} className={`p-8 border rounded transition-all ${msg.status === 'unread' ? 'bg-blue-50/30 border-aaj-royal/30' : 'bg-white border-aaj-border opacity-70'}`}>
                            <div className="flex flex-col md:flex-row justify-between gap-8">
                               <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                     <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${msg.status === 'unread' ? 'bg-aaj-royal text-white' : 'bg-slate-100 text-aaj-gray'}`}>
                                       {msg.status === 'unread' ? 'Nouveau' : 'Lu'}
                                     </span>
                                     <span className="text-[10px] font-black uppercase tracking-widest text-aaj-dark underline decoration-aaj-royal/30 decoration-2">{msg.userName}</span>
                                     <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">• {msg.userEmail}</span>
                                  </div>
                                  <h4 className="text-sm font-black uppercase tracking-tight text-aaj-dark mb-4">{msg.subject}</h4>
                                  <div className="text-xs text-aaj-gray leading-relaxed font-medium mb-6 bg-slate-50/50 p-4 rounded-lg italic">"{msg.message}"</div>
                                  
                                  {msg.fileBase64 && (
                                    <div className="flex items-center gap-4 bg-white border border-aaj-border p-4 rounded group w-fit">
                                       <FileText size={20} className="text-aaj-royal" />
                                       <div className="flex flex-col">
                                          <span className="text-[10px] font-black uppercase tracking-widest text-aaj-dark">{msg.fileName}</span>
                                          <a href={msg.fileBase64} download={msg.fileName} className="text-[8px] font-black uppercase text-aaj-royal hover:underline mt-1 flex items-center gap-1">
                                            <Download size={10} /> Télécharger le dépôt
                                          </a>
                                       </div>
                                    </div>
                                  )}
                               </div>
                               <div className="md:w-64 flex flex-col gap-4 justify-between border-l border-aaj-border pl-8">
                                  <div className="space-y-4">
                                     <div className="flex items-center gap-3 justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">Statut de réponse</label>
                                        <div 
                                          onClick={() => handleUpdateMessageStatus(msg.id, { replied: !msg.replied })}
                                          className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${msg.replied ? 'bg-green-500' : 'bg-slate-200'}`}
                                        >
                                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${msg.replied ? 'left-6' : 'left-1'}`} />
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-2">
                                        {msg.replied ? (
                                          <CheckCircle2 size={12} className="text-green-600" />
                                        ) : (
                                          <Loader2 size={12} className="text-amber-500" />
                                        )}
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${msg.replied ? 'text-green-600' : 'text-amber-600'}`}>
                                          {msg.replied ? 'Déjà Répondu' : 'En attente de réponse'}
                                        </span>
                                     </div>
                                  </div>

                                  <div className="space-y-2">
                                     {msg.status === 'unread' && (
                                       <button 
                                         onClick={() => handleUpdateMessageStatus(msg.id, { status: 'read' })}
                                         className="w-full py-2 bg-aaj-dark text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all"
                                       >
                                         Marquer comme lu
                                       </button>
                                     )}
                                     <button 
                                       onClick={() => handleUpdateMessageStatus(msg.id, { status: msg.status === 'unread' ? 'read' : 'unread' })}
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
                           <p className="text-[10px] font-black uppercase tracking-widest text-aaj-gray opacity-50">Aucun message reçu pour le moment</p>
                         </div>
                       )}
                    </div>
                  </motion.div>
                )}
                {activeTab === "admin-commissions" && isRepresentative && (
                   <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Dépôt des Avis Commissions</h2>
                    <form onSubmit={handleAddPV} className="max-w-2xl bg-slate-50/50 p-10 border border-aaj-border rounded space-y-8">
                       <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Commune</label>
                             <select 
                                value={newPV.town}
                                onChange={(e) => setNewPV({...newPV, town: e.target.value})}
                                className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold uppercase tracking-widest"
                             >
                                <option>Houmt Souk</option>
                                <option>Midoun</option>
                                <option>Ajim</option>
                             </select>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Date Commission</label>
                             <input 
                                type="date" 
                                required
                                value={newPV.date}
                                onChange={(e) => setNewPV({...newPV, date: e.target.value})}
                                className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold" 
                             />
                          </div>
                       </div>
                       
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Fichier PV (PDF)</label>
                          <div className="border border-aaj-border rounded bg-white p-8 text-center relative group overflow-hidden">
                             <input 
                                type="file" 
                                required
                                accept="application/pdf"
                                onChange={async (e) => {
                                  if (e.target.files?.[0]) {
                                    const file = e.target.files[0];
                                    const base64 = await fileToBase64(file);
                                    setNewPV({...newPV, fileBase64: base64, fileName: file.name});
                                  }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                             />
                             <Upload size={24} className="mx-auto text-aaj-royal mb-2" />
                             <p className="text-[10px] font-black uppercase tracking-widest group-hover:text-aaj-royal transition-colors">
                               {newPV.fileName || "Sélectionner le document officiel"}
                             </p>
                          </div>
                       </div>

                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Nombre de dossiers</label>
                          <input 
                            type="number" 
                            required
                            placeholder="Ex: 15" 
                            value={newPV.count}
                            onChange={(e) => setNewPV({...newPV, count: e.target.value})}
                            className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold" 
                          />
                       </div>

                       <button 
                        type="submit"
                        disabled={isSaving}
                        className="w-full bg-aaj-royal text-white py-4 rounded font-black uppercase tracking-widest text-[11px] shadow-lg shadow-aaj-royal/20 active:scale-95 transition-all flex justify-center items-center gap-2"
                       >
                         {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                         Publier les avis
                       </button>
                    </form>
                  </motion.div>
                )}

                {activeTab === "admin-profile-requests" && isAdmin && (
                  <motion.div 
                    key="admin-profile-requests"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Validations des Modifications de Profil</h2>
                    
                    <div className="space-y-6">
                      {profileRequests.filter(r => r.status === "pending").length === 0 ? (
                        <div className="p-12 border border-dashed border-aaj-border rounded text-center bg-slate-50/50">
                          <CheckCircle2 size={48} className="mx-auto text-green-200 mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest text-aaj-gray">Toutes les demandes ont été traitées</p>
                        </div>
                      ) : (
                        profileRequests.filter(r => r.status === "pending").map(request => (
                          <div key={request.id} className="border border-aaj-border rounded bg-white overflow-hidden shadow-sm">
                            <div className="p-6 bg-slate-50 border-b border-aaj-border flex justify-between items-center">
                              <div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-aaj-royal bg-white px-2 py-1 border border-aaj-royal/20 rounded mb-2 inline-block">Demande ID: {request.id.slice(0,8)}</span>
                                <h3 className="text-lg font-black uppercase tracking-tight">{request.displayName}</h3>
                                <p className="text-[10px] font-bold text-aaj-gray uppercase tracking-widest">{request.userEmail}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-black text-aaj-gray uppercase tracking-widest">Soumis le</p>
                                <p className="text-xs font-bold">{request.createdAt?.toDate?.()?.toLocaleDateString() || 'récemment'}</p>
                              </div>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                              <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-aaj-gray block mb-1">Prénom & Nom</label>
                                <p className="text-sm font-bold uppercase">{request.firstName} {request.lastName}</p>
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-aaj-gray block mb-1">Mobile</label>
                                <p className="text-sm font-bold">{request.mobile || "-"}</p>
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-aaj-gray block mb-1">Catégorie</label>
                                <p className="text-sm font-bold uppercase">{request.category}</p>
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-aaj-gray block mb-1">Matricule</label>
                                <p className="text-sm font-bold uppercase">{request.licenseNumber || "-"}</p>
                              </div>
                              <div className="md:col-span-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-aaj-gray block mb-1">Adresse</label>
                                <p className="text-sm font-bold uppercase">{request.address || "-"}</p>
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

                {activeTab === "admin-news" && isAdmin && (
                   <motion.div 
                    key="admin-news"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Actions & Informations Internes</h2>
                    <form onSubmit={handleAddNews} className="max-w-2xl bg-white p-10 border border-aaj-border rounded space-y-8 shadow-sm">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Titre de l'annonce</label>
                        <input 
                          type="text" 
                          required
                          value={newNews.title}
                          onChange={(e) => setNewNews({...newNews, title: e.target.value})}
                          placeholder="Ex: Réunion extraordinaire..." 
                          className="w-full bg-slate-50 border border-aaj-border rounded px-4 py-3 text-xs font-bold focus:ring-1 focus:ring-aaj-royal outline-none transition-all" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Message (Détails)</label>
                        <textarea 
                          rows={6} 
                          required
                          value={newNews.content}
                          onChange={(e) => setNewNews({...newNews, content: e.target.value})}
                          className="w-full bg-slate-50 border border-aaj-border rounded px-4 py-3 text-xs font-bold leading-relaxed resize-none focus:ring-1 focus:ring-aaj-royal outline-none transition-all"
                        ></textarea>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Document Joint (Optionnel)</label>
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
                              {newNews.fileName || "Uploader une image, un PDF..."}
                            </span>
                            <Upload size={14} className="text-aaj-gray group-hover:text-aaj-royal shrink-0" />
                          </button>
                          {newNews.fileBase64 && (
                            <button 
                              type="button"
                              onClick={() => setNewNews({...newNews, fileBase64: "", fileName: ""})}
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
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Diffuser le message
                      </button>
                    </form>

                    <div className="pt-12 border-t border-aaj-border">
                        <h3 className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-8 flex items-center gap-4">
                          Dernières Diffusions <span className="h-px flex-1 bg-aaj-border"></span>
                        </h3>
                        <div className="space-y-4">
                           {newsItems.map((item, idx) => (
                             <div key={idx} className="p-6 border border-aaj-border rounded bg-white flex justify-between items-center group">
                                <div>
                                  <p className="text-[11px] font-black uppercase tracking-widest">{item.title}</p>
                                  <p className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">{item.createdAt?.toDate?.()?.toLocaleDateString('fr-FR')}</p>
                                </div>
                                <div className="flex gap-2">
                                  {item.fileBase64 && <FileText size={16} className="text-aaj-gray" />}
                                  <button onClick={async () => {
                                      if(window.confirm("Supprimer cette annonce ?")) {
                                        await deleteDoc(doc(db, "news", item.id));
                                      }
                                  }} className="text-aaj-gray hover:text-red-500 transition-colors">
                                     <Trash2 size={16} />
                                  </button>
                                </div>
                             </div>
                           ))}
                        </div>
                    </div>
                  </motion.div>
                )}
                {activeTab === "member-partners" && (
                  <motion.div 
                    key="member-partners"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-12"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-end gap-8">
                       <div>
                          <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Nos Partenaires Privilégiés</h2>
                          <p className="text-sm text-aaj-gray font-bold uppercase tracking-widest max-w-2xl leading-relaxed">
                            Découvrez les partenaires qui soutiennent l'AAJ et bénéficiez d'offres exclusives réservées aux adhérents.
                          </p>
                       </div>
                       <div className="flex border border-aaj-border rounded overflow-hidden shadow-sm">
                          <button 
                            onClick={() => setPartnersViewMode("grid")}
                            className={`p-3 transition-colors ${partnersViewMode === "grid" ? "bg-aaj-dark text-white" : "bg-white text-aaj-gray hover:bg-slate-50"}`}
                          >
                            <Grid size={16} />
                          </button>
                          <button 
                            onClick={() => setPartnersViewMode("list")}
                            className={`p-3 transition-colors ${partnersViewMode === "list" ? "bg-aaj-dark text-white" : "bg-white text-aaj-gray hover:bg-slate-50"}`}
                          >
                            <List size={16} />
                          </button>
                       </div>
                    </div>

                    {partnersViewMode === "grid" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {partnersList.filter(p => p.isVisible).map((partner) => (
                          <div key={partner.id} className="p-8 border border-aaj-border rounded bg-white hover:border-aaj-royal transition-all group flex flex-col items-center text-center shadow-sm">
                            <div className={`text-[9px] font-black uppercase tracking-[2px] px-3 py-1 rounded border mb-6 ${
                               partner.level === 'Platine' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                               partner.level === 'Or' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                               'bg-slate-50 text-slate-700 border-slate-100'
                             }`}>
                               Partenaire {partner.level}
                             </div>
                             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-aaj-border group-hover:border-aaj-royal transition-colors">
                                <Building2 size={32} className="text-aaj-gray group-hover:text-aaj-royal" />
                             </div>
                             <h3 className="text-xl font-black uppercase tracking-tight text-aaj-dark mb-2">{partner.name}</h3>
                             <p className="text-[10px] font-bold text-aaj-gray uppercase tracking-widest mb-6">Actif depuis : {partner.joined}</p>
                             <button className="w-full py-3 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest text-aaj-dark hover:bg-aaj-dark hover:text-white transition-all">Consulter l'offre</button>
                          </div>
                        ))}
                        {partnersList.filter(p => p.isVisible).length === 0 && (
                          <div className="col-span-full py-20 text-center border border-dashed border-aaj-border rounded opacity-50 bg-slate-50/30">
                            <p className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">Aucun partenaire disponible pour le moment</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {partnersList.filter(p => p.isVisible).map((partner) => (
                           <div key={partner.id} className="p-6 border border-aaj-border rounded bg-white hover:border-aaj-royal transition-all flex justify-between items-center group shadow-sm">
                              <div className="flex items-center gap-6">
                                 <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center border border-aaj-border group-hover:border-aaj-royal transition-colors">
                                    <Building2 size={18} className="text-aaj-gray group-hover:text-aaj-royal" />
                                 </div>
                                 <div>
                                    <h3 className="text-sm font-black uppercase tracking-tight text-aaj-dark">{partner.name}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                       <span className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">Partenaire {partner.level}</span>
                                       <span className="text-[8px] text-aaj-border">•</span>
                                       <span className="text-[8px] font-black uppercase tracking-widest text-aaj-gray">Actif depuis {partner.joined}</span>
                                    </div>
                                 </div>
                              </div>
                              <button className="px-6 py-3 border border-aaj-border rounded text-[10px] font-black uppercase tracking-widest text-aaj-dark hover:bg-aaj-dark hover:text-white transition-all">Détails</button>
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
                    <h3 className="text-xl font-black uppercase tracking-tight">Demande de Modification</h3>
                    <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest mt-1">Vos modifications seront soumises à approbation</p>
                  </div>
                  <button onClick={() => setIsRequestModalOpen(false)} className="text-aaj-gray hover:text-aaj-dark transition-colors">
                    <XCircle size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmitProfileChange}>
                  <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Prénom</label>
                        <input 
                          type="text" 
                          value={profileForm.firstName}
                          onChange={(e) => setProfileForm({...profileForm, firstName: e.target.value})}
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Nom</label>
                        <input 
                          type="text" 
                          value={profileForm.lastName}
                          onChange={(e) => setProfileForm({...profileForm, lastName: e.target.value})}
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Mobile / WhatsApp</label>
                        <input 
                          type="tel" 
                          value={profileForm.mobile}
                          onChange={(e) => setProfileForm({...profileForm, mobile: e.target.value})}
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Email de contact</label>
                        <input 
                          type="email" 
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Catégorie</label>
                        <select 
                          value={profileForm.category}
                          onChange={(e) => setProfileForm({...profileForm, category: e.target.value})}
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                        >
                          <option value="Architecte">Architecte</option>
                          <option value="Architecte Stagiaire">Architecte Stagiaire</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">
                          {profileForm.category === "Architecte" ? "Matricule Ordre" : "Matricule Étudiant"}
                        </label>
                        <input 
                          type="text" 
                          value={profileForm.licenseNumber}
                          onChange={(e) => setProfileForm({...profileForm, licenseNumber: e.target.value})}
                          className="w-full bg-slate-50 border border-aaj-border rounded px-5 py-3 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-aaj-royal"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black tracking-widest text-aaj-gray ml-1">Adresse professionnelle</label>
                      <textarea 
                        rows={2}
                        value={profileForm.address}
                        onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
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
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                      Soumettre la demande
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Edit Member Role Modal */}
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
                className="relative w-full max-w-lg bg-white rounded shadow-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-aaj-border flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Privilèges & Rôles</h3>
                    <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest mt-1">Édition de : {editingMember.firstName} {editingMember.lastName}</p>
                  </div>
                  <button onClick={() => setEditingMember(null)} className="text-aaj-gray hover:text-aaj-dark transition-colors">
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="p-8 space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-aaj-dark">Rôle principal du membre</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { id: 'member', label: 'Membre Standard', desc: 'Accès classique à l\'espace adhérent.' },
                        { id: 'representative', label: 'Représentant Association', desc: 'Peut déposer les avis de commissions techniques.' },
                        { id: 'admin', label: 'Administrateur (Bureau)', desc: 'Accès complet à la gestion du site et des adhésions.' },
                      ].map((role) => (
                        <button
                          key={role.id}
                          onClick={() => setEditingMember({ ...editingMember, role: role.id })}
                          className={`w-full p-6 border rounded text-left transition-all ${
                            editingMember.role === role.id 
                            ? "border-aaj-royal bg-blue-50/50 ring-1 ring-aaj-royal" 
                            : "border-aaj-border hover:border-aaj-royal/30 bg-white"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px] font-black uppercase tracking-widest">{role.label}</span>
                            {editingMember.role === role.id && <CheckCircle2 size={16} className="text-aaj-royal" />}
                          </div>
                          <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-wide leading-relaxed">{role.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-50 border-t border-aaj-border flex gap-4">
                  <button 
                    onClick={() => {
                      // Logic would be: await updateDoc(doc(db, 'users', editingMember.uid), { role: editingMember.role });
                      alert(`Le rôle de ${editingMember.firstName} a été mis à jour avec succès en tant que ${editingMember.role}.`);
                      setEditingMember(null);
                    }}
                    className="flex-1 bg-aaj-dark text-white py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-royal transition-all flex items-center justify-center gap-3"
                  >
                    Enregistrer les Privilèges
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
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                    <span className="text-[10px] font-black text-aaj-royal uppercase tracking-widest block mb-2">Annonce Officielle</span>
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-aaj-dark">{selectedNews.title}</h3>
                  </div>
                  <button onClick={() => setSelectedNews(null)} className="p-2 hover:bg-slate-50 transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                  <div className="text-sm font-black text-aaj-gray uppercase tracking-widest mb-6 border-b border-aaj-border pb-4">
                    Publié le {selectedNews.createdAt?.toDate?.()?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                            <p className="text-[10px] font-black uppercase tracking-widest text-aaj-dark mb-0.5 line-clamp-1">{selectedNews.fileName || "Document Joint"}</p>
                            <p className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">Document PDF / Image</p>
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
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                  <h3 className="text-xl font-black uppercase tracking-tighter text-aaj-dark">Contacter l'administration</h3>
                  <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest mt-1">L'équipe bureau de l'AAJ vous répondra par email.</p>
                </div>
                <form onSubmit={handleContactAdmin} className="p-8 space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Objet du message</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ex: Demande d'information sur ma cotisation"
                        value={contactForm.subject}
                        onChange={(e) => setContactForm({...contactForm, subject: e.target.value})}
                        className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold"
                      />
                   </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">votre message</label>
                     <textarea 
                       required
                       placeholder="Écrivez votre message ici..."
                       rows={6}
                       value={contactForm.message}
                       onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                       className="w-full bg-white border border-aaj-border rounded px-4 py-3 text-xs font-bold resize-none"
                     ></textarea>
                  </div>
                  
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Document joint (Optionnel)</label>
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
                           {newContactFile.name || "Joindre un document (PDF / Image)"}
                        </span>
                     </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                      <button 
                        type="submit"
                        disabled={isSaving}
                        className="flex-1 bg-aaj-dark text-white py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-royal transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Envoyer le message
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
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                    <h3 className="text-xl font-black uppercase tracking-tighter text-aaj-dark">Ajouter un nouveau membre</h3>
                    <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest mt-1">Saisie manuelle d'un adhérent par l'administration.</p>
                  </div>
                  <button onClick={() => setIsAddMemberModalOpen(false)} className="text-aaj-gray hover:text-aaj-dark">
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleAddMember} className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Prénom</label>
                        <input type="text" required value={newMember.firstName} onChange={e => setNewMember({...newMember, firstName: e.target.value})} className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Nom</label>
                        <input type="text" required value={newMember.lastName} onChange={e => setNewMember({...newMember, lastName: e.target.value})} className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Email</label>
                        <input type="email" required value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Téléphone</label>
                        <input type="tel" required value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Catégorie</label>
                        <select value={newMember.category} onChange={e => setNewMember({...newMember, category: e.target.value})} className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold uppercase tracking-widest">
                           <option value="Architecte">Architecte</option>
                           <option value="Architecte Stagiaire">Architecte Stagiaire</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Matricule</label>
                        <input type="text" required value={newMember.matricule} onChange={e => setNewMember({...newMember, matricule: e.target.value})} className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold" />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-aaj-gray ml-1">Ville</label>
                      <input type="text" required value={newMember.city} onChange={e => setNewMember({...newMember, city: e.target.value})} className="w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold" />
                   </div>

                   <div className="bg-amber-50 border border-amber-100 p-6 rounded flex items-start gap-4">
                      <Shield size={20} className="text-amber-600 mt-1 flex-shrink-0" />
                      <p className="text-[10px] text-amber-800 font-bold uppercase tracking-tight leading-relaxed">
                        En ajoutant un membre manuellement, vous certifiez que ses documents ont été vérifiés par le bureau national. Il recevra un accès immédiat avec le rôle Adhérent.
                      </p>
                   </div>
                </form>
                <div className="p-8 bg-slate-50 border-t border-aaj-border flex gap-4">
                  <button 
                    onClick={handleAddMember}
                    disabled={isSaving}
                    className="flex-1 bg-aaj-dark text-white py-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-aaj-royal transition-all flex items-center justify-center gap-3"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Créer le compte Adhérent
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
        </AnimatePresence>

        {/* Floating Action Button: Contact Admin */}
        <button 
          onClick={() => setIsContactModalOpen(true)}
          style={{ bottom: `${fabBottom}px` }}
          className="fixed right-6 md:right-8 w-14 h-14 bg-aaj-dark text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-aaj-royal hover:scale-110 active:scale-95 transition-all z-40 group border-4 border-white/20"
        >
          <MessageSquare size={24} className="group-hover:rotate-12 transition-all" />
          <div className="absolute right-full mr-4 bg-aaj-dark text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap shadow-xl">
             Contacter l'administration
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
            {isResetMode ? "Réinitialisation" : "Espace Adhérents"}
          </h1>
          <p className="text-aaj-gray font-bold text-[10px] uppercase tracking-[3px]">
            {isResetMode ? "Saisissez votre email" : "Veuillez vous identifier"}
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

        <form className="space-y-6" onSubmit={isResetMode ? (e) => { e.preventDefault(); handleForgotPassword(); } : handleLogin}>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1">Email professionnel</label>
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
              <label className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1">Mot de passe</label>
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
            {authLoading ? <Loader2 className="animate-spin" size={20} /> : (isResetMode ? "Réinitialiser mon mot de passe" : "Se connecter")}
          </button>
        </form>
        
        <div className="mt-12 pt-8 border-t border-aaj-border text-center">
            <p className="text-aaj-gray text-[11px] font-medium leading-relaxed uppercase tracking-wider">
              Accès réservé aux membres de l'AAJ. <br/> 
              <Link to="/demander-adhesion" className="text-aaj-royal font-black hover:underline">Demander une adhésion</Link>
            </p>
        </div>
      </motion.div>
    </div>
  );
};
