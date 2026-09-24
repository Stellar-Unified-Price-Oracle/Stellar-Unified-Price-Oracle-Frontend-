import { create } from 'zustand'
import type { Toast, ToastType } from '../context/ToastContext'

/**
 * Zustand store for toast notification state.
 *
 * Replaces the ToastContext's internal useState calls so that only components
 * subscribing to toast data re-render on changes, rather than the full tree
 * under ToastProvider.
 */
export interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
}

const DEFAULT_DURATION = 4000

// Timer registry — kept outside Zustand so timers don't trigger re-renders.
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast: Omit<Toast, 'id'>): string => {
    const id = crypto.randomUUID()
    const duration = toast.duration ?? DEFAULT_DURATION

    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))

    if (duration > 0) {
      const timer = setTimeout(() => get().removeToast(id), duration)
      timers.set(id, timer)
    }

    return id
  },

  removeToast: (id: string): void => {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))

/**
 * Show an error toast from outside the React tree (e.g. API client).
 * Delegates to the store's addToast action.
 */
export function showApiErrorToastFromStore(message: string): void {
  useToastStore.getState().addToast({ type: 'error' as ToastType, message })
}
