# Security Policy

## Supported versions

Connexa is still in `0.x`/early development; security fixes are applied only to
the `main` branch and the latest published release.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a vulnerability

If you find a security vulnerability, **do not open a public issue**. Instead:

- email **backend@cyh.com.tr**, or
- use GitHub's private **"Report a vulnerability"** flow
  (repo → Security → Advisories → Report a vulnerability).

Please include:

- the affected component (frontend / Tauri backend / a specific protocol / a dependency),
- reproduction steps or a PoC,
- your impact assessment (credential leak, RCE, local file access, etc.).

**Response targets:** initial reply within 72 hours, a fix/mitigation plan within 30 days.

## Scope and threat model

Connexa is a **local-first** remote-access manager: connection data lives on the
user's device and there is no Connexa server, account, or remote telemetry. Because
it handles **credentials** and opens **network sessions**, the classes we care about
most are:

- **Credential handling** — passwords, private-key passphrases, and API tokens are
  encrypted at rest with an OS-keychain-backed key (`src-tauri/src/crypto.rs`) and
  are **never sent to the WebView in plaintext**; the command surface only takes IDs
  and resolves secrets inside the Rust backend. Anything that leaks a secret to the
  frontend or to disk in cleartext is in scope.
- **Tauri capability / CSP escapes** — `src-tauri/capabilities/default.json` and the
  `csp` in `tauri.conf.json` are deliberately narrow (self + the local proxy
  websockets). Anything that crosses those boundaries is in scope.
- **Session/proxy safety** — the SSH/SFTP/tunnel layers (`russh`) and the local
  VNC WS↔TCP proxy (`proxy.rs`, bound to `127.0.0.1`). Injection, path traversal
  (SFTP), or proxy misuse paths.
- **Dependency vulnerabilities** — CI has `npm audit` (prod) and `cargo audit` gates.

**Known limitations (for now):**

- **Host key verification is not enforced** — the SSH client currently accepts server
  keys without a known-hosts check (mirroring the previous behavior). Known-hosts
  verification + change warnings are planned.
- The at-rest field-encryption key falls back to a `0600` key file in the app config
  directory when the OS keychain is unavailable; this is less protected than the
  keychain path.
- An attacker with physical/root access to the device is out of scope; today's
  baseline is OS full-disk encryption (FileVault/BitLocker/LUKS).
