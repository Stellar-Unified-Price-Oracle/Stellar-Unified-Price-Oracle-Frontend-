import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ShortcutAction =
  | 'commandPalette'
  | 'navigateUp'
  | 'navigateDown'
  | 'navigateLeft'
  | 'navigateRight'
  | 'openSettings'
  | 'toggleHelp';

export type ShortcutBindings = Record<ShortcutAction, string>;

export const DEFAULT_SHORTCUTS: ShortcutBindings = {
  commandPalette: 'mod+k',
  navigateUp: 'k',
  navigateDown: 'j',
  navigateLeft: 'h',
  navigateRight: 'l',
  openSettings: 'mod+,',
  toggleHelp: 'shift+/',
};

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  commandPalette: 'Open command palette',
  navigateUp: 'Navigate up',
  navigateDown: 'Navigate down',
  navigateLeft: 'Navigate left',
  navigateRight: 'Navigate right',
  openSettings: 'Open settings',
  toggleHelp: 'Toggle shortcut help',
};

export interface ShortcutConflict {
  combo: string;
  actions: ShortcutAction[];
}

interface PreferencesState {
  shortcuts: ShortcutBindings;
  setShortcut: (action: ShortcutAction, combo: string) => void;
  resetShortcuts: () => void;
  getShortcutConflicts: () => ShortcutConflict[];
}

const normalizeCombo = (combo: string): string => combo.trim().toLowerCase();

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      shortcuts: { ...DEFAULT_SHORTCUTS },
      setShortcut: (action, combo) =>
        set((state) => ({
          shortcuts: { ...state.shortcuts, [action]: normalizeCombo(combo) },
        })),
      resetShortcuts: () => set({ shortcuts: { ...DEFAULT_SHORTCUTS } }),
      getShortcutConflicts: () => {
        const byCombo = new Map<string, ShortcutAction[]>();
        for (const [action, combo] of Object.entries(get().shortcuts) as [
          ShortcutAction,
          string,
        ][]) {
          const key = normalizeCombo(combo);
          if (!key) continue;
          const actions = byCombo.get(key) ?? [];
          actions.push(action);
          byCombo.set(key, actions);
        }
        const conflicts: ShortcutConflict[] = [];
        for (const [combo, actions] of byCombo) {
          if (actions.length > 1) conflicts.push({ combo, actions });
        }
        return conflicts;
      },
    }),
    {
      name: 'preferences',
      partialize: (state) => ({ shortcuts: state.shortcuts }),
    },
  ),
);
