import { api, type ApiSettings } from "../../lib/api.ts";
import type { Settings } from "./settingsStore.ts";

export function updateSettings(patch: Partial<Settings>): Promise<ApiSettings> {
  return api<{ settings: ApiSettings }>("/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((response) => response.settings);
}
