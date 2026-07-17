# Jotter Client API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the client's localStorage stubs with real calls to the Jotter API (cookie-session auth, `/me` bootstrap, debounced note sync, settings sync) plus a toast system for errors/infos.

**Architecture:** All requests go through a typed `fetch` wrapper at `src/lib/api.ts`, reached same-origin via a Vite dev proxy (`/api/*` → the server) so the httpOnly `jotter_session` cookie needs no CORS work. `GET /me` is the single read that bootstraps the dashboard; notes and settings mutate optimistically and sync in the background with toasts on failure.

**Tech Stack:** React 19, TypeScript (strict), react-router-dom 7, lucide-react icons, CSS modules with `tokens.css` design tokens, Vite 6. **No new npm dependencies.**

**Spec:** `docs/superpowers/specs/2026-07-16-api-integration-design.md` (in `client/`). Server contract: `../server/api.json` (OpenAPI). Server runs via `docker-compose.yml` at the repo root; inside the compose network the API is `http://server:8001`, port-mapped locally to `http://localhost:8001`. The dockerized client is served at `http://localhost:3000`.

## Global Constraints

- **No new npm dependencies** — icons come from the already-installed `lucide-react`.
- **No test runner exists**; each task is verified by `npm run build` (runs `tsc -b`) plus the listed manual browser/curl checks. Run manual checks against the compose stack (`docker compose up` at the repo root, client on `http://localhost:3000`).
- Imports use explicit `.ts`/`.tsx` extensions (existing codebase convention).
- All styling uses CSS modules + variables from `src/styles/tokens.css`; UI copy is lowercase-casual ("jot something…") except button labels which are Sentence case.
- Debounce for note saves: **800 ms**. Toast auto-dismiss: **info 4000 ms, error 6000 ms**, max **3** visible.
- `PublicUser` uses `id`; `Note`/`Settings` documents use `_id` (server quirk — both are correct).
- In dev, React StrictMode double-mounts effects, so `GET /me` fires twice — expected, harmless.
- Working directory for all commands: `/home/ayinla/Documents/Projects/jotter/client` unless a path says otherwise. Git commands run at the repo root `/home/ayinla/Documents/Projects/jotter`.
- Every commit message ends with the trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 0: Initialize git and commit the baseline

The project is not yet a git repository; later tasks commit per-task.

**Files:**
- Create: `/home/ayinla/Documents/Projects/jotter/.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: a git repo at the project root with a clean baseline commit

- [ ] **Step 1: Init the repo**

```bash
cd /home/ayinla/Documents/Projects/jotter
git init
```

- [ ] **Step 2: Create the root `.gitignore`**

```gitignore
node_modules/
dist/
*.tsbuildinfo
.env
*.local
.DS_Store
```

- [ ] **Step 3: Baseline commit**

```bash
cd /home/ayinla/Documents/Projects/jotter
git add -A
git commit -m "chore: baseline before client-API integration

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: commit succeeds; `git status` shows a clean tree (`.env` and `node_modules` untracked).

---

### Task 1: Vite proxy + typed API client

**Files:**
- Modify: `vite.config.ts`
- Create: `src/lib/api.ts`

**Interfaces:**
- Consumes: nothing
- Produces (used by every later task):
  - `api<T>(path: string, init?: RequestInit): Promise<T>` — prefixes `/api`, JSON in/out, resolves `undefined as T` on 204, throws `ApiError` on non-2xx or network failure
  - `class ApiError extends Error { status: number }` (status `0` = network failure)
  - Types: `PublicUser { id, name, email, createdAt }`, `ApiNote { _id, content, user, createdAt, updatedAt }`, `ApiSettings { _id, user, fontSize, multicolor, paper, theme }`, `MeResponse { user, notes, settings }`

- [ ] **Step 1: Replace `vite.config.ts`**

```ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          // Compose-network hostname; local (non-Docker) dev sets
          // VITE_API_TARGET=http://localhost:8001 (e.g. in .env.local).
          target: env.VITE_API_TARGET || "http://server:8001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
```

- [ ] **Step 2: Create `src/lib/api.ts`**

```ts
/**
 * Typed client for the Jotter API. All requests go through the /api
 * dev-proxy prefix so the httpOnly session cookie stays same-origin.
 */

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ApiNote {
  _id: string;
  content: string;
  user: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSettings {
  _id: string;
  user: string;
  fontSize: "small" | "medium" | "large";
  multicolor: boolean;
  paper: "random" | "plain" | "ruled" | "grid" | "dot";
  theme: "light" | "dark";
}

export interface MeResponse {
  user: PublicUser;
  notes: ApiNote[];
  settings: ApiSettings;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "couldn't reach the server");
  }

  if (!response.ok) {
    let message = `request failed (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Verify the proxy manually**

```bash
cd /home/ayinla/Documents/Projects/jotter
docker compose up -d --build
sleep 5
curl -s http://localhost:3000/api/
```

Expected output: `{"message":"Welcome to Jotter API"}` (exact copy may differ; any JSON welcome message from the server counts). If the client container was built before this change, `docker compose restart client` first.

- [ ] **Step 5: Commit**

```bash
cd /home/ayinla/Documents/Projects/jotter
git add client/vite.config.ts client/src/lib/api.ts
git commit -m "feat(client): add vite /api proxy and typed API client

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Toast system

**Files:**
- Create: `src/components/toast/toastTypes.ts`
- Create: `src/components/toast/ToastProvider.tsx`
- Create: `src/components/toast/Toaster.tsx`
- Create: `src/components/toast/useToast.ts`
- Create: `src/components/toast/Toast.module.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `tokens.css` variables, `lucide-react` icons
- Produces (used by Tasks 4–5):
  - `useToast(): ToastApi` where `ToastApi = { info(message: string): void; error(message: string): void }` — throws if used outside `<ToastProvider>`
  - `<ToastProvider>` wrapping the app in `App.tsx`
  - Behavior: bottom-right stack, max 3, auto-dismiss info 4 s / error 6 s, manual dismiss, duplicate messages refresh the existing toast's timer instead of stacking

- [ ] **Step 1: Create `src/components/toast/toastTypes.ts`**

```ts
export type ToastKind = "info" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastApi {
  info: (message: string) => void;
  error: (message: string) => void;
}
```

- [ ] **Step 2: Create `src/components/toast/Toast.module.css`**

```css
.stack {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: min(360px, calc(100vw - 40px));
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-radius: var(--sketch-radius-sm);
  box-shadow: var(--shadow-paper);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: 13.5px;
  line-height: 1.45;
  animation: toast-in 0.28s var(--ease-out);
}

.icon {
  flex-shrink: 0;
  display: inline-flex;
  margin-top: 1px;
  color: var(--ink-soft);
}

.error .icon {
  color: var(--error);
}

.message {
  margin: 0;
  flex: 1;
  overflow-wrap: anywhere;
}

.close {
  flex-shrink: 0;
  display: inline-flex;
  border: 0;
  background: none;
  padding: 2px;
  margin: -2px -4px 0 0;
  color: var(--ink-faint);
  cursor: pointer;
  border-radius: 4px;
}

.close:hover,
.close:focus-visible {
  color: var(--ink);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast {
    animation: none;
  }
}
```

- [ ] **Step 3: Create `src/components/toast/Toaster.tsx`**

```tsx
import { AlertCircle, Info, X } from "lucide-react";
import type { Toast } from "./toastTypes.ts";
import styles from "./Toast.module.css";

interface ToasterProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export default function Toaster({ toasts, onDismiss }: ToasterProps) {
  return (
    <div className={styles.stack} aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={
            toast.kind === "error"
              ? `${styles.toast} ${styles.error}`
              : styles.toast
          }
          role={toast.kind === "error" ? "alert" : "status"}
        >
          <span className={styles.icon} aria-hidden="true">
            {toast.kind === "error" ? <AlertCircle size={16} /> : <Info size={16} />}
          </span>
          <p className={styles.message}>{toast.message}</p>
          <button
            type="button"
            className={styles.close}
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/toast/ToastProvider.tsx`**

```tsx
import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Toaster from "./Toaster.tsx";
import type { Toast, ToastApi, ToastKind } from "./toastTypes.ts";

const DURATION_MS: Record<ToastKind, number> = { info: 4000, error: 6000 };
const MAX_VISIBLE = 3;

export const ToastContext = createContext<ToastApi | null>(null);

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, number>());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const startTimer = useCallback(
    (id: number, kind: ToastKind) => {
      const old = timers.current.get(id);
      if (old !== undefined) window.clearTimeout(old);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), DURATION_MS[kind]),
      );
    },
    [dismiss],
  );

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      setToasts((prev) => {
        // Duplicate suppression: refresh the timer instead of stacking a copy.
        const existing = prev.find(
          (t) => t.kind === kind && t.message === message,
        );
        if (existing) {
          startTimer(existing.id, kind);
          return prev;
        }
        const id = nextId.current++;
        startTimer(id, kind);
        const next = [...prev, { id, kind, message }];
        for (const dropped of next.slice(0, -MAX_VISIBLE)) {
          const timer = timers.current.get(dropped.id);
          if (timer !== undefined) window.clearTimeout(timer);
          timers.current.delete(dropped.id);
        }
        return next.slice(-MAX_VISIBLE);
      });
    },
    [startTimer],
  );

  const toastApi = useMemo<ToastApi>(
    () => ({
      info: (message) => show("info", message),
      error: (message) => show("error", message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 5: Create `src/components/toast/useToast.ts`**

```ts
import { useContext } from "react";
import { ToastContext } from "./ToastProvider.tsx";
import type { ToastApi } from "./toastTypes.ts";

export function useToast(): ToastApi {
  const toastApi = useContext(ToastContext);
  if (!toastApi) throw new Error("useToast must be used inside <ToastProvider>");
  return toastApi;
}
```

- [ ] **Step 6: Wrap the app in `src/App.tsx`**

Replace the file with:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ToastProvider from "./components/toast/ToastProvider.tsx";
import AuthPage from "./features/auth/AuthPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: Verify visually with a temporary trigger**

Temporarily add inside `ToastProvider`'s JSX in `App.tsx` (directly above `<Routes>`):

```tsx
{/* TEMP — remove before commit */}
<ToastTest />
```

and this component + import at the top of `App.tsx`:

```tsx
import { useToast } from "./components/toast/useToast.ts";

function ToastTest() {
  const toast = useToast();
  return (
    <div style={{ position: "fixed", top: 8, left: 8, zIndex: 2000 }}>
      <button onClick={() => toast.info("All changes synced")}>info</button>
      <button onClick={() => toast.error("Couldn't save your note — we'll keep retrying")}>
        error
      </button>
    </div>
  );
}
```

Open `http://localhost:3000/login` and check: info and error toasts appear bottom-right with the correct icons; clicking the same button twice does NOT stack a duplicate; info disappears after ~4 s, error after ~6 s; the X dismisses immediately; firing 4+ distinct messages caps the stack at 3; toasts look right in dark mode (in devtools console: `document.documentElement.dataset.theme = "dark"`).

- [ ] **Step 8: Remove the temporary trigger**

Delete the `ToastTest` component, its usage, and the `useToast` import from `App.tsx`, restoring the Step 6 version exactly.

- [ ] **Step 9: Typecheck**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
cd /home/ayinla/Documents/Projects/jotter
git add client/src/components/toast client/src/App.tsx
git commit -m "feat(client): add toast system for infos and errors

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Real auth + /me bootstrap and route guard

**Files:**
- Rewrite: `src/features/auth/authApi.ts`
- Rewrite: `src/features/auth/AuthForm.tsx`
- Modify: `src/features/auth/AuthForm.module.css`
- Rewrite: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.module.css`

**Interfaces:**
- Consumes: `api`, `ApiError`, `MeResponse`, `PublicUser` from `src/lib/api.ts` (Task 1)
- Produces:
  - `signup(input: { name: string; email: string; password: string }): Promise<PublicUser>`
  - `login(input: { email: string; password: string }): Promise<PublicUser>`
  - `type AuthMode = "login" | "signup"` (unchanged export, still used by `AuthPage`/`ModeToggle`)
  - `DashboardPage` renders an inner `Dashboard({ me }: { me: MeResponse })` — Tasks 4–5 modify `Dashboard` only
  - **Removed:** `authenticate`, `getSession`, `clearSession`, `Session`, `Credentials` (nothing may import them after this task)

- [ ] **Step 1: Rewrite `src/features/auth/authApi.ts`**

```ts
/**
 * Auth client. The session itself lives in the httpOnly jotter_session
 * cookie, set by the server on signup/login — nothing is stored locally.
 */
import { api, type PublicUser } from "../../lib/api.ts";

export type AuthMode = "login" | "signup";

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function signup(input: SignUpInput): Promise<PublicUser> {
  return api<{ user: PublicUser }>("/users", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((response) => response.user);
}

export function login(input: LoginInput): Promise<PublicUser> {
  return api<{ user: PublicUser }>("/users/login", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((response) => response.user);
}
```

- [ ] **Step 2: Rewrite `src/features/auth/AuthForm.tsx`**

Name field (signup only) + email + password; server errors mapped to fields (409 → email) or a form-level message. Auth errors stay inline — no toasts here.

```tsx
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button.tsx";
import TextField from "../../components/TextField.tsx";
import { ApiError } from "../../lib/api.ts";
import { login, signup, type AuthMode } from "./authApi.ts";
import styles from "./AuthForm.module.css";

interface AuthFormProps {
  mode: AuthMode;
}

const COPY = {
  login: { submit: "Log in", pending: "Logging in…" },
  signup: { submit: "Create account", pending: "Creating account…" },
} as const;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(
  mode: AuthMode,
  name: string,
  email: string,
  password: string,
): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === "signup" && name.trim().length === 0) {
    errors.name = "Tell us your name.";
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = "That doesn't look like an email.";
  }
  if (password.length < 6) {
    errors.password = "Password needs at least 6 characters.";
  }
  return errors;
}

export default function AuthForm({ mode }: AuthFormProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validate(mode, name, email, password);
    setErrors(nextErrors);
    setFormError(null);
    if (nextErrors.name || nextErrors.email || nextErrors.password) return;

    setPending(true);
    try {
      if (mode === "signup") {
        await signup({ name: name.trim(), email: email.trim(), password });
      } else {
        await login({ email: email.trim(), password });
      }
      navigate("/dashboard");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ email: error.message });
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("something went wrong — please try again");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {mode === "signup" && (
        <TextField
          label="Name"
          name="name"
          placeholder="what should we call you?"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
      )}
      <TextField
        label="Email"
        name="email"
        type="email"
        placeholder="you@somewhere.com"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        placeholder="your secret scribble"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" pending={pending}>
        {pending ? COPY[mode].pending : COPY[mode].submit}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Append to `src/features/auth/AuthForm.module.css`**

```css
.formError {
  margin: -6px 0 0;
  color: var(--error);
  font-size: 13.5px;
  line-height: 1.4;
}
```

- [ ] **Step 4: Rewrite `src/pages/DashboardPage.tsx`**

Bootstraps from `GET /me`. The inner `Dashboard` still uses the localStorage-backed `useNotes()`/`useSettings()` for now — Tasks 4–5 swap those. Logout is client-side only.

```tsx
import { useEffect, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../components/Button.tsx";
import TopBar from "../features/dashboard/TopBar.tsx";
import NoteCard from "../features/notes/NoteCard.tsx";
import { useNotes } from "../features/notes/useNotes.ts";
import { FONT_SIZES } from "../features/settings/settingsStore.ts";
import { useSettings } from "../features/settings/useSettings.ts";
import { api, ApiError, type MeResponse } from "../lib/api.ts";
import styles from "./DashboardPage.module.css";

const TEAR_OFF_MS = 220;

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthed, setUnauthed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<MeResponse>("/me")
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setUnauthed(true);
        } else {
          setError(
            error instanceof Error ? error.message : "something went wrong",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (unauthed) return <Navigate to="/login" replace />;

  if (error) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <p className={styles.empty}>couldn't load your board — {error}</p>
          <div className={styles.retry}>
            <Button
              type="button"
              onClick={() => {
                setError(null);
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!me) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <p className={styles.empty}>fetching your notes…</p>
        </main>
      </div>
    );
  }

  return <Dashboard me={me} />;
}

function Dashboard({ me }: { me: MeResponse }) {
  const navigate = useNavigate();
  const { notes, addNote, updateNoteBody, removeNote } = useNotes();
  const { settings, updateSettings } = useSettings();
  const [deleteMode, setDeleteMode] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<string[]>([]);

  function handleAddNote() {
    setDeleteMode(false);
    setLastAddedId(addNote());
  }

  function handleDelete(id: string) {
    if (removingIds.includes(id)) return;
    setRemovingIds((prev) => [...prev, id]);
    setTimeout(() => {
      removeNote(id);
      setRemovingIds((prev) => prev.filter((x) => x !== id));
    }, TEAR_OFF_MS);
  }

  function handleLogout() {
    // The session cookie is httpOnly and the API has no logout endpoint yet,
    // so this only leaves the page — the cookie stays valid until it expires.
    navigate("/login", { replace: true });
  }

  const font = FONT_SIZES[settings.fontSize];
  const boardStyle = {
    "--note-fs": `${font.size}px`,
    "--note-lh": `${font.line}px`,
  } as CSSProperties;

  return (
    <div className={styles.page}>
      <TopBar
        username={me.user.name}
        deleteMode={deleteMode}
        settings={settings}
        onSettingsChange={updateSettings}
        onAddNote={handleAddNote}
        onToggleDeleteMode={() => setDeleteMode((on) => !on)}
        onLogout={handleLogout}
      />

      <main className={styles.main}>
        {deleteMode && notes.length > 0 && (
          <p className={styles.hint}>tap a note to tear it off the board</p>
        )}

        {notes.length === 0 ? (
          <p className={styles.empty}>
            an empty board — press “New note” and jot something down
          </p>
        ) : (
          <div className={styles.board} style={boardStyle}>
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                paper={settings.paper === "random" ? note.paper : settings.paper}
                color={settings.multicolor ? note.color : "white"}
                deleteMode={deleteMode}
                removing={removingIds.includes(note.id)}
                justAdded={note.id === lastAddedId}
                onDelete={() => handleDelete(note.id)}
                onBodyChange={(body) => updateNoteBody(note.id, body)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Append to `src/pages/DashboardPage.module.css`**

```css
.retry {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: exits 0. If anything still imports `authenticate`/`getSession`/`clearSession`, this fails — fix by removing those imports (only `DashboardPage.tsx` and `AuthForm.tsx` used them).

- [ ] **Step 7: Manual verification**

With `docker compose up` running, at `http://localhost:3000`:
1. `/signup`: submit empty → inline field errors. Enter name/email/password → lands on `/dashboard`, top bar greets by name, devtools shows `jotter_session` cookie (httpOnly).
2. Reload `/dashboard` → stays (session persisted, StrictMode fires `/me` twice — fine).
3. Sign up again with the same email → inline email error "Email already in use".
4. `/login` with wrong password → form-level "Invalid email or password".
5. Log out → back at `/login`. (Visiting `/dashboard` again silently re-enters — documented limitation.)
6. In devtools, delete the `jotter_session` cookie, reload `/dashboard` → redirected to `/login`.
7. Stop the server (`docker compose stop server`), reload `/dashboard` → "couldn't load your board" with a working "Try again" after `docker compose start server`.

- [ ] **Step 8: Commit**

```bash
cd /home/ayinla/Documents/Projects/jotter
git add client/src/features/auth client/src/pages
git commit -m "feat(client): real signup/login and /me dashboard bootstrap

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Notes sync (drafts, debounce, delete, toasts)

**Files:**
- Modify: `src/features/notes/types.ts`
- Rewrite: `src/features/notes/notesStore.ts`
- Create: `src/features/notes/notesApi.ts`
- Rewrite: `src/features/notes/useNotes.ts`
- Rewrite: `src/features/notes/NoteCard.tsx`
- Modify: `src/pages/DashboardPage.tsx` (the `Dashboard` component from Task 3)

**Interfaces:**
- Consumes: `api`, `ApiNote` (Task 1); `useToast` (Task 2); `me.notes` from `Dashboard` (Task 3)
- Produces:
  - `Note` gains `serverId?: string`; `id` stays a client-generated UUID and the stable React key
  - `fromApiNote(apiNote: ApiNote): Note`, `createDraftNote(): Note` from `notesStore.ts`
  - `useNotes(initialNotes: Note[])` returning `{ notes, addNote(): string, updateNoteBody(id, body), flushNote(id), removeNote(id) }`
  - `NoteCard` gains required prop `onFlush: () => void`; its contentEditable becomes uncontrolled and reports every input
  - **Removed:** `loadNotes`, `saveNotes`, `createNote` (client), `SEEDS`, all localStorage persistence

- [ ] **Step 1: Update `src/features/notes/types.ts`**

```ts
export const PAPER_TYPES = ["plain", "ruled", "grid", "dot"] as const;
export type PaperType = (typeof PAPER_TYPES)[number];

export const NOTE_COLORS = ["yellow", "pink", "blue", "mint", "white"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Note {
  /** Client-generated id — the stable React key, even before the server knows the note. */
  id: string;
  /** MongoDB _id, set once the note has been created on the server. */
  serverId?: string;
  body: string;
  paper: PaperType;
  color: NoteColor;
  createdAt: number;
}
```

- [ ] **Step 2: Rewrite `src/features/notes/notesStore.ts`**

```ts
/**
 * Maps server notes to the client shape. Paper and color aren't stored
 * server-side — they're re-randomized on every load, by design.
 */
import type { ApiNote } from "../../lib/api.ts";
import { NOTE_COLORS, PAPER_TYPES, type Note } from "./types.ts";

function pick<T>(options: readonly T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

export function fromApiNote(apiNote: ApiNote): Note {
  return {
    id: crypto.randomUUID(),
    serverId: apiNote._id,
    body: apiNote.content,
    paper: pick(PAPER_TYPES),
    color: pick(NOTE_COLORS),
    createdAt: Date.parse(apiNote.createdAt),
  };
}

/** A brand-new local note; POSTed to the server on its first non-empty save. */
export function createDraftNote(): Note {
  return {
    id: crypto.randomUUID(),
    body: "",
    paper: pick(PAPER_TYPES),
    color: pick(NOTE_COLORS),
    createdAt: Date.now(),
  };
}
```

- [ ] **Step 3: Create `src/features/notes/notesApi.ts`**

```ts
import { api, type ApiNote } from "../../lib/api.ts";

export function createNote(content: string): Promise<ApiNote> {
  return api<{ note: ApiNote }>("/notes", {
    method: "POST",
    body: JSON.stringify({ content }),
  }).then((response) => response.note);
}

export function updateNote(
  id: string,
  content: string,
  options: { keepalive?: boolean } = {},
): Promise<ApiNote> {
  return api<{ note: ApiNote }>(`/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
    keepalive: options.keepalive,
  }).then((response) => response.note);
}

export function deleteNote(id: string): Promise<void> {
  return api<void>(`/notes/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 4: Rewrite `src/features/notes/useNotes.ts`**

The sync rules, in order of precedence:
- Empty drafts (no `serverId`, blank body) are never sent.
- A draft's first non-empty save POSTs; the response's `_id` becomes `serverId`. If the note was deleted while the POST was in flight, the orphan is deleted server-side.
- Saves debounce 800 ms per note; a body change during an in-flight save marks it dirty and triggers one trailing save after success.
- A failed save keeps `dirty` set and does NOT self-retry — the next body change or flush (blur/pagehide) retries. Failure shows a deduped error toast; the next success shows "All changes synced".
- Deletes are optimistic; on failure the note is restored at its old position with an error toast.

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../components/toast/useToast.ts";
import {
  createNote as apiCreateNote,
  deleteNote as apiDeleteNote,
  updateNote as apiUpdateNote,
} from "./notesApi.ts";
import { createDraftNote } from "./notesStore.ts";
import type { Note } from "./types.ts";

const SAVE_DEBOUNCE_MS = 800;

/** Per-note sync bookkeeping, keyed by the note's client id. */
interface SyncState {
  timer?: number;
  inFlight: boolean;
  /** Body changed after the current/last save attempt started. */
  dirty: boolean;
  /** Note was removed from the board (delete may still be in flight). */
  deleted?: boolean;
}

export function useNotes(initialNotes: Note[]) {
  const toast = useToast();
  const [notes, setNotes] = useState<Note[]>(initialNotes);

  /* Mirror of `notes`, updated eagerly, so save callbacks and event
     handlers never read a stale closure. */
  const notesRef = useRef(notes);
  const sync = useRef(new Map<string, SyncState>());
  const hadFailure = useRef(false);

  const setAll = useCallback((update: (prev: Note[]) => Note[]) => {
    notesRef.current = update(notesRef.current);
    setNotes(notesRef.current);
  }, []);

  const getSync = useCallback((id: string): SyncState => {
    let state = sync.current.get(id);
    if (!state) {
      state = { inFlight: false, dirty: false };
      sync.current.set(id, state);
    }
    return state;
  }, []);

  const saveNote = useCallback(
    async (id: string, options: { keepalive?: boolean } = {}) => {
      const state = getSync(id);
      const note = notesRef.current.find((n) => n.id === id);
      if (!note || state.deleted) return;
      if (state.inFlight) {
        state.dirty = true;
        return;
      }
      if (!note.serverId && note.body.trim() === "") {
        state.dirty = false;
        return;
      }

      state.inFlight = true;
      state.dirty = false;
      let failed = false;
      try {
        if (note.serverId) {
          await apiUpdateNote(note.serverId, note.body, options);
        } else {
          const created = await apiCreateNote(note.body);
          if (state.deleted) {
            // Deleted while the create was in flight — remove the orphan.
            void apiDeleteNote(created._id).catch(() => {});
            sync.current.delete(id);
            return;
          }
          setAll((prev) =>
            prev.map((n) => (n.id === id ? { ...n, serverId: created._id } : n)),
          );
        }
        if (hadFailure.current) {
          hadFailure.current = false;
          toast.info("All changes synced");
        }
      } catch {
        failed = true;
        state.dirty = true;
        hadFailure.current = true;
        toast.error("Couldn't save your note — we'll keep retrying");
      } finally {
        state.inFlight = false;
      }

      // A body change arrived during the save — send one trailing save.
      if (!failed && state.dirty && !state.deleted) void saveNote(id, options);
    },
    [getSync, setAll, toast],
  );

  const scheduleSave = useCallback(
    (id: string) => {
      const state = getSync(id);
      if (state.timer) window.clearTimeout(state.timer);
      state.timer = window.setTimeout(() => {
        state.timer = undefined;
        void saveNote(id);
      }, SAVE_DEBOUNCE_MS);
    },
    [getSync, saveNote],
  );

  const addNote = useCallback((): string => {
    const note = createDraftNote();
    setAll((prev) => [note, ...prev]);
    return note.id;
  }, [setAll]);

  const updateNoteBody = useCallback(
    (id: string, body: string) => {
      const current = notesRef.current.find((n) => n.id === id);
      if (!current || current.body === body) return;
      setAll((prev) => prev.map((n) => (n.id === id ? { ...n, body } : n)));
      scheduleSave(id);
    },
    [scheduleSave, setAll],
  );

  /** Immediate save of anything pending or dirty — used on blur. */
  const flushNote = useCallback(
    (id: string) => {
      const state = getSync(id);
      if (!state.timer && !state.dirty) return;
      if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = undefined;
      }
      void saveNote(id);
    },
    [getSync, saveNote],
  );

  const removeNote = useCallback(
    (id: string) => {
      const note = notesRef.current.find((n) => n.id === id);
      if (!note) return;
      const state = getSync(id);
      state.deleted = true;
      if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = undefined;
      }
      const index = notesRef.current.indexOf(note);
      setAll((prev) => prev.filter((n) => n.id !== id));

      if (!note.serverId) {
        // Unsaved draft. If a create is in flight, saveNote cleans up after it.
        if (!state.inFlight) sync.current.delete(id);
        return;
      }

      apiDeleteNote(note.serverId)
        .then(() => sync.current.delete(id))
        .catch(() => {
          state.deleted = false;
          setAll((prev) => {
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, note);
            return next;
          });
          toast.error("Couldn't delete the note — it's back on your board");
        });
    },
    [getSync, setAll, toast],
  );

  /* Last-chance flush when the tab is hidden/closed. keepalive lets the
     browser finish the request after the page goes away. */
  useEffect(() => {
    function flushPending() {
      for (const note of notesRef.current) {
        const state = sync.current.get(note.id);
        if (state?.timer || state?.dirty) {
          if (state.timer) {
            window.clearTimeout(state.timer);
            state.timer = undefined;
          }
          void saveNote(note.id, { keepalive: true });
        }
      }
    }
    window.addEventListener("pagehide", flushPending);
    return () => window.removeEventListener("pagehide", flushPending);
  }, [saveNote]);

  return { notes, addNote, updateNoteBody, flushNote, removeNote };
}
```

- [ ] **Step 5: Rewrite `src/features/notes/NoteCard.tsx`**

Two changes: the contentEditable becomes **uncontrolled** (rendered once from a ref, so state updates on every keystroke can't reset the caret), and it reports input as it happens plus a flush on blur.

```tsx
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Note, NoteColor, PaperType } from "./types.ts";
import styles from "./NoteCard.module.css";

interface NoteCardProps {
  note: Note;
  /** What to render — may differ from the note's own paper/color per settings. */
  paper: PaperType;
  color: NoteColor;
  deleteMode: boolean;
  removing?: boolean;
  justAdded?: boolean;
  onDelete: () => void;
  onBodyChange: (body: string) => void;
  onFlush: () => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function NoteCard({
  note,
  paper,
  color,
  deleteMode,
  removing,
  justAdded,
  onDelete,
  onBodyChange,
  onFlush,
}: NoteCardProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  /* The contentEditable is uncontrolled: React renders the body once, then
     the DOM owns it. Re-renders never touch the text, so the caret stays put. */
  const initialBody = useRef(note.body);

  useEffect(() => {
    if (justAdded) bodyRef.current?.focus();
  }, [justAdded]);

  function handleDeleteKey(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onDelete();
    }
  }

  const className = [
    styles.card,
    deleteMode && styles.deletable,
    removing && styles.removing,
    justAdded && styles.justAdded,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={className}
      data-paper={paper}
      data-color={color}
      onClick={deleteMode ? onDelete : undefined}
      onKeyDown={deleteMode ? handleDeleteKey : undefined}
      role={deleteMode ? "button" : undefined}
      aria-label={deleteMode ? "Delete this note" : undefined}
      tabIndex={deleteMode ? 0 : undefined}
    >
      <div
        ref={bodyRef}
        className={styles.body}
        contentEditable={!deleteMode && !removing}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Note text"
        data-placeholder="jot something…"
        onInput={(e) => onBodyChange(e.currentTarget.innerText)}
        onBlur={(e) => {
          onBodyChange(e.currentTarget.innerText.trim());
          onFlush();
        }}
      >
        {initialBody.current}
      </div>
      <time
        className={styles.date}
        dateTime={new Date(note.createdAt).toISOString()}
      >
        {formatDate(note.createdAt)}
      </time>
    </article>
  );
}
```

- [ ] **Step 6: Wire server notes into `Dashboard` in `src/pages/DashboardPage.tsx`**

Change the imports (add `useMemo` to the react import, add `fromApiNote`):

```tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { fromApiNote } from "../features/notes/notesStore.ts";
```

In the `Dashboard` component, replace

```tsx
  const { notes, addNote, updateNoteBody, removeNote } = useNotes();
```

with

```tsx
  const initialNotes = useMemo(() => me.notes.map(fromApiNote), [me.notes]);
  const { notes, addNote, updateNoteBody, flushNote, removeNote } =
    useNotes(initialNotes);
```

and add the `onFlush` prop to `NoteCard` (after `onBodyChange`):

```tsx
                onBodyChange={(body) => updateNoteBody(note.id, body)}
                onFlush={() => flushNote(note.id)}
```

- [ ] **Step 7: Typecheck**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 8: Manual verification**

With `docker compose up` running, logged in at `http://localhost:3000/dashboard`, devtools Network tab open:
1. Fresh account shows the empty board (seed notes are gone).
2. "New note" → focused blank note, **no** request. Type "hello" → one `POST /api/notes` ~800 ms after you stop. Keep typing → `PATCH` requests only after pauses, not per keystroke; the caret never jumps.
3. Click away from a note right after typing → immediate PATCH (blur flush). Blur without changes → no request.
4. Reload → notes persist, order newest-first, colors/papers reshuffle (expected).
5. New note, type nothing, tear it off → no requests. Tear off a saved note → `DELETE`, gone after reload.
6. `docker compose stop server`, then type in a note → one error toast ("Couldn't save your note — we'll keep retrying"); more typing refreshes the same toast, no stacking. `docker compose start server`, type again → save succeeds and "All changes synced" info toast appears.
7. Type and immediately close the tab; reopen and log in → the last edit was saved (pagehide keepalive flush).

- [ ] **Step 9: Commit**

```bash
cd /home/ayinla/Documents/Projects/jotter
git add client/src/features/notes client/src/pages/DashboardPage.tsx
git commit -m "feat(client): sync notes with the server (drafts, debounce, toasts)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Settings sync + localStorage removal

**Files:**
- Create: `src/features/settings/settingsApi.ts`
- Rewrite: `src/features/settings/settingsStore.ts`
- Rewrite: `src/features/settings/useSettings.ts`
- Modify: `src/pages/DashboardPage.tsx` (the `Dashboard` component)
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `api`, `ApiSettings` (Task 1); `useToast` (Task 2); `me.settings` from `Dashboard` (Task 3)
- Produces:
  - `updateSettings(patch: Partial<Settings>): Promise<ApiSettings>` from `settingsApi.ts`
  - `fromApiSettings(apiSettings: ApiSettings): Settings` from `settingsStore.ts`
  - `useSettings(initialSettings: Settings)` returning `{ settings, updateSettings(patch) }` (call signature consumed by `TopBar`/`SettingsMenu` is unchanged)
  - **Removed:** `loadSettings`, `saveSettings`, `SETTINGS_KEY`, `DEFAULTS` (nothing may import them after this task; `main.tsx` was the last consumer)

- [ ] **Step 1: Create `src/features/settings/settingsApi.ts`**

```ts
import { api, type ApiSettings } from "../../lib/api.ts";
import type { Settings } from "./settingsStore.ts";

export function updateSettings(patch: Partial<Settings>): Promise<ApiSettings> {
  return api<{ settings: ApiSettings }>("/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((response) => response.settings);
}
```

- [ ] **Step 2: Rewrite `src/features/settings/settingsStore.ts`**

```ts
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
```

- [ ] **Step 3: Rewrite `src/features/settings/useSettings.ts`**

Optimistic update + PATCH of only the changed fields; failures keep the optimistic value, toast (deduped), and are retried implicitly by the next settings change.

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../components/toast/useToast.ts";
import { updateSettings as apiUpdateSettings } from "./settingsApi.ts";
import { applyTheme, type Settings } from "./settingsStore.ts";

export function useSettings(initialSettings: Settings) {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const hadFailure = useRef(false);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      apiUpdateSettings(patch)
        .then(() => {
          if (hadFailure.current) {
            hadFailure.current = false;
            toast.info("All changes synced");
          }
        })
        .catch(() => {
          hadFailure.current = true;
          toast.error("Couldn't save your settings — we'll keep retrying");
        });
    },
    [toast],
  );

  return { settings, updateSettings };
}
```

- [ ] **Step 4: Wire server settings into `Dashboard` in `src/pages/DashboardPage.tsx`**

Add `fromApiSettings` to the settingsStore import:

```tsx
import {
  FONT_SIZES,
  fromApiSettings,
} from "../features/settings/settingsStore.ts";
```

In the `Dashboard` component, replace

```tsx
  const { settings, updateSettings } = useSettings();
```

with

```tsx
  const initialSettings = useMemo(() => fromApiSettings(me.settings), [me.settings]);
  const { settings, updateSettings } = useSettings(initialSettings);
```

- [ ] **Step 5: Rewrite `src/main.tsx`**

The theme now comes from the server after login; pre-auth pages use the default light theme.

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 7: Manual verification**

At `http://localhost:3000`, logged in:
1. Toggle each setting (font size, multicolor, paper, dark theme) → board updates instantly; Network tab shows a `PATCH /api/settings` per change carrying only the changed field.
2. Reload → all settings persist. Log in from a private window → same settings (server-owned).
3. `localStorage` in devtools has no `jotter:*` keys left after a fresh signup (clear old ones manually once).
4. `docker compose stop server`, toggle a setting → it applies visually + error toast; `start server`, toggle again → "All changes synced".
5. Log out → login page is light-themed on a fresh tab (dark theme not persisted pre-auth — accepted per spec).

- [ ] **Step 8: Commit**

```bash
cd /home/ayinla/Documents/Projects/jotter
git add client/src/features/settings client/src/pages/DashboardPage.tsx client/src/main.tsx
git commit -m "feat(client): sync settings with the server, drop localStorage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Full end-to-end verification

**Files:** none (fixes only, if a check fails)

**Interfaces:**
- Consumes: everything above
- Produces: verified, committed feature

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: exits 0 with no warnings about unused exports/imports.

- [ ] **Step 2: Grep for dead references**

```bash
cd /home/ayinla/Documents/Projects/jotter/client
grep -rn "localStorage\|getSession\|clearSession\|loadNotes\|saveNotes\|loadSettings\|saveSettings\|authenticate" src/
```

Expected: no matches. Any match is leftover stub code — remove it.

- [ ] **Step 3: Run the spec's manual E2E checklist**

Against `docker compose up`, in order (spec §Testing):
1. Sign up → empty dashboard; cookie set.
2. Create note, type, pause > 800 ms → PATCH/POST in Network tab; reload → content persists, colors reshuffle.
3. Fast typing → only a trailing save fires; blur → immediate flush.
4. Delete note → gone after reload. Delete a fresh empty draft → no network call.
5. Change each setting → persists across reload and a second browser.
6. Wrong password → form error; duplicate signup email → email error.
7. Logout → back at login (silent re-entry to /dashboard is the documented limitation).
8. Stop server mid-edit → typing keeps working, one deduped error toast; restart → next edit syncs + "All changes synced".
9. Toasts stack (max 3), auto-dismiss on their timers, dismiss manually, and render correctly in light and dark themes.

- [ ] **Step 4: Commit any fixes**

```bash
cd /home/ayinla/Documents/Projects/jotter
git add -A
git commit -m "fix(client): address issues found in end-to-end verification

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Skip if the tree is clean.)
