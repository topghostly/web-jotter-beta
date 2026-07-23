import type { AuthMode } from "./authApi.ts";
import AuthForm from "./AuthForm.tsx";
import Doodles from "./Doodles.tsx";
import ModeToggle from "./ModeToggle.tsx";
import styles from "./AuthPage.module.css";
import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.ts";
import type { MeResponse } from "../../lib/api.ts";
import { useNavigate } from "react-router-dom";


interface AuthPageProps {
  mode: AuthMode;
}

const STICKY_NOTE = {
  login: "welcome back :)",
  signup: "your first note awaits!",
} as const;

export default function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false
    api<MeResponse>("/me")
      .then((data) => {
        if (!cancelled) navigate("/dashboard", { replace: true });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
        } else {
          setError(
            error instanceof Error ? error.message : "something went wrong",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <main className={styles.page}>
      <Doodles />

      <div className={styles.column}>
        <header className={styles.brand}>
          <img className={styles.logo} src="/logo.svg" alt="" />
        </header>

        <ModeToggle mode={mode} />

        <section
          className={styles.card}
          aria-label={mode === "login" ? "Log in" : "Sign up"}
        >
          <span className={styles.sticky} aria-hidden="true" key={mode}>
            {STICKY_NOTE[mode]}
          </span>
          <AuthForm mode={mode} />
        </section>
      </div>
    </main>
  );
}
