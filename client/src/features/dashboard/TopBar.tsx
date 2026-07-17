import { LogOut, Plus, Trash2 } from "lucide-react";
import SettingsMenu from "../settings/SettingsMenu.tsx";
import type { Settings } from "../settings/settingsStore.ts";
import styles from "./TopBar.module.css";

interface TopBarProps {
  username: string;
  deleteMode: boolean;
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onAddNote: () => void;
  onToggleDeleteMode: () => void;
  onLogout: () => void;
}

export default function TopBar({
  username,
  deleteMode,
  settings,
  onSettingsChange,
  onAddNote,
  onToggleDeleteMode,
  onLogout,
}: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <img src="/logo.svg" alt="" />
          <span>Jotter</span>
        </div>

        <div className={styles.actions}>
          <span className={styles.user}>hey, {username}</span>
          <button type="button" className={styles.newNote} onClick={onAddNote}>
            <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>New note</span>
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-pressed={deleteMode}
            aria-label="Delete notes"
            title="Delete notes"
            onClick={onToggleDeleteMode}
          >
            <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <SettingsMenu settings={settings} onChange={onSettingsChange} />
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Log out"
            title="Log out"
            onClick={onLogout}
          >
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
