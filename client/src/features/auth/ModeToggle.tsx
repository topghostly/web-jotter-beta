import { useNavigate } from "react-router-dom";
import type { AuthMode } from "./authApi.ts";
import styles from "./ModeToggle.module.css";

interface ModeToggleProps {
  mode: AuthMode;
}

export default function ModeToggle({ mode }: ModeToggleProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.track} data-mode={mode}>
      <span className={styles.thumb} aria-hidden="true" />
      <button
        type="button"
        className={styles.option}
        aria-pressed={mode === "login"}
        onClick={() => navigate("/login")}
      >
        Log in
      </button>
      <button
        type="button"
        className={styles.option}
        aria-pressed={mode === "signup"}
        onClick={() => navigate("/signup")}
      >
        Sign up
      </button>
    </div>
  );
}
