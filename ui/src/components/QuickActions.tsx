import { useEffect, useRef, useState } from 'react';
import { QUICK_ACTIONS, type QuickAction } from '../content/quickActions';

interface QuickActionsProps {
  onSend: (prompt: string) => void;
  disabled: boolean;
}

export function QuickActions({ onSend, disabled }: QuickActionsProps) {
  const [preview, setPreview] = useState<QuickAction | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  function handleConfirm() {
    if (preview) {
      onSend(preview.prompt);
      setPreview(null);
    }
  }

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreview(null);
    }
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [preview]);

  return (
    <div className="quick-actions">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.id}
          className={`quick-actions__btn quick-actions__btn--${action.category}`}
          onClick={() => setPreview(action)}
          disabled={disabled}
          title={action.label}
        >
          <span className="quick-actions__icon">{action.icon}</span>
          {action.label}
        </button>
      ))}

      {preview && (
        <div className="quick-actions__overlay" onClick={() => setPreview(null)} role="presentation">
          <div
            ref={dialogRef}
            className={`quick-actions__preview quick-actions__preview--${preview.category}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview: ${preview.label}`}
            tabIndex={-1}
          >
            <div className="quick-actions__preview-header">
              <span className="quick-actions__preview-icon">{preview.icon}</span>
              <span className="quick-actions__preview-title">{preview.label}</span>
            </div>
            <pre className="quick-actions__preview-body">{preview.prompt}</pre>
            <div className="quick-actions__preview-actions">
              <button
                className="quick-actions__preview-btn quick-actions__preview-btn--cancel"
                onClick={() => setPreview(null)}
              >
                Cancel
              </button>
              <button
                className={`quick-actions__preview-btn quick-actions__preview-btn--send quick-actions__preview-btn--${preview.category}`}
                onClick={handleConfirm}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
