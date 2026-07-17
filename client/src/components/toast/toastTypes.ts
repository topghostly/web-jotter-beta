export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastApi {
  info: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}
