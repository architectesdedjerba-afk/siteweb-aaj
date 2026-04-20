/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../lib/firebase";
import { motion } from "motion/react";
import { Shield, Loader2, CheckCircle2, XCircle, ArrowLeft, Key } from "lucide-react";

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get("oobCode");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!oobCode) {
      setError("Le lien de réinitialisation est invalide ou a expiré.");
      setLoading(false);
      return;
    }

    // Verify the password reset code
    verifyPasswordResetCode(auth, oobCode)
      .then((userEmail) => {
        setEmail(userEmail);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Verification error:", err);
        setError("Le lien de réinitialisation est invalide ou a expiré.");
        setLoading(false);
      });
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (!oobCode) return;

    setError(null);
    setSubmitting(true);
    
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
    } catch (err: any) {
      console.error("Reset confirmation error:", err);
      setError("Une erreur est survenue lors de la réinitialisation du mot de passe.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-aaj-royal" size={48} />
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen bg-white flex items-center justify-center px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 lg:p-14 border border-aaj-border"
      >
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-aaj-soft rounded flex items-center justify-center text-aaj-royal mx-auto mb-6 border border-aaj-royal/10">
            <Key size={40} />
          </div>
          <h1 className="text-3xl font-black mb-2 uppercase tracking-tight">Réinitialisation</h1>
          <p className="text-aaj-gray font-bold text-[10px] uppercase tracking-[3px]">
            {success ? "Mot de passe modifié" : `Nouveau mot de passe pour ${email}`}
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 text-red-600 rounded border border-red-100 text-[11px] font-bold uppercase tracking-wider flex items-center gap-3">
            <XCircle size={16} />
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-8 text-center">
            <div className="p-4 bg-green-50 text-green-600 rounded border border-green-100 text-[11px] font-bold uppercase tracking-wider flex items-center gap-3 justify-center">
              <CheckCircle2 size={16} />
              Votre mot de passe a été réinitialisé avec succès.
            </div>
            <Link 
              to="/espace-adherents" 
              className="inline-block w-full bg-aaj-dark text-white py-5 rounded font-black uppercase tracking-[3px] text-xs hover:bg-aaj-royal transition-all"
            >
              Retour à la connexion
            </Link>
          </div>
        ) : error && !email ? (
          <div className="text-center">
             <Link 
              to="/espace-adherents" 
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[3px] text-aaj-royal hover:underline"
            >
              <ArrowLeft size={16} /> Retour à l'espace adhérents
            </Link>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1">Nouveau mot de passe</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-aaj-border rounded px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal focus:bg-white transition-all text-sm font-medium"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-[2px] text-aaj-gray ml-1">Confirmer le mot de passe</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 border border-aaj-border rounded px-6 py-4 focus:outline-none focus:ring-1 focus:ring-aaj-royal focus:bg-white transition-all text-sm font-medium"
                placeholder="••••••••"
                required
              />
            </div>
            <button 
              type="submit"
              disabled={submitting}
              className="w-full bg-aaj-dark text-white py-5 rounded font-black uppercase tracking-[3px] text-xs hover:bg-aaj-royal transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : "Réinitialiser mon mot de passe"}
            </button>
            <div className="text-center pt-4">
               <Link 
                to="/espace-adherents" 
                className="text-[10px] font-black uppercase tracking-[3px] text-aaj-gray hover:text-aaj-dark transition-colors"
              >
                Annuler
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
