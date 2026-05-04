import { useState, useCallback } from 'react';
import { AVATARS } from '../content/avatars';
import type { Persona } from '../hooks/usePersona';

interface PersonaSetupProps {
  initialPersona?: Persona | null;
  onComplete: (persona: Persona) => void;
  onSkip?: () => void;
}

export function PersonaSetup({ initialPersona, onComplete, onSkip }: PersonaSetupProps) {
  const [name, setName] = useState(initialPersona?.name ?? '');
  const [avatarId, setAvatarId] = useState(initialPersona?.avatarId ?? '');

  const canSubmit = name.trim().length > 0 && avatarId.length > 0;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onComplete({ name: name.trim(), avatarId });
  }, [canSubmit, name, avatarId, onComplete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) handleSubmit();
    if (e.key === 'Escape' && onSkip) onSkip();
  }, [canSubmit, handleSubmit, onSkip]);

  return (
    <div className="persona-setup" role="dialog" aria-modal="true" aria-label="Agent Persona Setup" onKeyDown={handleKeyDown}>
      <div className="persona-setup__card">
        <h2 className="persona-setup__title">Name Your Agent</h2>
        <p className="persona-setup__subtitle">
          Give your AI agent an identity. Pick a name and choose an avatar.
        </p>

        <div className="persona-setup__field">
          <label className="persona-setup__label" htmlFor="persona-name">Agent Name</label>
          <input
            id="persona-name"
            className="persona-setup__input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Neo, Morpheus, Trinity..."
            maxLength={24}
            autoFocus
          />
        </div>

        <div className="persona-setup__field">
          <label className="persona-setup__label">Avatar</label>
          <div className="persona-setup__avatars">
            {AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                className={`persona-setup__avatar${avatarId === avatar.id ? ' persona-setup__avatar--selected' : ''}`}
                onClick={() => setAvatarId(avatar.id)}
                title={avatar.label}
                type="button"
              >
                <span className="persona-setup__avatar-emoji">{avatar.emoji}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="persona-setup__actions">
          {onSkip && (
            <button className="persona-setup__btn persona-setup__btn--skip" onClick={onSkip} type="button">
              Skip
            </button>
          )}
          <button
            className="persona-setup__btn persona-setup__btn--submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            type="button"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
