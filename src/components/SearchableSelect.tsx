/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  required = false,
  disabled = false,
  id,
  className = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQuery('');
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full bg-slate-50/50 border border-aaj-border rounded px-4 py-3 text-xs font-bold text-left flex items-center justify-between gap-2 ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-100/50'
        }`}
      >
        <span className={value ? 'text-aaj-dark' : 'text-aaj-gray'}>{value || placeholder}</span>
        <ChevronDown
          size={14}
          className={`text-aaj-gray transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {/* hidden native input to support form `required` validation */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          required
          onChange={() => {}}
          onFocus={(e) => e.target.blur()}
          className="absolute left-4 bottom-0 h-0 w-0 opacity-0 pointer-events-none"
        />
      )}
      {open && (
        <div className="absolute z-40 mt-2 w-full bg-white border border-aaj-border rounded shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-aaj-border bg-slate-50">
            <Search size={14} className="text-aaj-gray" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher..."
              className="flex-1 bg-transparent text-xs font-bold outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-aaj-gray">
                <X size={12} />
              </button>
            )}
          </div>
          <ul className="max-h-60 overflow-y-auto custom-scrollbar">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-[11px] text-aaj-gray italic">Aucun résultat</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-50 transition-colors ${
                      opt === value ? 'bg-aaj-dark/5 text-aaj-royal' : 'text-aaj-dark'
                    }`}
                  >
                    {opt}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
