import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button.tsx";
import TextField from "../../components/TextField.tsx";
import { useToast } from "../../components/toast/useToast.ts";
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
  const toast = useToast();
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
      let user;
      if (mode === "signup") {
        user = await signup({ name: name.trim(), email: email.trim(), password });
      } else {
        user = await login({ email: email.trim(), password });
      }
      toast.success(
        mode === "signup"
          ? `welcome to jotter, ${user.name} — your first note awaits`
          : `welcome back, ${user.name}`,
      );
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
