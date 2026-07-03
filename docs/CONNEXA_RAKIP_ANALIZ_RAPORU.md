# Connexa — Rakip &amp; Pazar Analiz Raporu

**Proje:** Connexa — RDP / SSH / VNC / Telnet Remote Access Manager
**Hedef Stack:** Vue.js 3 · Electron · Vuetify 3 · Pinia · VueUse · Vue I18n · Vue Router
**Rapor Tarihi:** 3 Temmuz 2026
**Kapsam:** 16 rakip/benzer ürün ve projenin derinlemesine analizi

---

## İçindekiler

1. [Yönetici Özeti](#1-yönetici-özeti)
2. [Proje Analiz Kartları](#2-proje-analiz-kartları)
3. [Karşılaştırmalı Genel Tablo](#3-karşılaştırmalı-genel-tablo)
4. [Özellik Matrisi](#4-özellik-matrisi)
5. [Pazar Boşlukları ve Konumlandırma](#5-pazar-boşlukları-ve-konumlandırma)
6. [Connexa için Mimari Öneriler (Vue + Electron)](#6-connexa-için-mimari-öneriler-vue--electron)
7. [Özellik Yol Haritası: MVP → v2](#7-özellik-yol-haritası-mvp--v2)
8. [Teknik Riskler ve Azaltma Stratejileri](#8-teknik-riskler-ve-azaltma-stratejileri)
9. [İş Modeli Dersleri](#9-iş-modeli-dersleri)
10. [Kaynaklar](#10-kaynaklar)

---

## 1. Yönetici Özeti

16 ürünün analizi sonucunda ortaya çıkan en kritik bulgu şudur: **"Cross-platform + geniş protokol desteği (SSH+SFTP+RDP+VNC+Telnet) + modern/rafine UX + yerel-öncelikli (local-first) veri modeli" kombinasyonunu bir arada sunan hiçbir ürün yok.**

- **mRemoteNG** (10.9k★) ve **1Remote** (6k★) protokolde geniş ama **Windows'a kilitli** ve UI'ları eski.
- **RustConn** protokolde en geniş ama **sadece Linux**.
- **Termius** (2M+ kullanıcı) UX'te lider ama **RDP/VNC yok**, senkronizasyon paywall arkasında ve kapalı kaynak.
- **electerm** (14.4k★) Connexa'ya en yakın mimari emsal — Electron'da SSH/SFTP/RDP/VNC/Telnet/Serial'ı kanıtlamış — ama UI'sı dağınık ve cilasız.
- **Termix** (13.9k★) özellik seti en zengin proje ama **self-hosted web-first** — kurulum bariyeri yüksek, gerçek yerel-öncelikli masaüstü deneyimi değil.

**Connexa'nın fırsat penceresi:** electerm'in kanıtladığı teknik temeli (node-pty + xterm.js + ssh2 + ironrdp-wasm + noVNC), Termius kalitesinde bir Vue/Vuetify UI ve local-first + opsiyonel zero-knowledge senkronizasyon modeliyle birleştirmek. Teknik açıdan en riskli alan **Electron içinde native kalitede RDP** — bunun için iki kanıtlanmış yol mevcut (bkz. Bölüm 8).

---

## 2. Proje Analiz Kartları

### 2.1 Termix — `github.com/Termix-SSH/Termix`

| | |
|---|---|
| **Kategori** | Self-hosted web tabanlı çok protokollü erişim platformu |
| **Stack** | TypeScript (%97), React 19, TailwindCSS 4, Radix UI (shadcn/ui), Vite, Express 5, better-sqlite3 + Drizzle ORM (şifreli SQLite), Electron 42 |
| **Terminal/Protokol motorları** | @xterm/xterm v6, ssh2, **guacamole-lite** (RDP/VNC), serialport v13 |
| **Protokoller** | SSH (jump host, agent forwarding, TOTP), SFTP, RDP, VNC, Telnet, Serial, SSH tünel + SOCKS5 |
| **Lisans / Model** | Apache 2.0 — "forever-free", bağış tabanlı |
| **Popülerlik** | ~13.9k★, 599 fork, v2.5.0 (Haziran 2026), çok aktif |

**Öne çıkanlar:** Etiketli/iç içe klasörlü host yöneticisi, 4'lü split terminal, uzak dosya yöneticisi, Docker/Podman yönetimi, host metrik izleme + alarm (ntfy/webhook), sürükle-bırak dashboard, snippet + komut yayını (broadcast), cihazlar arası kalıcı sekmeler, OIDC/LDAP/passkey ile kurumsal auth, ~30 dil.

**Mimari:** Öncelikle Docker ile self-host edilen web platformu; Electron ve mobil uygulamalar bu web codebase'ini sarar. RDP/VNC sunucu tarafında Guacamole protokolüyle stream edilir.

**Connexa için ders:**
- ✅ guacamole-lite, RDP/VNC için "sunucu taraflı proxy" yolunun kanıtı.
- ✅ Şifreli SQLite + Drizzle veri katmanı iyi referans.
- ⚠️ Self-hosted-first model kurulum bariyeri yaratıyor; Electron istemcisi gerçek local-first değil — Connexa tam bu boşluğu doldurabilir.
- ⚠️ Özellik enflasyonu → dik öğrenme eğrisi.

---

### 2.2 1Remote — `github.com/1Remote/1Remote`

| | |
|---|---|
| **Kategori** | Native Windows çok protokollü bağlantı yöneticisi (eski adı PRemoteM) |
| **Stack** | C# (%96.8), WPF/.NET, Dragablz sekme kütüphanesi |
| **Protokol motorları** | RDP: **MSTSC ActiveX (AxMSTSCLib)**, VNC: VncSharpCore, SSH/Telnet: gömülü KiTTY/PuTTY + kullanıcı tanımlı harici "runner"lar |
| **Protokoller** | RDP (RemoteApp dahil), SSH, VNC, Telnet, SFTP, FTP + harici runner ile genişletme |
| **Lisans / Model** | GPL-3.0, ücretsiz, bağış |
| **Popülerlik** | ~6k★, 488 fork, v1.2.1 (Ağustos 2025), orta tempo |

**Öne çıkanlar:** **Alt+M "Launcher"** (Spotlight benzeri hızlı bağlantı başlatıcı — ayırt edici UX), etiket/ikon/renk, bağlantı öncesi/sonrası script'ler, çoklu ekran + HiDPI RDP (4K), mRemoteNG import, portable çalışma.

**Connexa için ders:**
- ✅ Launcher (Alt+M) UX'i birebir alınmaya değer fikir.
- ✅ "Runner" soyutlaması (gömülü motor yerine harici araca delege etme) esnek mimari deseni.
- ⚠️ Windows'ta en iyi RDP deneyimi native MSTSC gömme ile elde ediliyor — Electron'da bu kaliteye ulaşmak en zor iş.
- ⚠️ GPL-3.0: kod alıntılamayın, sadece fikir alın.

---

### 2.3 Snowflake / Muon — `github.com/subhra74/snowflake`

| | |
|---|---|
| **Kategori** | SSH/SFTP odaklı grafiksel "sysadmin araç kutusu" |
| **Stack** | Java (%99), Swing UI, JSch (SSH), Maven |
| **Protokoller** | Yalnızca SSH + SFTP |
| **Lisans / Model** | GPL-3.0, ücretsiz |
| **Popülerlik** | Orijinal repo ~2.2k★ ama **fiilen terk edilmiş** (son release Şubat 2020); topluluk devamı `devlinx9/muon-ssh` (283★, v3.0.0 Nisan 2025) |

**Öne çıkanlar:** Gelişmiş SFTP dosya yöneticisi, sudo destekli uzak metin editörü (syntax highlight), **terabayt ölçekli uzak log görüntüleyici**, `find` tabanlı uzak arama, görev yöneticisi (CPU/RAM/süreç), görsel disk alanı analizörü, systemd servis yönetimi, ağ araçları (ping/traceroute/DNS). Felsefesi: "terminal kullanmadan sunucu yönetimi" — GUI işlemleri arka planda shell komutlarına çevrilir.

**Connexa için ders:**
- ✅ "Sysadmin araç kutusu" konsepti (log viewer, disk analizörü, servis yönetimi) modern UI ile hâlâ boş bir alan — Connexa v2 için güçlü farklılaştırıcı.
- ⚠️ Tek geliştirici bağımlılığı projeyi öldürdü (bus factor uyarısı).

---

### 2.4 electerm — `github.com/electerm/electerm` ⭐ *Connexa'ya en yakın referans*

| | |
|---|---|
| **Kategori** | Electron tabanlı çok protokollü terminal/dosya yöneticisi |
| **Stack** | JavaScript (%96.6), React 19 + Ant Design 6, Vite 8, Electron 41 |
| **Protokol motorları** | **node-pty** (yerel terminal), **@xterm/xterm v6** (webgl/fit/search addon'ları), **@electerm/ssh2**, serialport v13, basic-ftp, **@novnc/novnc** (VNC), **ironrdp-wasm** (RDP — Devolutions IronRDP'nin WASM derlemesi), spice-client, trzsz2/zmodem2 |
| **Protokoller** | SSH, SFTP, FTP, Telnet, Serial, RDP, VNC, SPICE + yerel terminal — açık kaynaktaki en geniş yelpazelerden |
| **Lisans / Model** | **MIT** (inceleme/alıntı için en güvenli lisans), ücretsiz, bağış |
| **Popülerlik** | ~14.4k★, 1.2k fork, 562 release (Haziran 2026), çok yüksek tempo — ama ağırlıklı tek çekirdek geliştirici |

**Öne çıkanlar:** Bookmark tabanlı bağlantı yöneticisi, **GitHub Gist / Gitee / WebDAV / özel sunucu senkronizasyonu** (sunucu maliyetsiz sync modeli), SSH tünel + port forwarding, quick command (snippet), terminal broadcast, uzak dosya yöneticisi + uzak dosya düzenleme, **AI asistan** (OpenAI/DeepSeek/özel API) + MCP widget, tema mağazası, global kısayol, `ssh://` deep link, 15+ dil, electerm-web ile aynı çekirdeğin tarayıcı sürümü.

**Mimari:** Klasik Electron main/renderer ayrımı — main süreçte node-pty/ssh2/serialport gibi native modüller, renderer'da React + xterm.js. RDP/VNC/SPICE **istemci taraflı WASM/JS** ile renderer içinde çözülüyor (native bağımlılıksız cross-platform RDP).

**Connexa için ders:**
- ✅ Bağımlılık "alışveriş listesi" doğrudan kopyalanabilir: `node-pty + @xterm/xterm + ssh2 + serialport + ironrdp-wasm + @novnc/novnc`.
- ✅ Gist/WebDAV sync modeli sıfır sunucu maliyetiyle senkronizasyon sağlıyor.
- ✅ MIT lisans — kod inceleme/alıntı güvenli.
- ⚠️ UI yoğun ve dağınık (antd varsayılanları, ayar karmaşası) — **Vue/Vuetify ile rafine UI, Connexa'nın ana farklılaşma alanı.**
- ⚠️ 305 açık issue + tek geliştirici = sürdürülebilirlik riski örneği.

---

### 2.5 RustConn — `github.com/totoshko88/RustConn`

| | |
|---|---|
| **Kategori** | Native Linux (GTK4) çok protokollü bağlantı yöneticisi |
| **Stack** | Rust (%98.7), GTK4 + libadwaita, VTE terminal; modüler crate mimarisi (`rustconn-core`, `rustconn-cli`…) |
| **Protokol motorları** | IronRDP/FreeRDP (RDP), vnc-rs (VNC), spice-client (SPICE), picocom (Serial, harici) |
| **Protokoller** | SSH (L/R/D forwarding), SFTP, RDP, VNC, SPICE, Telnet, Serial, Mosh (harici), Kubernetes (kubectl exec), **Zero Trust:** AWS SSM, GCP IAP, Azure, OCI, Cloudflare, Teleport, Tailscale |
| **Lisans / Model** | GPL-3.0, ücretsiz, bağış |
| **Popülerlik** | ~423★, 168 release, v0.17.7 (Temmuz 2026), çok aktif |

**Öne çıkanlar:** Split terminal, snippet, oturum kaydı (session recording), **KeePassXC/libsecret/Bitwarden CLI/1Password CLI entegrasyonu**, FIDO2/YubiKey/akıllı kart SSH auth, expect kuralları + pre/post-connect görevleri, cluster/broadcast komut, Wake-on-LAN, Google Drive/Syncthing/Nextcloud/Dropbox sync, 17 dil, headless CLI.

**Connexa için ders:**
- ✅ Parola yöneticisi entegrasyonları (KeePassXC/Bitwarden/1Password) çok değerli ve az rastlanan özellik.
- ✅ "Gömülü istemci + harici araca fallback" hibrit deseni Electron'da da uygulanabilir.
- ⚠️ Sadece Linux — cross-platform boşluğu Connexa'nın fırsatı.
- ⚠️ Bu kadar protokolü gömülü desteklemek büyük bakım yükü; MVP'de kapsam disiplini şart.

---

### 2.6 Voltius — `github.com/VoltiusApp/voltius`

| | |
|---|---|
| **Kategori** | Tauri tabanlı açık kaynak Termius alternatifi (SSH odaklı) |
| **Stack** | React 19 + TypeScript (%81) + Tailwind, **Tauri 2 + Rust** (%17.7), xterm.js (WebGL), russh (saf Rust SSH), sync sunucusu: Rust + Axum + PostgreSQL; kripto: Argon2id + HKDF-SHA256 + XChaCha20-Poly1305 |
| **Protokoller** | SSH, SFTP, Serial, Docker API, Proxmox LXC — **RDP/VNC/Telnet yok** |
| **Lisans / Model** | AGPLv3 çekirdek + MIT eklentiler; freemium (Free → Pro/Teams → Business) |
| **Popülerlik** | ~400★ (24 saatte 200+ — viral ivme), v0.8.1 (Temmuz 2026), **Beta** |

**Öne çıkanlar:** **Local-first + zero-knowledge E2EE sync** (GitHub Gist üzerinden ücretsiz veya self-hosted sunucu), tmux/screen ile kalıcı oturumlar, **cihazlar arası canlı oturum devri**, sınırsız split pane + broadcast, komut paleti, plugin sistemi + registry, **Termius'tan 1 tıkla import**, sistem izleme, OS keychain + master parola, ~40 MB kurulum / ~300 MB RAM (Termius ~500 MB+ ile kıyaslıyor).

**Connexa için ders:**
- ✅ "Açık kaynak Termius alternatifi" konumlandırmasının viral çalıştığının kanıtı.
- ✅ E2EE sync mimarisi (Argon2id + XChaCha20) referans şablon.
- ✅ Termius import — benimseme hızlandırıcı, Connexa'da mutlaka olmalı.
- ⚠️ Tauri'nin RAM/boyut avantajını Electron'a karşı pazarlama silahı yapıyorlar — Connexa'nın Electron seçiminde performans anlatısı baştan planlanmalı.
- ⚠️ AGPL — kod kopyalamayın.

---

### 2.7 SSH Deck — `sshdeck.gscodes.dev`

| | |
|---|---|
| **Kategori** | Kapalı kaynak, SSH/SFTP odaklı basit masaüstü istemci |
| **Stack** | Açıklanmıyor (auto-updater ifadesi Electron/Tauri'ye işaret ediyor ama doğrulanamadı); AES-256-GCM + OS keychain |
| **Protokoller** | SSH, SFTP — kapsam dar |
| **Lisans / Model** | Kapalı kaynak; Free (tek cihaz) / Pro (bulut sync, fiyat ilan edilmemiş) |
| **Popülerlik** | Çok düşük görünürlük — GitHub yok, inceleme yok; erken aşama/niş |

**Öne çıkanlar:** Sınırsız sunucu, etiket/klasör, SSH anahtar yönetimi, opsiyonel zero-knowledge sync, "SSH trafiğinizi asla proxy'lemeyiz" doğrudan bağlantı garantisi, entegre SFTP paneli, çevrimdışı çalışma.

**Connexa için ders:**
- ✅ "Zero-knowledge + trafiği proxy'lemeyiz" güven anlatısı pazarlamada aynen kullanılabilir.
- ⚠️ **Ders:** Kapalı kaynak + sıfır görünürlük + dar özellik = pazarda iz bırakamama. Voltius'un açık kaynak stratejisiyle tam kontrast.

---

### 2.8 Xcasca — `xcasca.com`

| | |
|---|---|
| **Kategori** | NetSarang'ın (Xshell/Xftp üreticisi) yeni cross-platform SSH/SFTP istemcisi (PortX'in devamı) |
| **Stack** | Kapalı kaynak; masaüstü + mobil tek ürün ailesi (framework doğrulanamadı) |
| **Protokoller** | SSH, SFTP (masaüstü), **AWS S3 + Google Cloud Storage** transferi (Plus) — RDP/VNC/Telnet yok |
| **Lisans / Model** | Kapalı; **Free ($0)** / **Plus ($4/ay yıllık, 90 gün deneme)** — sync, E2EE, 2FA, S3/GCS Plus'ta |
| **Popülerlik** | Yeni marka (2025), arkasında 25+ yıllık NetSarang |

**Öne çıkanlar:** Windows/macOS/Linux/Android/iOS tam platform kapsamı, masaüstü↔mobil E2EE oturum senkronizasyonu, klasör tabanlı oturumlar, split screen, port forwarding (ücretli), mobilde Compose Bar.

**Connexa için ders:**
- ✅ $4/ay + 90 gün deneme — sürdürülebilir freemium fiyat çapası referansı.
- ⚠️ Port forwarding gibi temel özellikleri paywall'a koymak tepki çeken model — Connexa ücretsiz katmanı cömert tutmalı.
- 💡 Kurumsal bir oyuncunun bile RDP/VNC'ye girmemesi, Connexa'nın çok protokollü konumlanmasını değerli kılıyor.

---

### 2.9 sshPilot — `github.com/mfat/sshpilot`

| | |
|---|---|
| **Kategori** | Native Linux/macOS GTK4 SSH istemcisi |
| **Stack** | Python (~%98.6), GTK4 + libadwaita, VTE terminal, Paramiko, keyring (OS keychain), GtkSourceView |
| **Protokoller** | SSH, SFTP (dual-pane), SCP, Local/Remote/Dynamic (SOCKS) forwarding |
| **Lisans / Model** | GPL-3.0, ücretsiz |
| **Popülerlik** | ~964★, 130 release, v5.4.6 (Haziran 2026), aktif tek geliştirici |

**Öne çıkanlar:** Sekmeli minimal UI, grup + renk etiketleri, **broadcast commands**, keypair üretimi + ssh-copy-id, **mevcut `~/.ssh/config` ile uyumluluk** (kendi format dayatmıyor), **gizlilik modu** (ekran paylaşımında IP/hostname gizleme).

**Connexa için ders:**
- ✅ `~/.ssh/config` import/uyumluluk — benimseme kolaylığı için güçlü özellik.
- ✅ Gizlilik modu — az rastlanan, sevilen niş özellik.
- ⚠️ Python+GTK dağıtım zahmeti, Electron'un tek paket avantajının ters örneği.

---

### 2.10 WebSSH — `github.com/isontheline/pro.webssh.net`

| | |
|---|---|
| **Kategori** | Native Apple ekosistemi (iOS/iPadOS/macOS) SSH istemcisi |
| **Stack** | Kapalı kaynak native Swift uygulama + **xterm.js** terminal; GitHub reposu doküman/issue merkezi |
| **Protokoller** | SSH, SFTP, **Telnet**, local port forwarding; RSA/DSA/ED25519/**PuTTY formatı** anahtarlar; 2FA |
| **Lisans / Model** | Ticari; **tek seferlik ömür boyu satın alma (lifetime), abonelik yok** — ücretsiz sürümde 1 bağlantı limiti |
| **Popülerlik** | ~511★, 2012'den beri, aktif |

**Öne çıkanlar:** **mashREPL** (çevrimdışı yerel shell — ls/grep/curl/ping araç kutusu), başlangıç komutları, profil bazlı tema/font/kısayol, "veri cihaz dışına çıkmaz" gizlilik duruşu, tek satın almayla iPhone+iPad+Mac.

**Connexa için ders:**
- ✅ "Abonelik yok" konumlandırması Termius yorgunluğuna karşı güçlü pazarlama argümanı.
- ✅ "1 bağlantı" gibi çok basit freemium limiti — anlaşılır model örneği.
- ✅ xterm.js'in native app içinde bile tercih edilmesi, Electron+xterm.js kombinasyonunun kanıtı.

---

### 2.11 mRemoteNG — `github.com/mRemoteNG/mRemoteNG`

| | |
|---|---|
| **Kategori** | Windows'un klasik açık kaynak çok protokollü bağlantı yöneticisi |
| **Stack** | C# (%99.5), .NET 10, WinForms + ObjectListView, docking arayüz |
| **Protokol motorları** | RDP: Windows MSTSC ActiveX, SSH: gömülü PuTTY — "kabuk/orkestratör" mimarisi |
| **Protokoller** | **RDP, VNC, SSH (v1/v2), Telnet, HTTP/HTTPS, rlogin, Raw socket, PowerShell remoting** + harici bağlayıcılar (AnyDesk vb.) — en geniş yelpaze |
| **Lisans / Model** | GPL-2.0, ücretsiz, bağış |
| **Popülerlik** | **~10.9k★** — listedeki en popüler açık kaynak proje; ama tarihsel bakımcı krizleri ve release boşlukları yaşadı |

**Öne çıkanlar:** Dock'lanabilir çoklu oturum arayüzü, **hiyerarşik bağlantı ağacı + kalıtımlı (inheritance) ayarlar**, şifreli XML config, portable + MSI, sessiz kurumsal kurulum, harici araç entegrasyonu.

**Connexa için ders:**
- ✅ Kalıtımlı bağlantı ağacı (klasör ayarlarını alt öğelere devretme) kurumsal kullanıcıların gerçekten istediği model — Connexa veri modeline alınmalı.
- ⚠️ 10.9k★'a rağmen eski UI + Windows kilidi + senkronizasyonsuzluk = modern alternatifin doldurabileceği devasa boşluk. **Connexa'nın birincil hedef kitlesi mRemoteNG kullanıcıları olabilir** (mRemoteNG import özelliği kritik).
- ⚠️ Geçmiş şifreleme CVE'leri — credential güvenliğini baştan doğru tasarlamanın önemi.

---

### 2.12 Termius — `termius.com`

| | |
|---|---|
| **Kategori** | Kategori lideri ticari SSH istemcisi (kapalı kaynak) |
| **Stack** | **Electron masaüstü (React UI)** + native mobil (iOS/Android) + bulut sync backend'i — Electron'la bu kategoride 2M+ kullanıcıya ulaşılabildiğinin kanıtı |
| **Protokoller** | SSH, SFTP, **Mosh**, Telnet, port forwarding (L/R/D) — **RDP/VNC yok** |
| **Lisans / Model** | Kapalı kaynak, abonelik: Free / **Pro $10/ay** / **Team $20/kul/ay** / **Business $30/kul/ay** / Enterprise (SOC 2, SAML SSO) |
| **Popülerlik** | 2M+ mühendis, 5 platform |

**Öne çıkanlar:** **Vault** (E2EE bağlantı/kimlik deposu + cihazlar arası sync), **Workspace** (oturum geri yükleme), **Snippets** (+ çoklu sunucuda çalıştırma), **Groups** (ayar kalıtımı), **Keychain** (kimlikleri hostlardan ayırma), **AI otomatik tamamlama/komut üretimi** (ücretsiz planda bile), loglar, Known Hosts yönetimi, ekip vault'ları, gerçek zamanlı işbirliği.

**Connexa için ders:**
- ✅ **Ürün taksonomisi sektör standardı:** Hosts / Groups / Keychain (kimlik ayrımı) / Snippets / Vault / Port Forwarding — Connexa veri modeline doğrudan şablon.
- ✅ AI tamamlama artık "masa bahsi" (table stakes) haline geliyor.
- ⚠️ **En büyük şikayet:** senkronizasyonun paywall arkasında olması. Connexa ücretsiz/self-hosted sync ile tam buraya vurabilir.
- ⚠️ Kapalı kaynak + kimliklerin buluta gitmesi güvenlik hassasiyetli kurumlarda engel.

---

### 2.13 Royal TS — `royalapps.com/ts/win`

| | |
|---|---|
| **Kategori** | Kurumsal sınıf ticari bağlantı yöneticisi |
| **Stack** | Windows: C#/.NET (self-contained, WinForms + ribbon/dock); macOS (Royal TSX): tamamen ayrı native codebase; iOS/Android istemcileri. Protokol motorları üçüncü parti: MS RDP ActiveX + FreeRDP, Rebex + PuTTY (SSH), TightVNC/UltraVNC, CEF (web) |
| **Protokoller** | RDP, SSH, Telnet, VNC, FTP/SFTP/SCP, Web, **TeamViewer entegrasyonu**, VMware &amp; Hyper-V, PowerShell, Windows Services/Events/Processes, Performance View |
| **Lisans / Model** | **Lite ücretsiz** (10 bağlantı/10 credential/1 belge); **Single User €49 perpetual** ("abonelik yok" vurgusu); Royal Server (Secure Gateway) ayrı kurumsal ürün |
| **Popülerlik** | ~2010'dan beri, MSP/sysadmin çevrelerinde standart, çok olgun |

**Öne çıkanlar:** **"Document" tabanlı taşınabilir + şifreli konfigürasyon** (DB'siz ekip paylaşımı — ağ paylaşımı/Dropbox'ta belge + merge desteği), **credential'ların bağlantıdan ayrılması ve "name ile referans"** (kişisel kimlikleri paylaşmadan belge paylaşımı), KeePass/LastPass entegrasyonu, Command/Key Sequence Tasks (token'lı makrolar), **RoyalJSON dynamic folder** (harici envanterden dinamik bağlantı listesi), VPN otomasyonu, PowerShell cmdlet'leri.

**Connexa için ders:**
- ✅ Document modeli (tek dosyada taşınabilir şifreli workspace) + credential-by-name deseni taklit edilmeye değer.
- ✅ Dynamic folder (envanter API'sinden bağlantı üretme) güçlü kurumsal özellik.
- ✅ Protokol motorlarını üçüncü partiye delege etme stratejisi doğru yol.
- ⚠️ Win/Mac için iki ayrı codebase bakım maliyeti — Electron+Vue tam bu sorunu çözer.
- ⚠️ Ribbon + yüzlerce ayar = dik öğrenme eğrisi; Connexa sadeliği korumalı.

---

### 2.14 MobaXterm — `mobaxterm.mobatek.net`

| | |
|---|---|
| **Kategori** | Windows sysadmin'lerin fiili standart araç kutusu |
| **Stack** | Native Windows (Delphi), tek portable .exe; Cygwin tabanlı Unix araçları, PuTTY tabanlı terminal, gömülü X.org X server |
| **Protokoller** | SSH, SFTP, Telnet, RDP, VNC, FTP, **Mosh**, **X11/XDMCP**, rsh, rlogin, Serial (COM), WSL |
| **Lisans / Model** | Home ücretsiz (**12 oturum / 2 tünel / 4 makro** limiti, kurumsal kullanım yasak); **Pro $69 perpetual** + 12 ay güncelleme |
| **Popülerlik** | ~2008'den beri, Windows'ta fiili standartlardan |

**Öne çıkanlar:** **Gömülü X server** (kategorideki en ayırt edici özellik), **SSH açılınca otomatik yan SFTP paneli** (en sevilen desen), grafiksel tünel yöneticisi, makrolar, uzak izleme çubuğu, gömülü sunucular (TFTP/FTP/HTTP/SSH server/Cron), plugin sistemi, master password.

**Connexa için ders:**
- ✅ **SSH oturumu açılınca otomatik SFTP paneli — Connexa'da mutlaka olmalı** (kullanıcıların en sevdiği özellik).
- ✅ Grafiksel tünel yöneticisi iyi UX örneği.
- ⚠️ Eski UI + sadece Windows — cross-platform modern alternatif için doğal fırsat.
- ⚠️ Cygwin katmanı ağır/kırılgan — Unix araçlarını taklit etmek yerine node kütüphaneleri/sistem araçları kullanmak daha sürdürülebilir.

---

### 2.15 Ghostly Bridge — `ghostlyinc.com`

| | |
|---|---|
| **Kategori** | Bulut sunucu yönetimi + hızlı SSH/RDP erişim tray uygulaması |
| **Stack** | .NET / Blazor (Hybrid/WebView2), Windows, Microsoft Store; tek geliştirici |
| **Protokoller** | SSH, RDP, SSH tünelleri + **DigitalOcean/UpCloud API** (droplet start/stop/resize/backup) |
| **Lisans / Model** | Free (3 sunucu) / **Pro $11.39 tek seferlik** |
| **Popülerlik** | Düşük — yeni, niş, indie |

**Öne çıkanlar:** Tray uygulaması hafifliği, bulut sağlayıcı API'sinden sunucu listesi çekme, sürükle-bırak dosya yükleme, kaynak görüntüleme, "telemetri yok" gizlilik duruşu.

**Connexa için ders:**
- ✅ **Bulut sağlayıcı API entegrasyonu** (DO/Hetzner/AWS envanterinden otomatik bağlantı listesi) klasik istemcilerde olmayan güçlü farklılaştırıcı — ama ana ürün değil, ek özellik olmalı.
- ⚠️ "Sadece bulut API yönetimi" ürününün pazarı dar.

---

### 2.16 Aifetel / Oysape — `aifetel.cc`

| | |
|---|---|
| **Kategori** | SSH + DevOps otomasyon aracı |
| **Stack** | React + Ant Design frontend, **Python 3 + PyWebView** masaüstü (Electron değil), Docker'da self-hosted web sürümü |
| **Protokoller** | SSH (+ SSH üzerinden dosya işlemleri) — RDP/VNC/Telnet yok |
| **Lisans / Model** | BSD-3-Clause açık kaynak + SaaS katmanları (Free/Pro/Unlimited) |
| **Popülerlik** | Çok düşük (14★), tek geliştirici |

**Öne çıkanlar:** **Task/Pipeline** kavramı (kayıtlı komutları çoklu sunucuda sıralı orkestre etme — mini CI/CD), Docker Compose dağıtım yönetimi, yerleşik kod editörü, masaüstü + self-hosted web ikili dağıtımı.

**Connexa için ders:**
- ✅ Task/Pipeline fikri SSH istemcisini DevOps aracına yükseltiyor — v2+ için ilham.
- ⚠️ Güçlü üründe bile pazarlama/topluluk olmadan görünmezlik; PyWebView çift runtime dağıtım karmaşası — Electron'un tek paket avantajı.

---

## 3. Karşılaştırmalı Genel Tablo

| Ürün | Platform | Teknoloji | Protokoller | Sync | Lisans / Model | Popülerlik |
|---|---|---|---|---|---|---|
| **Termix** | Self-hosted web + Electron + mobil | TS/React/Express/Electron | SSH, SFTP, RDP, VNC, Telnet, Serial | Sunucu taraflı (self-hosted) | Apache 2.0, ücretsiz | 13.9k★ |
| **1Remote** | Windows | C#/WPF | RDP, SSH, VNC, Telnet, SFTP, FTP | Yok | GPL-3.0, ücretsiz | 6k★ |
| **Snowflake/Muon** | Win/Linux (Java) | Java Swing | SSH, SFTP | Yok | GPL-3.0, ücretsiz | 2.2k★ (terk) |
| **electerm** | Win/mac/Linux + web | JS/React/Electron | SSH, SFTP, FTP, Telnet, Serial, RDP, VNC, SPICE | Gist/WebDAV/özel | **MIT**, ücretsiz | 14.4k★ |
| **RustConn** | Sadece Linux | Rust/GTK4 | SSH, SFTP, RDP, VNC, SPICE, Telnet, Serial, Mosh, K8s, ZeroTrust | Drive/Syncthing/Nextcloud | GPL-3.0, ücretsiz | 423★ |
| **Voltius** | Win/mac/Linux (+Android yakında) | Tauri 2/Rust/React | SSH, SFTP, Serial, Docker, Proxmox | Zero-knowledge E2EE (Gist/self-host) | AGPLv3, freemium | ~400★ (viral, beta) |
| **SSH Deck** | mac/Win | Belirsiz (kapalı) | SSH, SFTP | Zero-knowledge (Pro) | Kapalı, freemium | Çok düşük |
| **Xcasca** | Win/mac/Linux/iOS/Android | Kapalı (NetSarang) | SSH, SFTP, S3/GCS | E2EE (Plus $4/ay) | Kapalı, freemium | Yeni |
| **sshPilot** | Linux/macOS | Python/GTK4 | SSH, SFTP, SCP | Yok | GPL-3.0, ücretsiz | 964★ |
| **WebSSH** | iOS/iPadOS/macOS | Native Swift + xterm.js | SSH, SFTP, Telnet | iCloud (sınırlı) | Kapalı, **lifetime** satın alma | 511★ |
| **mRemoteNG** | Windows | C#/.NET 10 WinForms | RDP, VNC, SSH, Telnet, HTTP, rlogin, Raw, PowerShell | Yok (XML dosya) | GPL-2.0, ücretsiz | **10.9k★** |
| **Termius** | 5 platform | **Electron** + native mobil | SSH, SFTP, Mosh, Telnet | E2EE bulut vault (**ücretli**) | Kapalı, abonelik $10–30/ay | 2M+ kullanıcı |
| **Royal TS** | Win + mac (ayrı codebase) + mobil | C#/.NET + native | RDP, SSH, Telnet, VNC, FTP/SFTP, Web, TeamViewer, Hyper-V/VMware | Belge dosyası (paylaşımlı) | Kapalı, **€49 perpetual** | Çok olgun |
| **MobaXterm** | Windows | Delphi + Cygwin + PuTTY | SSH, SFTP, Telnet, RDP, VNC, FTP, Mosh, X11, Serial, WSL | Yok | Kapalı, Home free / **Pro $69 perpetual** | Fiili standart |
| **Ghostly Bridge** | Windows | .NET/Blazor Hybrid | SSH, RDP + DO/UpCloud API | Yok | Kapalı, Pro **$11.39 tek seferlik** | Düşük |
| **Oysape** | Win/mac/Linux + web | Python/PyWebView/React | SSH | SaaS hesabı | BSD-3 + SaaS | 14★ |

---

## 4. Özellik Matrisi

✅ = var · 🟡 = kısmi/ücretli · ❌ = yok

| Özellik | Termix | electerm | mRemoteNG | Termius | Royal TS | MobaXterm | Voltius | RustConn | **Connexa (hedef)** |
|---|---|---|---|---|---|---|---|---|---|
| SSH | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ MVP |
| SFTP dosya yöneticisi | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ MVP |
| RDP | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ MVP/v1.x |
| VNC | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ v1.x |
| Telnet | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ MVP |
| Serial | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 🔮 v2 |
| Cross-platform (Win/mac/Linux) | ✅ | ✅ | ❌ | ✅ | 🟡 (2 codebase) | ❌ | ✅ | ❌ | ✅ MVP |
| Modern/rafine UI | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | 🟡 | ✅ **ana farklılaştırıcı** |
| Local-first veri | ❌ (server-first) | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ MVP |
| Ücretsiz/self-hosted sync | 🟡 (self-host zorunlu) | ✅ (Gist/WebDAV) | ❌ | ❌ (ücretli) | 🟡 (dosya) | ❌ | ✅ | ✅ | ✅ v1.x |
| OS keychain credential | ❌ | ❌ | ❌ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ MVP |
| Kimlik/host ayrımı (Keychain modeli) | 🟡 | ❌ | 🟡 | ✅ | ✅ | ❌ | 🟡 | 🟡 | ✅ MVP |
| Kalıtımlı bağlantı ağacı | 🟡 | ❌ | ✅ | ✅ (Groups) | ✅ | ❌ | ❌ | 🟡 | ✅ MVP |
| Snippet / quick command | ✅ | ✅ | ❌ | ✅ | ✅ | 🟡 (makro) | ✅ | ✅ | ✅ v1.x |
| Broadcast (çoklu terminale komut) | ✅ | ✅ | ❌ | 🟡 | ❌ | ✅ | ✅ | ✅ | ✅ v1.x |
| SSH tünel / port forwarding | ✅ | ✅ | ❌ | ✅ | 🟡 (Server ile) | ✅ | ❌ | ✅ | ✅ v1.x (grafiksel yönetici) |
| Split pane terminal | ✅ | ❌ | 🟡 (dock) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ v1.x |
| Launcher (hızlı bağlantı paleti) | 🟡 (komut paleti) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ v1.x (1Remote'dan ilham) |
| Rakiplerden import | ❌ | ❌ | 🟡 | 🟡 | ✅ | 🟡 | ✅ (Termius) | 🟡 | ✅ MVP (`~/.ssh/config`, mRemoteNG, Termius) |
| AI asistan | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | 🔮 v2 |
| Host metrik izleme | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ (bar) | ✅ | 🟡 | 🔮 v2 |
| Sysadmin araçları (log viewer, disk, servis) | 🟡 | ❌ | ❌ | ❌ | 🟡 | 🟡 | ❌ | ❌ | 🔮 v2 (Muon'dan ilham) |
| Bulut sağlayıcı API (envanter) | ❌ | ❌ | ❌ | ❌ | ✅ (RoyalJSON) | ❌ | 🟡 (Proxmox) | 🟡 (ZeroTrust) | 🔮 v2 |
| Parola yöneticisi entegrasyonu | ❌ | ❌ | ❌ | ❌ | ✅ (KeePass/LastPass) | ❌ | ❌ | ✅ (KeePassXC/BW/1P) | 🔮 v2 |
| Oturum kaydı (session recording) | ❌ | ❌ | ❌ | 🟡 (log) | ❌ | ❌ | ❌ | ✅ | 🔮 v2 |
| i18n çoklu dil | ✅ (~30) | ✅ (15+) | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ (17) | ✅ MVP (Vue I18n — TR+EN başlangıç) |

---

## 5. Pazar Boşlukları ve Konumlandırma

### 5.1 Tespit Edilen Boşluklar

1. **Çok protokol + cross-platform + modern UX üçlüsü boş.** Protokolde geniş olanlar (mRemoteNG, 1Remote, MobaXterm) Windows'a; RustConn Linux'a kilitli. Cross-platform olanlar (Termius, Voltius, Xcasca) SSH/SFTP'de dar. electerm ikisini birleştiriyor ama UX'i zayıf. **Connexa'nın birincil konumu burası.**

2. **mRemoteNG'nin modern halefi yok.** 10.9k★'lık kullanıcı kitlesi eski WinForms UI, senkronizasyonsuzluk ve Windows kilidiyle yaşıyor. mRemoteNG import + cross-platform + modern UI ile bu kitle doğrudan hedeflenebilir.

3. **"Senkronizasyon paywall'ı" tepkisi.** Termius'a yönelik en büyük şikayet. Ücretsiz Gist/WebDAV sync (electerm modeli) veya zero-knowledge self-hosted sync (Voltius modeli) ile güçlü kontrast kurulabilir.

4. **Abonelik yorgunluğu.** WebSSH ("lifetime"), Royal TS (€49 perpetual), MobaXterm ($69 perpetual), Ghostly ($11.39 tek seferlik) hepsi "abonelik yok" mesajını pazarlama silahı yapıyor. Connexa açık kaynak çekirdek + opsiyonel ücretli katman (Voltius modeli) veya perpetual Pro ile bu dalgaya binebilir.

5. **Modern "sysadmin araç kutusu" yok.** Muon'un konsepti (dev log görüntüleyici, disk analizörü, görev yöneticisi, systemd yönetimi) Java Swing'le öldü; modern muadili hâlâ yok — v2 farklılaştırıcısı.

6. **Türkçe yerelleştirme.** Bu kategoride Türkçe'ye ciddi yatırım yapan ürün yok; Vue I18n altyapısıyla TR pazarında doğal avantaj.

### 5.2 Önerilen Konumlandırma Cümlesi

&gt; **"Connexa: mRemoteNG'nin protokol genişliği, Termius'un kullanıcı deneyimi — açık kaynak, cross-platform ve verileriniz sizde."**

### 5.3 Rekabet Stratejisi Notları

- **Voltius'un viral büyümesi** (24 saatte 200+ yıldız) "açık kaynak Termius alternatifi" anlatısının çalıştığını kanıtlıyor; Connexa "açık kaynak mRemoteNG + Termius alternatifi" olarak daha geniş bir anlatıya sahip.
- **SSH Deck'in görünmezliği** kapalı+sessiz modelin öldürücülüğünü gösteriyor: açık kaynak + GitHub + erken topluluk şart.
- **Tauri karşılaştırması gelecek:** Voltius, RAM/boyut kıyasını pazarlama silahı yapıyor. Electron seçiminin savunusu hazır olmalı: olgun native modül ekosistemi (node-pty, ssh2, serialport), tek dil (JS/TS), kanıtlanmış emsaller (Termius, electerm, VS Code). Bellek disiplini baştan tasarım hedefi olmalı.

---

## 6. Connexa için Mimari Öneriler (Vue + Electron)

### 6.1 Genel Mimari

```
┌────────────────────────────────────────────────────────────┐
│ Renderer Process (sandbox, contextIsolation: true)          │
│  Vue 3 + Vuetify 3 + Pinia + Vue Router + Vue I18n + VueUse │
│  ├─ xterm.js v6 (WebGL addon) → terminal görünümleri        │
│  ├─ @novnc/novnc → VNC canvas                               │
│  ├─ ironrdp-wasm → RDP canvas (istemci taraflı, WASM)       │
│  └─ preload.ts → contextBridge ile tipli, dar IPC API       │
├────────────────────────────────────────────────────────────┤
│ Main Process (Node.js)                                      │
│  ├─ SessionManager: oturum yaşam döngüsü                    │
│  │   ├─ node-pty        → yerel terminal                    │
│  │   ├─ ssh2            → SSH/SFTP/tünel/jump host          │
│  │   └─ telnet socket   → Telnet                            │
│  ├─ VaultService: better-sqlite3 (SQLCipher/şifreli alan)   │
│  │   └─ safeStorage / keytar → OS keychain (master anahtar) │
│  ├─ SyncService: Gist / WebDAV / dosya (v1.x)               │
│  └─ ImportService: ~/.ssh/config, mRemoteNG XML, Termius    │
└────────────────────────────────────────────────────────────┘
```

**Temel prensipler:**

1. **Süreç ayrımı disiplini:** Tüm ağ/PTY/kripto işleri main process'te (veya utility process'lerde); renderer yalnızca görüntüleme. `contextIsolation: true`, `nodeIntegration: false`, preload'da dar ve tipli IPC yüzeyi.
2. **Oturum başına utility process (öneri):** Electron'un `utilityProcess` API'siyle her SSH/RDP oturumunu ayrı sürece almak, tek oturum çökmesinin uygulamayı düşürmesini engeller ve bellek ölçümünü kolaylaştırır (Tauri kıyasına karşı savunma).
3. **Veri modeli — Termius taksonomisi + mRemoteNG kalıtımı:**
   - `Host` (adres, protokol, ayarlar) · `Group` (iç içe, **ayar kalıtımı**) · `Identity` (kullanıcı/anahtar/parola — hostlardan ayrık, "name ile referans" Royal TS deseni) · `Snippet` · `Tunnel` · `Tag`.
4. **TypeScript zorunlu** (electerm'in JS codebase'i sürdürülebilirlik açısından ders) + Vite + electron-builder; pinia store'ları oturum durumu (UI) ile kalıcı veri (vault) arasında net ayrım yapmalı.

### 6.2 Protokol Motoru Seçimleri (kanıtlanmış "alışveriş listesi")

| İhtiyaç | Kütüphane | Kanıt |
|---|---|---|
| Yerel terminal PTY | `node-pty` | electerm, VS Code |
| Terminal render | `@xterm/xterm` v6 + `addon-webgl`, `addon-fit`, `addon-search` | electerm, Termix, Termius, WebSSH |
| SSH / SFTP / tünel | `ssh2` (veya `@electerm/ssh2` fork'u) | electerm, Termix |
| Telnet | saf TCP socket + xterm.js (basit protokol) | electerm |
| **RDP — Yol A (istemci taraflı)** | `ironrdp-wasm` (Devolutions IronRDP WASM) | electerm |
| **RDP — Yol B (yardımcı süreç)** | FreeRDP binary'sine delege / guacamole-lite proxy | 1Remote (runner), Termix |
| VNC | `@novnc/novnc` (websockify köprüsü main'de) | electerm, Termix |
| Serial (v2) | `serialport` | electerm, Termix |
| Credential saklama | Electron `safeStorage` + OS keychain; vault dosyası için AES-256-GCM / XChaCha20-Poly1305, anahtar türetme Argon2id | Voltius, SSH Deck, sshPilot |

**RDP önerisi:** MVP'de **Yol A (ironrdp-wasm)** ile başlayın — native bağımlılık yok, cross-platform, electerm'de kanıtlı. NLA/CredSSP, çoklu ekran, yüksek DPI gibi ileri senaryolar için v1.x'te **Yol B**'yi (FreeRDP'ye "runner" fallback, 1Remote deseni) ekleyin. Native MSTSC kalitesi hedef değil; "yeterince iyi + her platformda aynı" hedeftir.

### 6.3 Vue Ekosistemi Eşlemesi

- **Vuetify 3:** bağlantı ağacı (`v-treeview`), oturum sekmeleri (`v-tabs` + taşınabilir sekme için özel bileşen), komut paleti (`v-dialog` + autocomplete), tema sistemi (Vuetify theme API — açık/koyu + terminal renk şemalarıyla senkron).
- **Pinia:** `useHostsStore` (vault verisi, main'den IPC ile hydrate), `useSessionsStore` (açık oturumlar, durumları), `useSettingsStore`, `useSyncStore`. Kalıcılık renderer'da değil main'de (vault) — pinia sadece görünüm durumu.
- **VueUse:** `useEventListener` (kısayollar), `useResizeObserver` (xterm fit), `useDark`, `useDebounceFn` (arama), `useClipboard`.
- **Vue Router:** `/hosts`, `/session/:id`, `/settings`, `/sync`, `/import` — çoklu pencere desteği için route tabanlı pencere içerikleri.
- **Vue I18n:** başlangıçta TR + EN; anahtar tabanlı yapı, Crowdin/Weblate topluluk çevirisine hazır (Termix ~30 dile bu yolla ulaştı).

### 6.4 Güvenlik Mimarisi (baştan tasarlanmalı — mRemoteNG CVE dersi)

1. **Master anahtar** OS keychain'de (`safeStorage`); vault dosyası AES-256-GCM/XChaCha20 ile şifreli; anahtar türetmede Argon2id (Voltius emsali).
2. Parolalar/anahtarlar **asla** renderer'a düz metin gitmez; IPC yalnızca oturum ID'leriyle çalışır ("connect(hostId)" — credential main'de çözülür).
3. Known hosts doğrulaması + host key değişim uyarısı (MITM koruması) MVP'de olmalı.
4. Sync her zaman **zero-knowledge**: veri cihazdan şifreli çıkar ("trafiğinizi asla proxy'lemeyiz" garantisi — SSH Deck/Voltius anlatısı).
5. Gizlilik modu (sshPilot deseni): ekran paylaşımında IP/hostname maskeleme — ucuz ama sevilen özellik.

---

## 7. Özellik Yol Haritası: MVP → v2

### MVP (v0.1–v0.9) — "electerm çekirdeği + Termius veri modeli + rafine UI"

**Hedef:** 3–4 ayda kullanılabilir, tek paket, cross-platform istemci.

- ✅ SSH terminal (ssh2 + xterm.js/WebGL): parola, anahtar, agent, keyboard-interactive, jump host
- ✅ SFTP: **SSH oturumu açılınca otomatik yan panel** (MobaXterm deseni), sürükle-bırak
- ✅ Telnet + yerel terminal (node-pty)
- ✅ RDP (ironrdp-wasm — temel senaryo) &amp; VNC (noVNC)
- ✅ Bağlantı yöneticisi: iç içe gruplar + **ayar kalıtımı**, etiket/renk/ikon, arama
- ✅ Identity/Keychain modeli (kimlik–host ayrımı, name ile referans)
- ✅ Şifreli yerel vault + OS keychain; known-hosts yönetimi
- ✅ **Import: `~/.ssh/config`, mRemoteNG XML, Termius** (benimseme hızlandırıcı — kritik)
- ✅ Sekmeli arayüz, açık/koyu tema, TR+EN i18n
- ❌ Bilinçli olarak MVP dışı: Serial, SPICE, Mosh, mobil, sync, plugin

### v1.x — "Farklılaşma katmanı"

- Split pane + broadcast input
- **Launcher / komut paleti** (Alt+M — 1Remote deseni; host + snippet + eylem araması)
- Grafiksel SSH tünel/port forwarding yöneticisi (L/R/D — MobaXterm deseni)
- Snippet kütüphanesi + çoklu sunucuda çalıştırma
- **Ücretsiz sync: GitHub Gist / WebDAV / dosya** (electerm deseni) — zero-knowledge şifreli
- RDP Yol B: FreeRDP runner fallback (NLA, çoklu ekran, HiDPI)
- Oturum geri yükleme (Workspace — Termius deseni)
- Gizlilik modu; portable mod; otomatik güncelleme
- Tema mağazası / terminal renk şemaları; dil sayısını artırma (Crowdin)

### v2 — "Platform &amp; ekosistem"

- **Sysadmin araç kutusu** (Muon mirası, modern UI ile): dev log görüntüleyici, disk analizörü, süreç/servis yöneticisi, ağ araçları
- Host metrik izleme + eşik alarmları (Termix deseni)
- **Bulut sağlayıcı envanteri:** AWS/Hetzner/DO API'den dinamik bağlantı listesi (Ghostly + RoyalJSON deseni)
- Parola yöneticisi entegrasyonları: KeePassXC, Bitwarden, 1Password (RustConn deseni)
- AI komut asistanı (electerm/Termius deseni — kendi API anahtarınla, gizlilik korumalı)
- Plugin sistemi + registry (Voltius deseni)
- Task/Pipeline otomasyonu (Oysape deseni); oturum kaydı; Serial/Mosh
- Opsiyonel self-hosted sync sunucusu + ekip vault'ları (ticarileşme yolu)

---

## 8. Teknik Riskler ve Azaltma Stratejileri

| # | Risk | Etki | Olasılık | Azaltma |
|---|---|---|---|---|
| 1 | **Electron'da RDP kalitesi** — native MSTSC (1Remote/mRemoteNG) kalitesine ulaşılamaması; NLA/CredSSP, HiDPI, çoklu ekran sorunları | Yüksek | Yüksek | İki aşamalı strateji: MVP'de ironrdp-wasm (electerm kanıtı, "yeterince iyi"); v1.x'te FreeRDP runner fallback (1Remote deseni). Beklentiyi "temel RDP her platformda" olarak yönetin; guacamole-lite (sunucu proxy) v2 self-hosted senaryosuna saklanabilir. |
| 2 | **node-pty / native modül derleme cehennemi** — Electron sürüm yükseltmelerinde ABI kırılmaları (node-pty, better-sqlite3, serialport) | Orta | Yüksek | `electron-rebuild` + prebuilt binary'ler; CI'da 3 platform matrisi; Electron sürümünü dondurup planlı yükseltme; Termix'in postinstall patch yaklaşımını inceleyin. |
| 3 | **Credential güvenliği** — hatalı kripto tasarımı (mRemoteNG CVE geçmişi) | Kritik | Orta | Kendi kripto şemanızı icat etmeyin: safeStorage + Argon2id + AES-256-GCM/XChaCha20 (Voltius şablonu); renderer'a düz metin credential göndermeme kuralı; erken güvenlik incelemesi/audit. |
| 4 | **Bellek/performans eleştirisi** — Tauri kampı kıyaslamaları (Voltius ~300 MB vs Termius ~500 MB anlatısı) | Orta | Yüksek | Oturum başına utility process + boşta oturumları uyutma; xterm.js WebGL; başlangıç hedefi belirleyin (ör. boşta &lt; 250 MB) ve pazarlamada şeffaf yayınlayın. |
| 5 | **Kapsam patlaması** — 8 protokol + izleme + sync'i aynı anda hedeflemek (Termix'in öğrenme eğrisi, RustConn'un bakım yükü) | Yüksek | Yüksek | Yol haritası disiplinine sadakat: MVP'de 4 protokol; her protokol için "gömülü + fallback" deseniyle bakım yükünü sınırlama. |
| 6 | **Tek geliştirici bus factor'ü** — Muon öldü, electerm riskli | Yüksek | Orta | Açık kaynak + erken topluluk (Voltius kanıtı); CONTRIBUTING + iyi doküman; Crowdin ile çeviri topluluğu erken katılım kanalı. |
| 7 | **GPL/AGPL bulaşması** — 1Remote, RustConn, Muon (GPL), Voltius (AGPL) kodlarından alıntı | Kritik | Düşük | Yalnızca MIT (electerm) ve Apache 2.0 (Termix) kaynaklardan kod incelemesi/alıntısı; GPL projelerden yalnızca fikir/UX deseni alın. Connexa lisansı: MIT veya Apache 2.0 önerilir. |
| 8 | **VNC köprüleme** — noVNC WebSocket bekler, ham VNC TCP'dir | Düşük | Kesin | Main process'te yerleşik websockify eşdeğeri TCP↔WS köprüsü (electerm/Termix'te çözülmüş desen). |
| 9 | **xterm.js dışı ekran protokolleri için canvas performansı** — RDP/VNC'de yüksek çözünürlükte FPS düşüşü | Orta | Orta | OffscreenCanvas + requestAnimationFrame disiplini; görüntü kalitesi/FPS ayarı kullanıcıya bırakılmalı; büyük ekranlarda kalite otomatik düşürme. |
| 10 | **Sync çakışmaları** — Gist/WebDAV senkronunda çakışan düzenlemeler | Düşük | Orta | Vault'a sürüm/vector clock alanı; son-yazan-kazanır + çakışma yedeği (Royal TS merge deseni v2'de). |

---

## 9. İş Modeli Dersleri

| Model | Örnek | Sonuç |
|---|---|---|
| Abonelik + sync paywall | Termius ($10–30/ay) | Kategori lideri ama en çok şikayet edilen konu; rakiplerin pazarlama malzemesi |
| Perpetual lisans | Royal TS (€49), MobaXterm ($69), WebSSH (lifetime) | "Abonelik yok" güçlü satış argümanı; sürdürülebilir gelir için majör sürüm ücretlendirmesi |
| Açık çekirdek + ücretli sync/team | Voltius (AGPL + Pro/Teams) | Viral büyüme + ticarileşme yolu — **Connexa için önerilen model** |
| Tamamen ücretsiz + bağış | electerm, Termix, mRemoteNG | Yüksek benimseme, gelir yok; sponsor bağımlılığı |
| Kapalı + sessiz freemium | SSH Deck, Ghostly | Görünmezlik — kaçınılması gereken yol |

**Connexa önerisi:** MIT/Apache açık kaynak çekirdek (tüm protokoller + yerel vault + Gist/WebDAV sync ücretsiz) → v2'de opsiyonel ücretli katman: barındırılan zero-knowledge sync, ekip vault'ları, SSO/denetim. Ücretsiz katmanda port forwarding gibi temel özellikleri kısıtlamayın (Xcasca tepki örneği); limit koyacaksanız WebSSH gibi tek ve basit bir eksen seçin.

---

## 10. Kaynaklar

| Kaynak | URL |
|---|---|
| Termix | https://github.com/Termix-SSH/Termix |
| 1Remote | https://github.com/1Remote/1Remote |
| Snowflake (Muon) | https://github.com/subhra74/snowflake · devam: https://github.com/devlinx9/muon-ssh |
| electerm | https://github.com/electerm/electerm |
| RustConn | https://github.com/totoshko88/RustConn |
| Voltius | https://github.com/VoltiusApp/voltius |
| SSH Deck | https://sshdeck.gscodes.dev/ |
| Xcasca (NetSarang) | https://www.xcasca.com/en |
| sshPilot | https://github.com/mfat/sshpilot |
| WebSSH | https://github.com/isontheline/pro.webssh.net |
| mRemoteNG | https://github.com/mRemoteNG/mRemoteNG |
| Termius | https://termius.com/ |
| Royal TS | https://www.royalapps.com/ts/win/features |
| MobaXterm | https://mobaxterm.mobatek.net/ |
| Ghostly Bridge | https://ghostlyinc.com/en-us/tools/ghostly-bridge/ · https://dev.to/ghostlyinc/why-i-built-ghostly-bridge-blazor-on-windows-servers-on-linux-without-the-pain-4pkj |
| Aifetel / Oysape | https://www.aifetel.cc/ · https://github.com/dongyg/oysape |

**Metodoloji notu:** Tüm kaynaklar 3 Temmuz 2026 tarihinde doğrudan ziyaret edilerek analiz edilmiştir. SSH Deck ve Xcasca'nın uygulama iç mimarisi (Electron/Tauri/native) hiçbir kamuya açık kaynakta doğrulanamamıştır (kapalı kaynak). Aifetel.cc SPA olduğundan içerik GitHub reposu ve geliştirici blog yazılarından tamamlanmıştır. Yıldız sayıları ve sürüm bilgileri rapor tarihindeki anlık değerlerdir.
