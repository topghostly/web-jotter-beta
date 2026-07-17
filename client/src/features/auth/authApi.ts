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

export async function logout(): Promise<void> {
  await api("/users/logout", {
    method: "POST",
  });
}
