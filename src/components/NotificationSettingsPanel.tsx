/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * <NotificationSettingsPanel /> — admin UI to manage the 6 transactional
 * email notifications: enable/disable, extra recipients, subject + HTML
 * templates with `{{variable}}` interpolation, and a "send test" button.
 *
 * Mounted from MemberSpace → Paramètres → "Mails de notifications".
 * Permission gate: super-admin OR `config_manage`.
 */

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Send,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  NotificationEventConfig,
  NotificationEventSchema,
  NotificationSettings,
  isValidEmail,
  loadNotificationSettings,
  saveNotificationSettings,
} from '../lib/notifications';

type Banner = { type: 'success' | 'error'; text: string } | null;

export function NotificationSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [schema, setSchema] = useState<NotificationEventSchema[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({ events: {} });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Load schema + current settings on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const schemaResp = await api.notifications.schema();
        if (cancelled) return;
        const defaults: Record<string, NotificationEventConfig> = {};
        for (const e of schemaResp.events) defaults[e.id] = e.defaults;
        const loaded = await loadNotificationSettings(defaults);
        if (cancelled) return;
        setSchema(schemaResp.events);
        setSettings(loaded);
        if (schemaResp.events.length > 0) setExpanded(schemaResp.events[0].id);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateEvent = (
    eventId: string,
    patch: Partial<NotificationEventConfig>
  ) => {
    setSettings((prev) => ({
      events: {
        ...prev.events,
        [eventId]: {
          ...(prev.events[eventId] ?? {
            enabled: true,
            extraRecipients: [],
          }),
          ...patch,
        },
      },
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setBanner(null);
    try {
      const saved = await saveNotificationSettings(settings);
      setSettings(saved);
      setDirty(false);
      setBanner({ type: 'success', text: 'Paramètres de notifications enregistrés.' });
    } catch (e: any) {
      setBanner({ type: 'error', text: e?.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetAllToDefaults = (eventId: string) => {
    const ev = schema.find((e) => e.id === eventId);
    if (!ev) return;
    if (
      !confirm(
        `Restaurer les valeurs par défaut pour "${ev.label}" ? Cela écrase l'objet, le HTML, les destinataires additionnels et l'activation.`
      )
    ) {
      return;
    }
    updateEvent(eventId, {
      ...ev.defaults,
      extraRecipients: [...ev.defaults.extraRecipients],
    });
  };

  if (loading) {
    return (
      <section className="border border-aaj-border rounded p-8 flex items-center justify-center">
        <Loader2 className="animate-spin text-aaj-royal" size={20} />
      </section>
    );
  }

  if (error) {
    return (
      <section className="border border-red-200 bg-red-50 rounded p-5">
        <div className="flex items-center gap-2 text-red-700 text-[11px] font-bold uppercase tracking-widest">
          <AlertCircle size={16} /> {error}
        </div>
      </section>
    );
  }

  return (
    <section className="border border-aaj-border rounded overflow-hidden">
      <div className="p-5 bg-slate-50 border-b border-aaj-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-aaj-dark flex items-center gap-2">
            <Bell size={14} /> Mails de notifications
          </h3>
          <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-wider mt-1">
            Activer / désactiver, destinataires additionnels, sujet et corps HTML par
            événement
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="bg-aaj-dark text-white px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="animate-spin" size={12} />
          ) : (
            <Save size={12} />
          )}
          {saving ? 'Sauvegarde…' : 'Enregistrer'}
        </button>
      </div>

      {banner && (
        <div
          className={`px-5 py-3 text-[11px] font-bold uppercase tracking-widest border-b ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="divide-y divide-aaj-border">
        {schema.map((ev) => {
          const cfg = settings.events[ev.id] ?? {
            enabled: true,
            extraRecipients: [],
          };
          const isOpen = expanded === ev.id;
          return (
            <EventBlock
              key={ev.id}
              schema={ev}
              cfg={cfg}
              isOpen={isOpen}
              onToggleOpen={() => setExpanded(isOpen ? null : ev.id)}
              onChange={(patch) => updateEvent(ev.id, patch)}
              onResetDefaults={() => handleResetAllToDefaults(ev.id)}
            />
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// EventBlock — accordion-style row per event
// ---------------------------------------------------------------------------

function EventBlock({
  schema,
  cfg,
  isOpen,
  onToggleOpen,
  onChange,
  onResetDefaults,
}: {
  schema: NotificationEventSchema;
  cfg: NotificationEventConfig;
  isOpen: boolean;
  onToggleOpen: () => void;
  onChange: (patch: Partial<NotificationEventConfig>) => void;
  onResetDefaults: () => void;
}) {
  return (
    <div className="bg-white">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex-1 flex items-center gap-3 text-left"
        >
          {isOpen ? (
            <ChevronDown size={14} className="text-aaj-gray flex-shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-aaj-gray flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black uppercase tracking-wider text-aaj-dark truncate">
              {schema.label}
            </div>
            <div className="text-[10px] text-aaj-gray font-bold uppercase tracking-wider truncate">
              {schema.id} · {schema.kind === 'dual' ? '2 templates' : '1 template'}
              {cfg.extraRecipients.length > 0
                ? ` · +${cfg.extraRecipients.length} destinataire${
                    cfg.extraRecipients.length > 1 ? 's' : ''
                  }`
                : ''}
            </div>
          </div>
        </button>
        <Toggle
          checked={cfg.enabled}
          onChange={(enabled) => onChange({ enabled })}
          label={cfg.enabled ? 'Activé' : 'Désactivé'}
        />
      </div>

      {isOpen && (
        <div className="px-5 pb-6 pt-2 space-y-6 bg-slate-50/40 border-t border-aaj-border">
          {/* Extra recipients */}
          <ExtraRecipientsEditor
            value={cfg.extraRecipients}
            onChange={(extraRecipients) => onChange({ extraRecipients })}
            disabled={!cfg.enabled}
          />

          {/* Variables panel — clickable chips that copy {{var}} */}
          <VariablesHelp vars={schema.vars} />

          {/* Templates */}
          {schema.kind === 'dual' ? (
            <>
              <TemplateEditor
                title="Email au demandeur (accusé de réception)"
                subjectKey="applicantSubject"
                htmlKey="applicantHtml"
                cfg={cfg}
                onChange={onChange}
                event={schema.id}
                testFieldKind="applicant"
                disabled={!cfg.enabled}
              />
              <TemplateEditor
                title="Email aux administrateurs"
                subjectKey="adminSubject"
                htmlKey="adminHtml"
                cfg={cfg}
                onChange={onChange}
                event={schema.id}
                testFieldKind="admin"
                disabled={!cfg.enabled}
              />
            </>
          ) : (
            <TemplateEditor
              title="Email"
              subjectKey="subject"
              htmlKey="html"
              cfg={cfg}
              onChange={onChange}
              event={schema.id}
              testFieldKind="single"
              disabled={!cfg.enabled}
            />
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onResetDefaults}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-aaj-gray hover:text-aaj-dark border border-aaj-border px-4 py-2 rounded transition-colors"
            >
              <RotateCcw size={12} /> Restaurer les valeurs par défaut
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      {label && (
        <span
          className={`text-[10px] font-black uppercase tracking-widest ${
            checked ? 'text-emerald-700' : 'text-aaj-gray'
          }`}
        >
          {label}
        </span>
      )}
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-aaj-royal' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Extra recipients (chips input)
// ---------------------------------------------------------------------------

function ExtraRecipientsEditor({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [warn, setWarn] = useState<string | null>(null);

  const add = () => {
    const email = draft.trim().toLowerCase();
    if (!email) return;
    if (!isValidEmail(email)) {
      setWarn('Email invalide.');
      return;
    }
    if (value.includes(email)) {
      setWarn('Email déjà dans la liste.');
      return;
    }
    onChange([...value, email]);
    setDraft('');
    setWarn(null);
  };

  return (
    <div>
      <label className="block text-[10px] uppercase font-black tracking-[2px] text-aaj-gray mb-2">
        Destinataires additionnels
      </label>
      <p className="text-[10px] text-aaj-gray mb-3">
        En plus des admins/super-admins. Ignorés si l&apos;événement est désactivé.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {value.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aaj-soft border border-aaj-royal/20 text-[11px] font-bold text-aaj-dark"
          >
            {email}
            <button
              type="button"
              onClick={() => onChange(value.filter((e) => e !== email))}
              disabled={disabled}
              className="text-aaj-gray hover:text-red-600 transition-colors"
              aria-label={`Retirer ${email}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {value.length === 0 && (
          <span className="text-[11px] text-aaj-gray italic">
            Aucun destinataire additionnel.
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setWarn(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="email@exemple.com"
          disabled={disabled}
          className="flex-1 bg-white border border-aaj-border rounded px-3 py-2 text-xs font-medium focus:outline-none focus:border-aaj-royal disabled:bg-slate-100 disabled:text-slate-400"
        />
        <button
          type="button"
          onClick={add}
          disabled={disabled || !draft.trim()}
          className="bg-aaj-dark text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center gap-2 disabled:opacity-40"
        >
          <Plus size={12} /> Ajouter
        </button>
      </div>
      {warn && (
        <p className="mt-2 text-[10px] text-red-600 font-bold uppercase tracking-wider">
          {warn}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variables help (clickable chips)
// ---------------------------------------------------------------------------

function VariablesHelp({
  vars,
}: {
  vars: Array<{ key: string; desc: string }>;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div>
      <label className="block text-[10px] uppercase font-black tracking-[2px] text-aaj-gray mb-2">
        Variables disponibles
      </label>
      <div className="flex flex-wrap gap-2">
        {vars.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`{{${v.key}}}`).then(() => {
                setCopied(v.key);
                setTimeout(() => setCopied(null), 1200);
              });
            }}
            title={v.desc}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono transition-all ${
              copied === v.key
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-aaj-border text-aaj-dark hover:border-aaj-royal hover:text-aaj-royal'
            }`}
          >
            {copied === v.key ? <Check size={10} /> : null}
            {`{{${v.key}}}`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-aaj-gray italic">
        Cliquez sur une variable pour copier sa balise. Survolez pour voir la description.
        Les variables préfixées par <code>:</code> insèrent du HTML brut (liens admin), celles
        préfixées par <code>nl2br:</code> conservent les sauts de ligne.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateEditor — subject + html textarea + send-test button
// ---------------------------------------------------------------------------

function TemplateEditor({
  title,
  subjectKey,
  htmlKey,
  cfg,
  onChange,
  event,
  testFieldKind,
  disabled,
}: {
  title: string;
  subjectKey: keyof NotificationEventConfig;
  htmlKey: keyof NotificationEventConfig;
  cfg: NotificationEventConfig;
  onChange: (patch: Partial<NotificationEventConfig>) => void;
  event: string;
  testFieldKind: 'applicant' | 'admin' | 'single';
  disabled?: boolean;
}) {
  const subject = (cfg[subjectKey] as string) ?? '';
  const html = (cfg[htmlKey] as string) ?? '';
  const [testTo, setTestTo] = useState('');
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const sendTest = async () => {
    if (!isValidEmail(testTo)) {
      setTestResult({ ok: false, text: 'Email destinataire invalide.' });
      return;
    }
    setSending(true);
    setTestResult(null);
    try {
      const r = await api.notifications.test(event, testFieldKind, testTo.trim());
      setTestResult({
        ok: !!r.ok,
        text: r.ok
          ? `Email de test envoyé à ${testTo}.`
          : `Échec d'envoi (vérifier la configuration SMTP).`,
      });
    } catch (e: any) {
      setTestResult({ ok: false, text: e?.message || "Erreur d'envoi." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border border-aaj-border rounded bg-white p-4 space-y-3">
      <h4 className="text-[11px] font-black uppercase tracking-widest text-aaj-dark">
        {title}
      </h4>
      <div>
        <label className="block text-[10px] uppercase font-black tracking-[2px] text-aaj-gray mb-1">
          Sujet
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => onChange({ [subjectKey]: e.target.value } as Partial<NotificationEventConfig>)}
          disabled={disabled}
          className="w-full bg-white border border-aaj-border rounded px-3 py-2 text-xs font-medium focus:outline-none focus:border-aaj-royal disabled:bg-slate-100 disabled:text-slate-400"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase font-black tracking-[2px] text-aaj-gray mb-1">
          Corps HTML
        </label>
        <textarea
          value={html}
          onChange={(e) => onChange({ [htmlKey]: e.target.value } as Partial<NotificationEventConfig>)}
          disabled={disabled}
          rows={10}
          className="w-full bg-white border border-aaj-border rounded px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:border-aaj-royal disabled:bg-slate-100 disabled:text-slate-400"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end pt-2 border-t border-aaj-border">
        <div className="flex-1">
          <label className="block text-[10px] uppercase font-black tracking-[2px] text-aaj-gray mb-1">
            Envoyer un email de test
          </label>
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="email@destinataire.com"
            className="w-full bg-white border border-aaj-border rounded px-3 py-2 text-xs font-medium focus:outline-none focus:border-aaj-royal"
          />
        </div>
        <button
          type="button"
          onClick={sendTest}
          disabled={sending || !testTo.trim()}
          className="bg-aaj-dark text-white px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-royal transition-all flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {sending ? (
            <Loader2 className="animate-spin" size={12} />
          ) : (
            <Send size={12} />
          )}
          {sending ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
      {testResult && (
        <div
          className={`p-2.5 rounded text-[11px] font-bold flex items-center gap-2 ${
            testResult.ok
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {testResult.ok ? <Check size={12} /> : <X size={12} />}
          {testResult.text}
        </div>
      )}
    </div>
  );
}

export default NotificationSettingsPanel;
