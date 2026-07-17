import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Toaster from "./Toaster.tsx";
import type { Toast, ToastApi, ToastKind } from "./toastTypes.ts";

const DURATION_MS: Record<ToastKind, number> = {
  info: 4000,
  success: 4000,
  error: 6000,
};
const MAX_VISIBLE = 3;

export const ToastContext = createContext<ToastApi | null>(null);

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, number>());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const startTimer = useCallback(
    (id: number, kind: ToastKind) => {
      const old = timers.current.get(id);
      if (old !== undefined) window.clearTimeout(old);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), DURATION_MS[kind]),
      );
    },
    [dismiss],
  );

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      setToasts((prev) => {
        // Duplicate suppression: refresh the timer instead of stacking a copy.
        const existing = prev.find(
          (t) => t.kind === kind && t.message === message,
        );
        if (existing) {
          startTimer(existing.id, kind);
          return prev;
        }
        const id = nextId.current++;
        startTimer(id, kind);
        const next = [...prev, { id, kind, message }];
        for (const dropped of next.slice(0, -MAX_VISIBLE)) {
          const timer = timers.current.get(dropped.id);
          if (timer !== undefined) window.clearTimeout(timer);
          timers.current.delete(dropped.id);
        }
        return next.slice(-MAX_VISIBLE);
      });
    },
    [startTimer],
  );

  const toastApi = useMemo<ToastApi>(
    () => ({
      info: (message) => show("info", message),
      success: (message) => show("success", message),
      error: (message) => show("error", message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
