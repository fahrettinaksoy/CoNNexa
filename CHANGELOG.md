# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Migrated from Electron to Tauri v2 with a full Rust backend.** The Vue/Vuetify
  UI is preserved; the Node main process is rewritten in Rust and the preload IPC
  bridge is replaced by `src/bridge/connexa.ts` over `@tauri-apps/api`
  invoke/listen. Native layers: SSH/SFTP/tunnel (`russh`), local PTY
  (`portable-pty`), serial (`serialport`), Telnet (`tokio`), VNC WS↔TCP proxy,
  sync/cloud/AI (`reqwest`). At-rest secrets use an OS-keychain key (`keyring`) +
  AES-256-GCM; portable sync/team payloads use scrypt + AES-256-GCM.

### Added

- **Rust CI quality gate** — `cargo fmt --check`, `cargo clippy -D warnings`, and
  `cargo test` run on every push/PR, alongside the frontend `typecheck`/`lint`/`test`.
- **Supply-chain gates** — `dependabot.yml` (npm/cargo/actions) and `npm audit`
  (prod) + `cargo audit` in CI.
- **Repository governance** — `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `CODEOWNERS`, PR/issue templates, `FUNDING.yml`, `.editorconfig`.
- **Tooling** — ESLint (@antfu) + Prettier + commitlint + husky (`lint-staged`
  pre-commit, commit-msg lint); Vitest with coverage; toolchain pinning
  (`rust-toolchain.toml`, `.nvmrc`).
- CI concurrency so superseded PR runs are cancelled.

### Security

- `quick-xml` bumped to `>=0.41` (fixes RUSTSEC-2026-0194/0195).
- Documented `cargo audit` exceptions in `src-tauri/.cargo/audit.toml`:
  `russh`/`russh-cryptovec` (RUSTSEC-2026-0154/0153, fixed in russh 0.60.3 — the
  0.45→0.60 API migration is planned) and `rsa` (RUSTSEC-2023-0071, no upstream fix).

### Known gaps

- In-app RDP (ironrdp-wasm RDCleanPath proxy) not yet ported; the external RDP
  client (mstsc/xfreerdp) works.
- Mobile (Android/iOS) targets are not set up; some native crates are
  desktop-only.
- `russh` 0.60 upgrade pending (see audit.toml) to clear the SSH allocation-DoS
  advisories.

## [0.1.0] — 2026

### Added

- Initial release: SSH / SFTP / Telnet / Serial / VNC + local terminal, host /
  identity / group management with inheritance, encrypted local vault, imports
  (`~/.ssh/config`, mRemoteNG, Termius), tunnels (-L/-R/-D), zero-knowledge sync
  (Gist/WebDAV), server monitoring, session recording (asciicast), cloud inventory,
  password-manager integration, threshold alarms, AI command assistant, plugins,
  team vault sharing, tr/en localization, light/dark theme.

[Unreleased]: https://github.com/fahrettinaksoy/connexa/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/fahrettinaksoy/connexa/releases/tag/v0.1.0
