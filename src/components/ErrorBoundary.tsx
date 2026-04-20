/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    let errorInfo = error.message;
    try {
      // Check if it's our JSON string error from Firebase
      const parsed = JSON.parse(error.message);
      if (parsed.error) {
        errorInfo = `Firebase Error: ${parsed.error} (Operation: ${parsed.operationType})`;
      }
    } catch {
      // Not a JSON error, use raw message
    }
    return { hasError: true, errorInfo };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Oups ! Quelque chose s'est mal passé.</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Une erreur inattendue est survenue lors de l'accès aux données. 
              {this.state.errorInfo && <span className="block mt-2 font-mono text-xs bg-slate-50 p-2 rounded">{this.state.errorInfo}</span>}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-aaj-dark text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-aaj-royal transition-all"
            >
              <RefreshCw size={16} />
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
