/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * <PasswordInput /> — drop-in replacement for `<input type="password">` with a
 * built-in show/hide toggle (eye icon). Forwards refs and all native input
 * props except `type` (always managed internally).
 *
 * The toggle button is intentionally `tabIndex={-1}` so it doesn't break the
 * normal Tab order through forms (you don't want Tab to land on the eye when
 * the user is typing → confirming).
 */

import { useState, forwardRef, InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  ({ className = '', style, ...rest }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={className}
          // Inline padding-right wins over Tailwind classes so we don't have to
          // worry about utility ordering for padding overrides on every caller.
          style={{ paddingRight: '2.75rem', ...style }}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={
            visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
          }
          title={visible ? 'Masquer' : 'Afficher'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-aaj-gray hover:text-aaj-dark transition-colors p-1 rounded focus:outline-none focus:ring-1 focus:ring-aaj-royal"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
