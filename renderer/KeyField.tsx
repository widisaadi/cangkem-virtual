import { useState } from 'react';

export default function KeyField({ value, onChange, saved, disabled }: {
  value: string; onChange: (value: string) => void; saved: boolean; disabled: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return <input id="groq-key" type="password" autoComplete="new-password" spellCheck={false}
    aria-label={saved ? 'API key saved. Enter a new key to replace it.' : 'Groq API key'}
    placeholder={saved ? '••••••••••••••••' : 'Enter your Groq API key'}
    value={value || (saved && !focused ? '••••••••••••••••' : '')}
    disabled={disabled} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onChange={event => onChange(event.target.value)} />;
}
