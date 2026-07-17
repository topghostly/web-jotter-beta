import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  pending?: boolean;
}

export default function Button({ children, pending, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={styles.button}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
