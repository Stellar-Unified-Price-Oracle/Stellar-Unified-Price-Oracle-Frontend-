import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'preferences.keyboardShortcuts';

export type ShortcutAction =
  | 'commandPalette'
  | 'navigateUp'
  | 'navigateDown'
  | 'navigateLeft'
  | 'navigateRight'
  | 'closeModal';

export type ShortcutBindings = Record<ShortcutAction, string>;

export const DEFAULT_BINDINGS: ShortcutBindings = {
  commandPalette: 'mod+k',
  navigateUp: 'k',
  navigateDown: 'j',
  navigateLeft: 'h',
  navigateRight: 'l',
  closeModal: 'escape',
};

const ACTION_LABELS: Record<ShortcutAction, string> = {
  commandPalette: 'Open command palette',
  navigateUp: 'Navigate up',
  navigateDown: 'Navigate down',
  navigateLeft: 'Navigate left',
  navigateRight: 'Navigate right',
  closeModal: 'Close modal',
};

const ACTIONS = Object.keys(DEFAULT_BINDINGS) as ShortcutAction[];

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function loadBindings(): ShortcutBindings {
  if (typeof window === 'undefined') return { ...DEFAULT_BINDINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    const parsed = JSON.parse(raw) as Partial<ShortcutBindings>;
    const merged = { ...DEFAULT_BINDINGS };
    for (const action of ACTIONS) {
      const value = parsed[action];
      if (typeof value === 'string' && value.trim()) {
        merged[action] = normalizeKey(value);
      }
    }
    return merged;
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

export function saveBindings(bindings: ShortcutBindings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Ignore persistence failures (private mode, quota, etc.).
  }
}

export function findConflicts(bindings: ShortcutBindings): Record<string, ShortcutAction[]> {
  const byKey: Record<string, ShortcutAction[]> = {};
  for (const action of ACTIONS) {
    const key = normalizeKey(bindings[action]);
    if (!key) continue;
    (byKey[key] ??= []).push(action);
  }
  const conflicts: Record<string, ShortcutAction[]> = {};
  for (const [key, actions] of Object.entries(byKey)) {
    if (actions.length > 1) conflicts[key] = actions;
  }
  return conflicts;
}

interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
  const [bindings, setBindings] = useState<ShortcutBindings>(() => loadBindings());
  const [editing, setEditing] = useState<ShortcutAction | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (open) setBindings(loadBindings());
  }, [open]);

  const conflicts = useMemo(() => findConflicts(bindings), [bindings]);

  const commit = useCallback((next: ShortcutBindings) => {
    setBindings(next);
    saveBindings(next);
  }, []);

  const startEditing = (action: ShortcutAction) => {
    setEditing(action);
    setDraft(bindings[action]);
  };

  const applyDraft = () => {
    if (!editing) return;
    const value = normalizeKey(draft);
    if (!value) return;
    commit({ ...bindings, [editing]: value });
    setEditing(null);
    setDraft('');
  };

  const resetToDefaults = () => {
    commit({ ...DEFAULT_BINDINGS });
    setEditing(null);
    setDraft('');
  };

  if (!open) return null;

  return (
    <div className="shortcut-help-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="shortcut-help">
        <header className="shortcut-help__header">
          <h2>Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} aria-label="Close shortcut help">
            ×
          </button>
        </header>

        {Object.keys(conflicts).length > 0 && (
          <div className="shortcut-help__conflicts" role="alert">
            {Object.entries(conflicts).map(([key, actions]) => (
              <p key={key}>
                Conflict: <code>{key}</code> is bound to{' '}
                {actions.map((a) => ACTION_LABELS[a]).join(', ')}.
              </p>
            ))}
          </div>
        )}

        <ul className="shortcut-help__list">
          {ACTIONS.map((action) => {
            const key = bindings[action];
            const hasConflict = Boolean(conflicts[key]);
            return (
              <li key={action} className={hasConflict ? 'shortcut-help__row shortcut-help__row--conflict' : 'shortcut-help__row'}>
                <span className="shortcut-help__label">{ACTION_LABELS[action]}</span>
                {editing === action ? (
                  <span className="shortcut-help__editor">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyDraft();
                        if (e.key === 'Escape') {
                          setEditing(null);
                          setDraft('');
                        }
                      }}
                      aria-label={`New binding for ${ACTION_LABELS[action]}`}
                    />
                    <button type="button" onClick={applyDraft}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="shortcut-help__key"
                    onClick={() => startEditing(action)}
                    aria-label={`Rebind ${ACTION_LABELS[action]}, currently ${key}`}
                  >
                    <kbd>{key}</kbd>
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <footer className="shortcut-help__footer">
          <button type="button" onClick={resetToDefaults}>
            Reset to defaults
          </button>
        </footer>
      </div>
    </div>
  );
}
