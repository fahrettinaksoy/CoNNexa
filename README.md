# Connexa

SSH / RDP / VNC / Telnet **Uzak Erişim Yöneticisi** — Vue 3 + **Tauri v2 (Rust)** ile geliştirilen, yerel-öncelikli (local-first), çapraz platform bağlantı yöneticisi.

> Ürün stratejisi, rakip analizi ve mimari kararlar için: [docs/CONNEXA_RAKIP_ANALIZ_RAPORU.md](docs/CONNEXA_RAKIP_ANALIZ_RAPORU.md)

## Teknoloji Stack'i

| Katman | Teknoloji |
| --- | --- |
| UI | Vue 3 (Composition API) · Vuetify · Pinia · Vue Router · Vue I18n (TR/EN) · VueUse |
| Masaüstü | **Tauri v2** (Rust arka uç + sistem WebView) + Vite |
| Terminal | @xterm/xterm (WebGL hızlandırmalı) |
| Protokoller | SSH/SFTP: `russh` + `russh-sftp` · Yerel terminal: `portable-pty` · Telnet: ham TCP (tokio) · Serial: `serialport` · VNC: `@novnc/novnc` (Rust TCP↔WS köprüsü) · RDP: harici istemci (mstsc/xfreerdp) + uygulama içi `ironrdp-wasm` (RDCleanPath proxy'si Rust'ta sürüyor) |
| Ağ/Kripto | Sync/cloud/AI: `reqwest` · Payload: `scrypt` + AES-256-GCM · At-rest sırlar: OS anahtarlığı (`keyring`) + AES-256-GCM |
| Güvenlik | Sırlar OS anahtarlığında şifrelenir; WebView'a düz metin credential gitmez. Tüm ağ/PTY/kripto işleri Rust arka uçta yaşar. |

## Mimari

```text
src/                    # Vue uygulaması (WebView)
├── bridge/connexa.ts   # window.connexa köprüsü → Tauri invoke/listen
├── views/              # WorkspaceView (oturumlar), SettingsView, TunnelsView…
├── components/         # TerminalPane, VncPane, RdpPane, SftpPanel…
├── stores/             # vault, sessions, settings (Pinia)
├── i18n/locales/       # tr, en
└── shared/types.ts     # Arka uç ↔ WebView ortak tipler

src-tauri/              # Rust arka uç — tüm ağ/PTY/kripto işleri
├── src/
│   ├── lib.rs          # Tauri kurulumu + 48 komut kaydı
│   ├── vault.rs        # Şifreli host/kimlik/grup deposu (vault.json)
│   ├── crypto.rs       # At-rest (keychain) + taşınabilir (scrypt/AES-GCM)
│   ├── session.rs      # SessionManager — pty/ssh/telnet/serial + event
│   ├── ssh.rs          # russh: bağlan/auth/shell/exec
│   ├── sftp.rs · tunnel.rs · metrics.rs · recording.rs · proxy.rs
│   ├── import.rs · http.rs · ai.rs · plugins.rs · alarm.rs
│   └── commands/       # #[tauri::command] yüzeyi
└── tauri.conf.json     # Pencere, CSP, paketleme
```

Veri modeli Termius taksonomisini izler: **Host / Group / Identity** ayrımı — kimlikler hostlardan bağımsız tanımlanır ve yeniden kullanılır.

## Geliştirme

```bash
npm install        # frontend bağımlılıkları
npm run dev        # yalnız WebView (Vite HMR) — Rust olmadan
npm run tauri:dev  # tam uygulama (Rust arka uç + WebView), ilk derleme uzun sürer
npm run typecheck  # vue-tsc tip kontrolü
npm run build      # frontend üretim derlemesi (dist/)
npm run tauri:build  # paketleme (dmg/app · nsis · deb/AppImage)
```

Gereksinimler: Node ≥ 20 ve Rust araç zinciri (bkz. `src-tauri/rust-toolchain.toml`, sabit 1.96.1).

## Yol Haritası (özet)

**Tamamlanan (mevcut durum):**

- ✅ SSH terminal (parola/anahtar/agent) + xterm.js WebGL
- ✅ SSH oturumunda otomatik SFTP paneli (listele, indir, yükle, yeniden adlandır, sil, mkdir)
- ✅ Telnet ve yerel terminal
- ✅ VNC (noVNC + Rust TCP↔WS köprüsü) · harici RDP istemcisi (mstsc/xfreerdp)
- 🚧 Uygulama içi RDP (ironrdp-wasm): RDCleanPath proxy'sinin Rust portu sürüyor
- ✅ Host / Kimlik / Grup yönetimi, grup ağacı + ayar kalıtımı (grup varsayılan kimliği)
- ✅ Şifreli yerel vault (OS keychain)
- ✅ İçe aktarma: `~/.ssh/config` + mRemoteNG (confCons.xml)
- ✅ TR/EN yerelleştirme, açık/koyu tema
- ✅ Komut parçacığı (snippet) kütüphanesi
- ✅ Broadcast modu (bir terminale yazılanı tüm terminallere yansıtma) + snippet'i çoklu oturumda çalıştırma
- ✅ Komut paleti / launcher (Cmd/Ctrl+K veya Alt+M — host, snippet ve eylem araması)
- ✅ Grafiksel SSH tünel yöneticisi: yerel (-L), uzak (-R), dinamik/SOCKS5 (-D)
- ✅ Split pane (aktif sekmeyi yatay/dikey bölerek yan yana terminaller)
- ✅ İçe aktarma: Termius (JSON) — `~/.ssh/config` ve mRemoteNG'ye ek olarak
- ✅ Zero-knowledge senkronizasyon: GitHub Gist / WebDAV (scrypt + AES-256-GCM, parola cihazda kalır)
- ✅ RDP için harici istemci fallback (xfreerdp / mstsc / Microsoft Remote Desktop — 1Remote "runner" deseni)
- ✅ Sunucu izleme paneli (CPU/load, bellek, disk, süreçler — SSH exec ile 5 sn'de bir)
- ✅ Oturum kaydı (asciicast v2 .cast — asciinema ile oynatılabilir)
- ✅ Bulut envanteri (DigitalOcean / Hetzner API → otomatik SSH host içe aktarımı)
- ✅ Parola yöneticisi entegrasyonu (Bitwarden `bw` / 1Password `op` / özel komut — bağlantı anında çözülür, vault'ta saklanmaz)
- ✅ Eşik bazlı alarmlar (CPU/RAM/disk → ntfy veya webhook bildirimi, arka planda izleme)
- ✅ AI komut asistanı (kendi Anthropic/Claude API anahtarıyla, streaming; komutu terminale ekleme)
- ✅ Eklenti sistemi (bildirimsel snippet paketleri — kod çalıştırmaz, komut paletine katkı sunar)

- ✅ Serial (seri port) protokolü — `serialport` ile cihaz yolu + baud hızı
- ✅ Terminal tema sistemi (Connexa Dark, Dracula, Solarized, Nord, Gruvbox — canlı uygulanır)
- ✅ Ekip vault paylaşımı (host/grup/snippet'i ekiple şifreli paylaş — Gist/WebDAV, zero-knowledge; **kişisel parolalar paylaşılmaz**, yalnızca kullanıcı adı/anahtar yolu/parola-yöneticisi referansı gider)

**v2 ve ötesi tamamlandı.** Sonraki fikirler: self-hosted sync sunucusu, SPICE/Mosh protokolleri.

**v2:** Sysadmin araç kutusu (log viewer, disk analizörü, servis yönetimi), host izleme + alarm, bulut sağlayıcı envanteri, parola yöneticisi entegrasyonları, plugin sistemi.

Detaylı yol haritası ve teknik risk analizi için [analiz raporuna](docs/CONNEXA_RAKIP_ANALIZ_RAPORU.md) bakın (§7–8).

## Lisans

[MIT](LICENSE)
