# Jotter

A little sticky-note board for jotting things down. Ink-on-paper design, notes you can drag your eyes across, no clutter.

React + TypeScript client, talking to an Express/MongoDB API over a cookie session.

## Features

- Sign up / log in — session lives in an httpOnly cookie
- Create, edit, and delete notes on a board, autosaved as you type
- Settings: font size, paper style, multicolor notes, light/dark theme
- Toasts for success and error feedback

## Running locally

The full stack (client, server, MongoDB) runs via Docker Compose from the repo root:

```bash
docker compose up
```

Client: [http://localhost:3000](http://localhost:3000)

To run just the client outside Docker:

```bash
npm install
npm run dev
```

By default the dev server proxies `/api` to `http://server:8001` (the Docker Compose network). Point it elsewhere with a `.env.local`:

```
VITE_API_TARGET=http://localhost:8001
```

## Stack

Vite, React 19, TypeScript, React Router, CSS Modules. No state-management library — a handful of hooks per feature (`useNotes`, `useSettings`) talk to a small typed `fetch` wrapper in `src/lib/api.ts`.

