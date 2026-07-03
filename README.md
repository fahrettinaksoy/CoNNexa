# Connexa

SSH / RDP / VNC / Telnet **Remote Access Manager** — Vue 3 + Electron ile geliştirilen, yerel-öncelikli (local-first), çapraz platform bağlantı yöneticisi.

> Ürün stratejisi, rakip analizi ve mimari kararlar için: [docs/CONNEXA_RAKIP_ANALIZ_RAPORU.md](docs/CONNEXA_RAKIP_ANALIZ_RAPORU.md)

## Teknoloji Stack'i

| Katman | Teknoloji |
| --- | --- |
| UI | Vue 3 (Composition API) · Vuetify · Pinia · Vue Router · Vue I18n (TR/EN) · VueUse |
| Masaüstü | Electron + electron-vite + electron-builder |
| Terminal | @xterm/xterm (WebGL renderer) |
| Protokoller | SSH/SFTP: `ssh2` · Yerel terminal: `node-pty` · Telnet: raw TCP · VNC: `@novnc/novnc` (yerel TCP↔WS köprüsü) · RDP: `ironrdp-wasm` (istemci taraflı WASM + RDCleanPath proxy) |
| Güvenlik | Sırlar Electron `safeStorage` (OS keychain) ile şifrelenir; renderer'a düz metin credential gitmez |

## Mimari

```text
src/
├── main/               # Electron main süreci — tüm ağ/PTY/kripto işleri burada
│   ├── index.ts        # Pencere + yaşam döngüsü
│   ├── ipc.ts          # Dar, tipli IPC yüzeyi
│   ├── vault/          # VaultStore — şifreli host/kimlik/grup deposu
│   └── sessions/       # SessionManager — node-pty / ssh2 / telnet oturumları
├── preload/            # contextBridge ile window.connexa API'si
├── renderer/src/       # Vue uygulaması
│   ├── views/          # WorkspaceView (oturumlar), SettingsView
│   ├── components/     # TerminalPane, HostDialog, IdentityDialog
│   ├── stores/         # vault, sessions, settings (Pinia)
│   └── i18n/locales/   # tr, en
└── shared/types.ts     # Main ↔ renderer ortak tipler
```

Veri modeli Termius taksonomisini izler: **Host / Group / Identity** ayrımı — kimlikler hostlardan bağımsız tanımlanır ve yeniden kullanılır.

## Geliştirme

```bash
npm install        # bağımlılıklar + native modüllerin Electron için derlenmesi
npm run dev        # geliştirme modunda başlat (HMR)
npm run typecheck  # main + renderer tip kontrolü
npm run build      # üretim derlemesi (out/)
npm run build:mac  # paketleme (dmg/zip) — build:win, build:linux de mevcut
```

**Sorun giderme:**

- `Error: Electron uninstall` → Electron binary'si inmemiş: `node node_modules/electron/install.js`
- `Cannot read properties of undefined (reading 'whenReady')` → kabuk ortamında `ELECTRON_RUN_AS_NODE` set edilmiş (VSCode eklenti ortamlarında görülür): `ELECTRON_RUN_AS_NODE= npm run dev`

## Yol Haritası (özet)

**Tamamlanan (mevcut durum):**

- ✅ SSH terminal (parola/anahtar/agent) + xterm.js WebGL
- ✅ SSH oturumunda otomatik SFTP paneli (listele, indir, yükle, yeniden adlandır, sil, mkdir)
- ✅ Telnet ve yerel terminal
- ✅ VNC (noVNC + yerel TCP↔WS köprüsü) ve RDP (ironrdp-wasm + RDCleanPath proxy)
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
