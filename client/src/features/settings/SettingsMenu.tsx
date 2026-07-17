import { useEffect, useRef, useState } from "react";
import { Moon, Settings as SettingsIcon, Sun } from "lucide-react";
import {
  FONT_SIZE_OPTIONS,
  PAPER_CHOICES,
  type Settings,
} from "./settingsStore.ts";
import styles from "./SettingsMenu.module.css";

interface SettingsMenuProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

export default function SettingsMenu({ settings, onChange }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.menu} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Settings"
        title="Settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <SettingsIcon size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.panel} role="group" aria-label="Settings">
          <p className={styles.title}>Note text</p>
          <div className={styles.row}>
            {FONT_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                className={styles.chip}
                data-size={size}
                aria-pressed={settings.fontSize === size}
                aria-label={`${size} text`}
                onClick={() => onChange({ fontSize: size })}
              >
                Aa
              </button>
            ))}
          </div>

          <p className={styles.title}>Paper</p>
          <div className={styles.rowWrap}>
            {PAPER_CHOICES.map((paper) => (
              <button
                key={paper}
                type="button"
                className={styles.chip}
                aria-pressed={settings.paper === paper}
                onClick={() => onChange({ paper })}
              >
                {paper}
              </button>
            ))}
          </div>

          <p className={styles.title}>Colors</p>
          <div className={styles.between}>
            <span className={styles.label}>colorful notes</span>
            <button
              type="button"
              className={styles.switch}
              role="switch"
              aria-checked={settings.multicolor}
              aria-label="Colorful notes"
              onClick={() => onChange({ multicolor: !settings.multicolor })}
            >
              <span className={styles.knob} aria-hidden="true" />
            </button>
          </div>

          <p className={styles.title}>Theme</p>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={settings.theme === "light"}
              onClick={() => onChange({ theme: "light" })}
            >
              <Sun size={13} aria-hidden="true" /> light
            </button>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={settings.theme === "dark"}
              onClick={() => onChange({ theme: "dark" })}
            >
              <Moon size={13} aria-hidden="true" /> dark
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
