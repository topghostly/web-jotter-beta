import { useContext } from "react";
import { ToastContext } from "./ToastProvider.tsx";
import type { ToastApi } from "./toastTypes.ts";

export function useToast(): ToastApi {
  const toastApi = useContext(ToastContext);
  if (!toastApi) throw new Error("useToast must be used inside <ToastProvider>");
  return toastApi;
}
