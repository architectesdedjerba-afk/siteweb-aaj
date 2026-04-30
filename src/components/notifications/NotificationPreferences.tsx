/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NotificationPreferences — panneau de personnalisation des canaux de
 * notification par type. Permet d’activer/désactiver le canal in-app et
 * le canal email pour chaque catégorie ; expose aussi un kill-switch
 * global ("all") pour couper toutes les notifications.
 */

import { useMemo, useState } from 'react';
import { BellOff, BellRing, Loader2, Save } from 'lucide-react';
import {
  useNotifications,
  NOTIFICATION_TYPES,
  NotificationTypeMeta,
  filterNotificationTypesForUser,
} from '../../lib/NotificationContext';
import { useAuth } from '../../lib/AuthContext';

const KILL_SWITCH_TYPE = 'all';

export const NotificationPreferences = () => {
  const { getPreference, setPreference, refresh } = useNotifications();
  const { can, isSuperAdmin } = useAuth();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const visibleTypes = useMemo(
    () => filterNotificationTypesForUser(NOTIFICATION_TYPES, { can, isSuperAdmin }),
    [can, isSuperAdmin],
  );

  const killSwitch = getPreference(KILL_SWITCH_TYPE);
  const allDisabled = killSwitch && killSwitch.inApp === false && killSwitch.email === false;

  const update = async (
    type: string,
    channel: 'inApp' | 'email',
    value: boolean,
    label: string,
  ) => {
    const key = `${type}:${channel}`;
    setBusyKey(key);
    try {
      await setPreference(type, { [channel]: value });
    } catch (err) {
      console.error(`[notifications] preference ${label} failed`, err);
    } finally {
      setBusyKey(null);
    }
  };

  const toggleAll = async (value: boolean) => {
    setBusyKey('all');
    try {
      await setPreference(KILL_SWITCH_TYPE, { inApp: value, email: value });
      await refresh();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-aaj-dark uppercase tracking-wider">
            Préférences de notification
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Choisissez par catégorie les canaux par lesquels vous souhaitez être averti.
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggleAll(allDisabled ? true : false)}
          disabled={busyKey === 'all'}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors ${
            allDisabled
              ? 'bg-aaj-royal text-white hover:bg-aaj-dark'
              : 'border border-red-200 text-red-700 hover:bg-red-50'
          }`}
        >
          {busyKey === 'all' ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : allDisabled ? (
            <BellRing size={14} aria-hidden="true" />
          ) : (
            <BellOff size={14} aria-hidden="true" />
          )}
          {allDisabled ? 'Tout réactiver' : 'Tout désactiver'}
        </button>
      </header>

      {allDisabled && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Toutes les notifications sont actuellement désactivées. Réactivez-les pour
          ajuster les canaux par catégorie.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="text-left font-semibold px-4 py-2.5">Catégorie</th>
              <th className="text-center font-semibold px-3 py-2.5 w-24">In‑app</th>
              <th className="text-center font-semibold px-3 py-2.5 w-24">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleTypes.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-xs text-slate-500"
                >
                  Aucune catégorie de notification n’est applicable à votre profil.
                </td>
              </tr>
            ) : (
              visibleTypes.map((meta) => (
                <PreferenceRow
                  key={meta.type}
                  meta={meta}
                  pref={getPreference(meta.type)}
                  disabled={!!allDisabled}
                  busyKey={busyKey}
                  onChange={update}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Les préférences sont enregistrées automatiquement à chaque modification.
        L’email reste optionnel et n’est envoyé que lorsqu’un envoi automatique est
        prévu pour la catégorie concernée.
      </p>
    </div>
  );
};

interface PreferenceRowProps {
  meta: NotificationTypeMeta;
  pref?: ReturnType<ReturnType<typeof useNotifications>['getPreference']>;
  disabled: boolean;
  busyKey: string | null;
  onChange: (type: string, channel: 'inApp' | 'email', value: boolean, label: string) => void;
}

const PreferenceRow = ({ meta, pref, disabled, busyKey, onChange }: PreferenceRowProps) => {
  // Valeurs par défaut : in-app activé, email désactivé.
  const inApp = pref?.inApp ?? true;
  const email = pref?.email ?? false;

  return (
    <tr className={disabled ? 'opacity-50' : ''}>
      <td className="px-4 py-3 align-top">
        <div className="font-semibold text-slate-800">{meta.label}</div>
        <div className="text-xs text-slate-500 mt-0.5 max-w-prose">{meta.description}</div>
      </td>
      <td className="px-3 py-3 text-center">
        <ToggleSwitch
          checked={inApp}
          disabled={disabled || busyKey === `${meta.type}:inApp`}
          onChange={(v) => onChange(meta.type, 'inApp', v, `${meta.label} in-app`)}
          ariaLabel={`Notifications in-app pour ${meta.label}`}
        />
      </td>
      <td className="px-3 py-3 text-center">
        <ToggleSwitch
          checked={email}
          disabled={disabled || busyKey === `${meta.type}:email`}
          onChange={(v) => onChange(meta.type, 'email', v, `${meta.label} email`)}
          ariaLabel={`Notifications email pour ${meta.label}`}
        />
      </td>
    </tr>
  );
};

interface ToggleSwitchProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  ariaLabel: string;
}

const ToggleSwitch = ({ checked, disabled, onChange, ariaLabel }: ToggleSwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      checked ? 'bg-aaj-royal' : 'bg-slate-300'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

/** Petit indicateur réutilisable pour signaler une sauvegarde en cours. */
export const NotificationPreferencesSaving = ({ saving }: { saving: boolean }) => {
  if (!saving) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <Save size={12} aria-hidden="true" /> Sauvegarde…
    </span>
  );
};
