# Contributing

Thanks for your interest! Please read this short guide before contributing to Connexa.

## Development environment

- **Node.js ≥ 20** (`.nvmrc` → `nvm use`), npm
- **Rust** toolchain is pinned via `src-tauri/rust-toolchain.toml` — `rustup`
  installs the right version automatically. Nothing to do manually.
- Desktop WebView dependencies per platform (see the [README](README.md)).

```bash
npm install          # dependencies + git hooks (husky)
npm run dev          # web only (Vite)
npm run tauri:dev    # native desktop app
```

## Quality gates (enforced in CI)

A PR must have ALL of these green before it can be merged. Run the same locally
before pushing:

| Command                                     | What it checks                     |
| ------------------------------------------- | ---------------------------------- |
| `npm run typecheck`                         | `vue-tsc` — type safety            |
| `npm run lint`                              | ESLint (@antfu) — code style       |
| `npm test`                                  | Vitest — frontend unit tests       |
| `cargo fmt --check`                         | Rust formatting (src-tauri/)       |
| `cargo clippy --all-targets -- -D warnings` | Rust lint                          |
| `cargo test`                                | Rust tests (crypto/import/metrics) |

The `npm audit` (prod) and `cargo audit` supply-chain gates also run.

> The **pre-commit hook** runs `eslint --fix` on changed files via `lint-staged`.
> Check the Rust side manually (`cargo fmt && cargo clippy`).

## Commits and PRs

- Small, focused commits. Commit messages follow
  **[Conventional Commits](https://www.conventionalcommits.org/)**:
  `feat(ssh): ...`, `fix(sftp): ...`, `chore(ci): ...`.
- Branch names: `feat/...`, `fix/...`, `chore/...`.
- In the PR description, explain **what** and **why**; if behavior changes, say how
  you verified it (this repo has a "don't claim without measuring" culture).
- When adding user-facing text, update both **tr/en** in `src/i18n/locales/`.

## Architecture notes

- `src/` — Vue frontend running in the system WebView. The `window.connexa` API is
  provided by `src/bridge/connexa.ts`, which maps every call to a Rust
  `#[tauri::command]` via `@tauri-apps/api` invoke/listen.
- `src-tauri/src/` — Rust backend. All network / PTY / crypto work lives here:
  `session.rs` (ssh/pty/telnet/serial), `sftp.rs`, `tunnel.rs`, `proxy.rs` (VNC),
  `vault.rs` + `crypto.rs` (encrypted store), `import.rs`, `sync`/`cloud`/`team`,
  `ai.rs`, `plugins.rs`, `alarm.rs`. Commands are under `src-tauri/src/commands/`.
- **Secrets never reach the WebView in plaintext** — the command surface only takes
  IDs; credentials are resolved and used inside the Rust backend.

## Conduct

This project is governed by the [Contributor Covenant](CODE_OF_CONDUCT.md).
