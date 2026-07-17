import type { AuthMode } from "./authApi.ts";
import AuthForm from "./AuthForm.tsx";
import Doodles from "./Doodles.tsx";
import ModeToggle from "./ModeToggle.tsx";
import styles from "./AuthPage.module.css";

interface AuthPageProps {
  mode: AuthMode;
}

const STICKY_NOTE = {
  login: "welcome back :)",
  signup: "your first note awaits!",
} as const;

export default function AuthPage({ mode }: AuthPageProps) {
  return (
    <main className={styles.page}>
      <Doodles />

      <div className={styles.column}>
        <header className={styles.brand}>
          <img className={styles.logo} src="/logo.svg" alt="" />
          {/* <h1 className={styles.wordmark}>Jotter</h1> */}
          {/* <p className={styles.tagline}>little notes, kept close</p> */}
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
