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
