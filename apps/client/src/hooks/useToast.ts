import { create } from 'zustand';

export interface ToastItem {
  id: number;
  type: 'success' | 'error';
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (type: ToastItem['type'], message: string) => void;
  dismissToast: (id: number) => void;
}

let nextId = 1;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  showToast: (type, message) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
