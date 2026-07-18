/**
 * Connexa ortak tip tanımları — arayüz (WebView) ve Rust arka uç tarafından paylaşılır.
 * Veri modeli: Termius taksonomisi (Host/Group/Identity ayrımı) + mRemoteNG ayar kalıtımı.
 * Bkz. docs/CONNEXA_RAKIP_ANALIZ_RAPORU.md §6.1
 */

export type Protocol = 'ssh' | 'telnet' | 'local' | 'rdp' | 'vnc' | 'serial'

export type AuthType = 'password' | 'key' | 'agent'

export type SecretManager = 'bitwarden' | 'onepassword' | 'command'

/**
 * Parolayı vault yerine harici bir parola yöneticisinden çeken referans
 * (RustConn deseni). Bağlantı anında çözülür; sır vault'ta saklanmaz.
 *  - bitwarden: ref = öğe adı/id → `bw get password <ref>`
 *  - onepassword: ref = `op://vault/item/field` → `op read <ref>`
 *  - command: ref = stdout'a sırrı basan tam kabuk komutu (KeePassXC vb.)
 */
export interface SecretRef {
  manager: SecretManager
  ref: string
}

export interface Identity {
  id: string
  name: string
  username: string
  authType: AuthType
  /** OS anahtarlığı ile şifrelenmiş parola (base64) — arayüze asla düz metin gitmez */
  passwordEnc?: string
  privateKeyPath?: string
  /** OS anahtarlığı ile şifrelenmiş passphrase (base64) */
  passphraseEnc?: string
  /** Ayarlıysa parola bu yöneticiden çözülür (passwordEnc yerine) */
  secretRef?: SecretRef
  /** Ayarlıysa bu kimlik bir ekip vault'una aittir (sırlar paylaşılmaz) */
  teamVaultId?: string
}

/** Arayüze gönderilen, sır içermeyen Identity görünümü */
export interface IdentityPublic {
  id: string
  name: string
  username: string
  authType: AuthType
  privateKeyPath?: string
  hasPassword: boolean
  hasPassphrase: boolean
  secretRef?: SecretRef
  teamVaultId?: string
}

export interface Group {
  id: string
  name: string
  parentId?: string
  /**
   * Grubun varsayılan kimliği — kimliği olmayan hostlar grup zincirinde
   * yukarı doğru ilk tanımlı kimliği devralır (mRemoteNG kalıtım deseni).
   */
  identityId?: string
  /** Ayarlıysa bu grup bir ekip vault'una aittir ve ekiple paylaşılır */
  teamVaultId?: string
}

export interface Host {
  id: string
  name: string
  protocol: Protocol
  hostname: string
  port: number
  identityId?: string
  groupId?: string
  tags: string[]
  color?: string
  /** Bağlantı sonrası çalıştırılacak komut (SSH) */
  startupCommand?: string
  /** Ayarlıysa bu host bir ekip vault'una aittir ve ekiple paylaşılır */
  teamVaultId?: string
}

export interface Snippet {
  id: string
  name: string
  /** Terminale yazılacak komut; sonuna \n eklenerek çalıştırılır */
  command: string
  tags: string[]
  /** Ayarlıysa bu snippet bir ekip vault'una aittir ve ekiple paylaşılır */
  teamVaultId?: string
}

/** local = -L, remote = -R, dynamic = -D (SOCKS5) */
export type TunnelType = 'local' | 'remote' | 'dynamic'

export interface Tunnel {
  id: string
  name: string
  /** Tünelin kurulacağı SSH hostu */
  hostId: string
  type: TunnelType
  listenHost: string
  listenPort: number
  /** local/remote için hedef; dynamic'te kullanılmaz */
  destHost?: string
  destPort?: number
}

export interface TunnelState {
  tunnelId: string
  running: boolean
  error?: string
}

export interface VaultData {
  hosts: Host[]
  identities: IdentityPublic[]
  groups: Group[]
  snippets: Snippet[]
  tunnels: Tunnel[]
}

export interface SessionDescriptor {
  id: string
  title: string
  protocol: Protocol
  hostId?: string
  /**
   * VNC/RDP kimlik doğrulaması istemci tarafında (noVNC / ironrdp-wasm)
   * gerçekleştiğinden bu alanlardaki parolalar arayüze geçici olarak
   * gönderilir; vault'ta her zaman şifreli dururlar ve kalıcılaştırılmazlar.
   */
  vnc?: {
    wsUrl: string
    password?: string
  }
  rdp?: {
    proxyUrl: string
    /** "host:port" */
    destination: string
    username: string
    password: string
  }
}

export interface CreateSessionRequest {
  hostId?: string
  local?: boolean
  cols: number
  rows: number
}

export interface CreateSessionResult {
  ok: boolean
  session?: SessionDescriptor
  error?: string
}

export type SftpEntryType = 'file' | 'dir' | 'link'

export interface SftpEntry {
  name: string
  path: string
  type: SftpEntryType
  size: number
  /** Unix epoch (ms) */
  mtime: number
}

export interface SftpResult<T = undefined> {
  ok: boolean
  error?: string
  data?: T
}

export interface ImportSummary {
  ok: boolean
  error?: string
  /** Kullanıcı diyaloğu iptal etti */
  canceled?: boolean
  hosts: number
  identities: number
  groups: number
  /** Zaten var olduğu için atlananlar */
  skipped: number
}

export interface DiskUsage {
  mount: string
  sizeBytes: number
  usedBytes: number
  usePercent: number
}

export interface ProcessInfo {
  pid: number
  cpu: number
  mem: number
  command: string
}

export type AlarmNotifyType = 'ntfy' | 'webhook'

export interface AlarmConfig {
  enabled: boolean
  cpuPercent: number
  memPercent: number
  diskPercent: number
  notifyType: AlarmNotifyType
  /** ntfy: konu URL'i (https://ntfy.sh/konu) · webhook: POST URL'i */
  notifyTarget: string
}

export interface HostMetrics {
  ok: boolean
  error?: string
  uptime?: string
  loadAvg?: [number, number, number]
  cpuCount?: number
  memTotalBytes?: number
  memUsedBytes?: number
  disks?: DiskUsage[]
  processes?: ProcessInfo[]
}

export interface PluginInfo {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  snippetCount: number
}

export interface PluginResult {
  ok: boolean
  error?: string
  plugins: PluginInfo[]
  /** Tüm etkin pluginlerin kattığı snippet'ler (salt okunur) */
  snippets: Snippet[]
}

export interface AiConfigPublic {
  model: string
  hasApiKey: boolean
}

export interface AiConfigInput {
  model?: string
  apiKey?: string
}

/** Ekip vault'u — host/grup/snippet/kimlik(sırsız) paylaşan şifreli paket */
export interface TeamVaultPublic {
  id: string
  name: string
  backend: 'gist' | 'webdav'
  gistId?: string
  webdavUrl?: string
  webdavUsername?: string
  hasGistToken: boolean
  hasWebdavPassword: boolean
}

export interface TeamVaultInput {
  id?: string
  name: string
  backend: 'gist' | 'webdav'
  gistToken?: string
  gistId?: string
  webdavUrl?: string
  webdavUsername?: string
  webdavPassword?: string
}

export interface TeamVaultResult {
  ok: boolean
  error?: string
  gistId?: string
  /** pull sonrası içe aktarma özeti */
  summary?: ImportSummary
}

export type SyncBackend = 'none' | 'gist' | 'webdav'

/** Arayüze gösterilen sync yapılandırması — sır içermez */
export interface SyncConfigPublic {
  backend: SyncBackend
  gistId?: string
  webdavUrl?: string
  webdavUsername?: string
  hasGistToken: boolean
  hasWebdavPassword: boolean
}

/** Sync ayarı kaydetme isteği — sırlar düz metin gelir, main'de şifrelenir */
export interface SyncConfigInput {
  backend: SyncBackend
  gistToken?: string
  gistId?: string
  webdavUrl?: string
  webdavUsername?: string
  webdavPassword?: string
}

export interface SyncResult {
  ok: boolean
  error?: string
  /** push sonrası oluşturulan/kullanılan Gist kimliği */
  gistId?: string
  /** pull sonrası içe aktarma özeti */
  summary?: ImportSummary
}

/** Identity kaydetme isteği — sırlar düz metin gelir, main süreçte şifrelenir */
export interface IdentitySaveRequest {
  id?: string
  name: string
  username: string
  authType: AuthType
  password?: string
  privateKeyPath?: string
  passphrase?: string
  secretRef?: SecretRef | null
}
