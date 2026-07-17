/**
 * User preferences — owned by the server, applied on the client.
 */
import type { ApiSettings } from "../../lib/api.ts";
import type { PaperType } from "../notes/types.ts";

export type FontSize = "small" | "medium" | "large";
export type PaperChoice = PaperType | "random";
export type Theme = "light" | "dark";

export interface Settings {
  fontSize: FontSize;
  multicolor: boolean;
  paper: PaperChoice;
  theme: Theme;
}

export const FONT_SIZE_OPTIONS = ["small", "medium", "large"] as const;
export const PAPER_CHOICES = [
  "random",
  "plain",
  "ruled",
  "grid",
  "dot",
] as const;

/** Note text metrics per size — line drives the ruled-paper spacing too. */
export const FONT_SIZES: Record<FontSize, { size: number; line: number }> = {
  small: { size: 18, line: 28 },
  medium: { size: 21, line: 32 },
  large: { size: 24, line: 36 },
};

export function fromApiSettings(apiSettings: ApiSettings): Settings {
  return {
    fontSize: apiSettings.fontSize,
    multicolor: apiSettings.multicolor,
    paper: apiSettings.paper,
    theme: apiSettings.theme,
  };
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
