import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import type { Toast, ToastKind } from "./toastTypes.ts";
import styles from "./Toast.module.css";

interface ToasterProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const ICONS: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

export default function Toaster({ toasts, onDismiss }: ToasterProps) {
  return (
    <div className={styles.stack} aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            className={[styles.toast, styles[toast.kind]]
              .filter(Boolean)
              .join(" ")}
            role={toast.kind === "error" ? "alert" : "status"}
          >
            <span className={styles.icon} aria-hidden="true">
              <Icon size={16} />
            </span>
            <p className={styles.message}>{toast.message}</p>
            <button
              type="button"
              className={styles.close}
              aria-label="Dismiss notification"
              onClick={() => onDismiss(toast.id)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
