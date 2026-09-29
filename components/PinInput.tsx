'use client';

import { useId, useRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  name?: string;
  autoFocus?: boolean;
  invalid?: boolean;
};

/** Six-digit PIN field: one real input (so password managers and paste work) drawn as six cells. */
export function PinInput({ value, onChange, label, autoComplete, name, autoFocus, invalid }: Props) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`pin${focused ? ' focused' : ''}${invalid ? ' invalid' : ''}`} onClick={() => ref.current?.focus()}>
        <input
          ref={ref}
          id={id}
          name={name}
          className="pin-input"
          type="password"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-invalid={invalid || undefined}
        />
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`pin-cell${i < value.length ? ' filled' : ''}${focused && i === Math.min(value.length, 5) ? ' active' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
