import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../components/toast/useToast.ts";
import { ApiError } from "../../lib/api.ts";
import { updateSettings as apiUpdateSettings } from "./settingsApi.ts";
import { applyTheme, type Settings } from "./settingsStore.ts";

export function useSettings(initialSettings: Settings) {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const hadFailure = useRef(false);
  const pendingRef = useRef<Partial<Settings>>({});

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      // Carry unconfirmed fields from failed saves into every PATCH, so a
      // failed change is retried by the next settings change.
      const sent: Partial<Settings> = { ...pendingRef.current, ...patch };
      pendingRef.current = sent;
      apiUpdateSettings(sent)
        .then(() => {
          for (const key of Object.keys(sent) as (keyof Settings)[]) {
            if (pendingRef.current[key] === sent[key]) {
              delete pendingRef.current[key];
            }
          }
          if (
            hadFailure.current &&
            Object.keys(pendingRef.current).length === 0
          ) {
            hadFailure.current = false;
            toast.info("All changes synced");
          }
        })
        .catch((error: unknown) => {
          hadFailure.current = true;
          if (error instanceof ApiError && error.status === 401) {
            toast.error("Your session expired — please log in again");
          } else {
            toast.error("Couldn't save your settings — we'll keep retrying");
          }
        });
    },
    [toast],
  );

  return { settings, updateSettings };
}
