import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'
import type {
  Host,
  Identity,
  IdentityPublic,
  IdentitySaveRequest,
  Group,
  Snippet,
  Tunnel,
  AlarmConfig,
  VaultData
} from '../../shared/types'

/** Sync yapılandırması — vault dosyasında saklanır ama SYNC PAYLOAD'A DAHİL EDİLMEZ */
export interface SyncConfigStored {
  backend: 'none' | 'gist' | 'webdav'
  gistTokenEnc?: string
  gistId?: string
  webdavUrl?: string
  webdavUsername?: string
  webdavPasswordEnc?: string
}

/** Ekip vault yapılandırması — sadece bu makinede saklanır, paylaşılmaz */
export interface TeamVaultStored {
  id: string
  name: string
  backend: 'gist' | 'webdav'
  gistTokenEnc?: string
  gistId?: string
  webdavUrl?: string
  webdavUsername?: string
  webdavPasswordEnc?: string
}

/** Ekip vault içeriği — SIRSIZ paylaşılan paket (parolalar dahil edilmez) */
export interface PortableTeamVault {
  hosts: Host[]
  groups: Group[]
  snippets: Snippet[]
  identities: Array<{
    id: string
    name: string
    username: string
    authType: Identity['authType']
    privateKeyPath?: string
    secretRef?: Identity['secretRef']
  }>
}

interface VaultFile {
  version: 1
  hosts: Host[]
  identities: Identity[]
  groups: Group[]
  snippets: Snippet[]
  tunnels: Tunnel[]
  sync?: SyncConfigStored
  alarm?: AlarmConfig
  ai?: AiConfigStored
  teamVaults?: TeamVaultStored[]
}

const DEFAULT_ALARM: AlarmConfig = {
  enabled: false,
  cpuPercent: 90,
  memPercent: 90,
  diskPercent: 90,
  notifyType: 'ntfy',
  notifyTarget: ''
}

interface AiConfigStored {
  model: string
  apiKeyEnc?: string
}

const DEFAULT_AI_MODEL = 'claude-opus-4-8'

/** Taşınabilir kimlik (sırlar düz metin) — sync payload'ında kullanılır */
export interface PortableIdentity {
  id: string
  name: string
  username: string
  authType: Identity['authType']
  privateKeyPath?: string
  password?: string
  passphrase?: string
}

/** Sync payload'ı — makineye bağlı olmayan, düz metin sırlı tam vault kopyası */
export interface PortableVault {
  hosts: Host[]
  groups: Group[]
  snippets: Snippet[]
  tunnels: Tunnel[]
  identities: PortableIdentity[]
}

/**
 * Yerel-öncelikli vault deposu.
 * MVP: JSON dosyası; sırlar (parola/passphrase) OS keychain destekli
 * Electron safeStorage ile şifrelenir, dosyaya yalnızca şifreli hali yazılır.
 * Sırlar renderer'a hiçbir zaman düz metin gönderilmez (rapor §6.4).
 */
export class VaultStore {
  private data: VaultFile
  private readonly filePath: string

  constructor() {
    this.filePath = join(app.getPath('userData'), 'vault.json')
    this.data = this.load()
  }

  private load(): VaultFile {
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Partial<VaultFile>
        // Eski vault dosyalarıyla ileri uyumluluk: eksik koleksiyonları doldur
        return {
          version: 1,
          hosts: parsed.hosts ?? [],
          identities: parsed.identities ?? [],
          groups: parsed.groups ?? [],
          snippets: parsed.snippets ?? [],
          tunnels: parsed.tunnels ?? [],
          sync: parsed.sync,
          alarm: parsed.alarm,
          ai: parsed.ai,
          teamVaults: parsed.teamVaults ?? []
        }
      } catch {
        // Bozuk dosya: üzerine yazmadan önce yedeğini bırak
        writeFileSync(this.filePath + '.corrupt', readFileSync(this.filePath))
      }
    }
    return { version: 1, hosts: [], identities: [], groups: [], snippets: [], tunnels: [] }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  private encrypt(plain: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS keychain encryption is not available')
    }
    return safeStorage.encryptString(plain).toString('base64')
  }

  private decrypt(enc: string): string {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  }

  private toPublic(identity: Identity): IdentityPublic {
    return {
      id: identity.id,
      name: identity.name,
      username: identity.username,
      authType: identity.authType,
      privateKeyPath: identity.privateKeyPath,
      hasPassword: Boolean(identity.passwordEnc),
      hasPassphrase: Boolean(identity.passphraseEnc),
      secretRef: identity.secretRef,
      teamVaultId: identity.teamVaultId
    }
  }

  getPublicData(): VaultData {
    return {
      hosts: this.data.hosts,
      identities: this.data.identities.map((i) => this.toPublic(i)),
      groups: this.data.groups,
      snippets: this.data.snippets,
      tunnels: this.data.tunnels
    }
  }

  getHost(id: string): Host | undefined {
    return this.data.hosts.find((h) => h.id === id)
  }

  saveHost(host: Host): Host {
    if (!host.id) host.id = randomUUID()
    const idx = this.data.hosts.findIndex((h) => h.id === host.id)
    if (idx >= 0) this.data.hosts[idx] = host
    else this.data.hosts.push(host)
    this.persist()
    return host
  }

  deleteHost(id: string): void {
    this.data.hosts = this.data.hosts.filter((h) => h.id !== id)
    this.persist()
  }

  saveIdentity(req: IdentitySaveRequest): IdentityPublic {
    const existing = req.id ? this.data.identities.find((i) => i.id === req.id) : undefined
    // secretRef: null → temizle, undefined → koru, nesne → ayarla
    const secretRef =
      req.secretRef === null ? undefined : (req.secretRef ?? existing?.secretRef)
    const identity: Identity = {
      id: existing?.id ?? randomUUID(),
      name: req.name,
      username: req.username,
      authType: req.authType,
      privateKeyPath: req.privateKeyPath,
      // Yeni sır verildiyse şifrele; verilmediyse mevcut şifreli değeri koru
      passwordEnc: req.password ? this.encrypt(req.password) : existing?.passwordEnc,
      passphraseEnc: req.passphrase ? this.encrypt(req.passphrase) : existing?.passphraseEnc,
      secretRef
    }
    const idx = this.data.identities.findIndex((i) => i.id === identity.id)
    if (idx >= 0) this.data.identities[idx] = identity
    else this.data.identities.push(identity)
    this.persist()
    return this.toPublic(identity)
  }

  deleteIdentity(id: string): void {
    this.data.identities = this.data.identities.filter((i) => i.id !== id)
    this.persist()
  }

  saveGroup(group: Group): Group {
    if (!group.id) group.id = randomUUID()
    const idx = this.data.groups.findIndex((g) => g.id === group.id)
    if (idx >= 0) this.data.groups[idx] = group
    else this.data.groups.push(group)
    this.persist()
    return group
  }

  deleteGroup(id: string): void {
    this.data.groups = this.data.groups.filter((g) => g.id !== id)
    // Gruptaki hostları köke taşı
    for (const host of this.data.hosts) {
      if (host.groupId === id) host.groupId = undefined
    }
    this.persist()
  }

  saveSnippet(snippet: Snippet): Snippet {
    if (!snippet.id) snippet.id = randomUUID()
    const idx = this.data.snippets.findIndex((s) => s.id === snippet.id)
    if (idx >= 0) this.data.snippets[idx] = snippet
    else this.data.snippets.push(snippet)
    this.persist()
    return snippet
  }

  deleteSnippet(id: string): void {
    this.data.snippets = this.data.snippets.filter((s) => s.id !== id)
    this.persist()
  }

  saveTunnel(tunnel: Tunnel): Tunnel {
    if (!tunnel.id) tunnel.id = randomUUID()
    const idx = this.data.tunnels.findIndex((tt) => tt.id === tunnel.id)
    if (idx >= 0) this.data.tunnels[idx] = tunnel
    else this.data.tunnels.push(tunnel)
    this.persist()
    return tunnel
  }

  deleteTunnel(id: string): void {
    this.data.tunnels = this.data.tunnels.filter((tt) => tt.id !== id)
    this.persist()
  }

  getTunnel(id: string): Tunnel | undefined {
    return this.data.tunnels.find((tt) => tt.id === id)
  }

  /**
   * Ayar kalıtımı: host kimliği yoksa grup zincirinde yukarı yürüyerek
   * ilk tanımlı varsayılan kimliği bulur (rapor §6.1 — mRemoteNG deseni).
   */
  resolveIdentityId(host: Host): string | undefined {
    if (host.identityId) return host.identityId
    const seen = new Set<string>()
    let groupId = host.groupId
    while (groupId && !seen.has(groupId)) {
      seen.add(groupId)
      const group = this.data.groups.find((g) => g.id === groupId)
      if (!group) break
      if (group.identityId) return group.identityId
      groupId = group.parentId
    }
    return undefined
  }

  /**
   * Yalnızca main süreç içinden çağrılır (SessionManager) —
   * IPC üzerinden asla dışarı açılmaz.
   */
  resolveSecrets(identityId: string): {
    identity: Identity
    password?: string
    passphrase?: string
  } | null {
    const identity = this.data.identities.find((i) => i.id === identityId)
    if (!identity) return null
    return {
      identity,
      password: identity.passwordEnc ? this.decrypt(identity.passwordEnc) : undefined,
      passphrase: identity.passphraseEnc ? this.decrypt(identity.passphraseEnc) : undefined
    }
  }

  // ---- Taşınabilir dışa/içe aktarma (sync için) ----

  /**
   * Tüm vault'u makineye bağlı olmayan biçimde dışa aktarır: sırlar
   * safeStorage'dan çözülüp düz metin olarak konur (sonra sync parolasıyla
   * şifrelenmek üzere). Sync yapılandırması DAHİL EDİLMEZ.
   */
  exportPortable(): PortableVault {
    return {
      hosts: this.data.hosts,
      groups: this.data.groups,
      snippets: this.data.snippets,
      tunnels: this.data.tunnels,
      identities: this.data.identities.map((i) => ({
        id: i.id,
        name: i.name,
        username: i.username,
        authType: i.authType,
        privateKeyPath: i.privateKeyPath,
        password: i.passwordEnc ? this.decrypt(i.passwordEnc) : undefined,
        passphrase: i.passphraseEnc ? this.decrypt(i.passphraseEnc) : undefined
      }))
    }
  }

  /**
   * Taşınabilir vault'u içe alır (sync pull). Mevcut koleksiyonların yerine
   * geçer; düz metin sırlar bu makinenin safeStorage'ı ile yeniden şifrelenir.
   * Kimlik ID'leri korunur (host referansları geçerli kalsın).
   */
  replacePortable(data: PortableVault): void {
    this.data.hosts = data.hosts
    this.data.groups = data.groups
    this.data.snippets = data.snippets
    this.data.tunnels = data.tunnels
    this.data.identities = data.identities.map((p) => ({
      id: p.id,
      name: p.name,
      username: p.username,
      authType: p.authType,
      privateKeyPath: p.privateKeyPath,
      passwordEnc: p.password ? this.encrypt(p.password) : undefined,
      passphraseEnc: p.passphrase ? this.encrypt(p.passphrase) : undefined
    }))
    this.persist()
  }

  // ---- Sync yapılandırması ----

  getSyncConfig(): SyncConfigStored {
    return this.data.sync ?? { backend: 'none' }
  }

  getSyncPublic(): {
    backend: 'none' | 'gist' | 'webdav'
    gistId?: string
    webdavUrl?: string
    webdavUsername?: string
    hasGistToken: boolean
    hasWebdavPassword: boolean
  } {
    const s = this.getSyncConfig()
    return {
      backend: s.backend,
      gistId: s.gistId,
      webdavUrl: s.webdavUrl,
      webdavUsername: s.webdavUsername,
      hasGistToken: Boolean(s.gistTokenEnc),
      hasWebdavPassword: Boolean(s.webdavPasswordEnc)
    }
  }

  saveSyncConfig(input: {
    backend: 'none' | 'gist' | 'webdav'
    gistToken?: string
    gistId?: string
    webdavUrl?: string
    webdavUsername?: string
    webdavPassword?: string
  }): void {
    const existing = this.getSyncConfig()
    this.data.sync = {
      backend: input.backend,
      gistId: input.gistId ?? existing.gistId,
      gistTokenEnc: input.gistToken ? this.encrypt(input.gistToken) : existing.gistTokenEnc,
      webdavUrl: input.webdavUrl ?? existing.webdavUrl,
      webdavUsername: input.webdavUsername ?? existing.webdavUsername,
      webdavPasswordEnc: input.webdavPassword
        ? this.encrypt(input.webdavPassword)
        : existing.webdavPasswordEnc
    }
    this.persist()
  }

  /** Sync backend sırlarını çözer (yalnızca main süreçte kullanılır) */
  resolveSyncSecrets(): { gistToken?: string; webdavPassword?: string } {
    const s = this.getSyncConfig()
    return {
      gistToken: s.gistTokenEnc ? this.decrypt(s.gistTokenEnc) : undefined,
      webdavPassword: s.webdavPasswordEnc ? this.decrypt(s.webdavPasswordEnc) : undefined
    }
  }

  setGistId(gistId: string): void {
    const s = this.getSyncConfig()
    this.data.sync = { ...s, gistId }
    this.persist()
  }

  // ---- Alarm yapılandırması ----

  getAlarmConfig(): AlarmConfig {
    return this.data.alarm ?? DEFAULT_ALARM
  }

  saveAlarmConfig(config: AlarmConfig): void {
    this.data.alarm = config
    this.persist()
  }

  // ---- AI yapılandırması ----

  getAiPublic(): { model: string; hasApiKey: boolean } {
    const ai = this.data.ai
    return {
      model: ai?.model ?? DEFAULT_AI_MODEL,
      hasApiKey: Boolean(ai?.apiKeyEnc)
    }
  }

  saveAiConfig(input: { model?: string; apiKey?: string }): void {
    const existing = this.data.ai
    this.data.ai = {
      model: input.model ?? existing?.model ?? DEFAULT_AI_MODEL,
      apiKeyEnc: input.apiKey ? this.encrypt(input.apiKey) : existing?.apiKeyEnc
    }
    this.persist()
  }

  /** AI çağrısı için model + API anahtarı (yalnızca main süreçte) */
  resolveAi(): { model: string; apiKey?: string } {
    const ai = this.data.ai
    return {
      model: ai?.model ?? DEFAULT_AI_MODEL,
      apiKey: ai?.apiKeyEnc ? this.decrypt(ai.apiKeyEnc) : undefined
    }
  }

  // ---- Ekip vault'ları ----

  private teamVaults(): TeamVaultStored[] {
    if (!this.data.teamVaults) this.data.teamVaults = []
    return this.data.teamVaults
  }

  getTeamVaultsPublic(): Array<{
    id: string
    name: string
    backend: 'gist' | 'webdav'
    gistId?: string
    webdavUrl?: string
    webdavUsername?: string
    hasGistToken: boolean
    hasWebdavPassword: boolean
  }> {
    return this.teamVaults().map((tv) => ({
      id: tv.id,
      name: tv.name,
      backend: tv.backend,
      gistId: tv.gistId,
      webdavUrl: tv.webdavUrl,
      webdavUsername: tv.webdavUsername,
      hasGistToken: Boolean(tv.gistTokenEnc),
      hasWebdavPassword: Boolean(tv.webdavPasswordEnc)
    }))
  }

  getTeamVault(id: string): TeamVaultStored | undefined {
    return this.teamVaults().find((tv) => tv.id === id)
  }

  saveTeamVault(input: {
    id?: string
    name: string
    backend: 'gist' | 'webdav'
    gistToken?: string
    gistId?: string
    webdavUrl?: string
    webdavUsername?: string
    webdavPassword?: string
  }): TeamVaultStored {
    const list = this.teamVaults()
    const existing = input.id ? list.find((tv) => tv.id === input.id) : undefined
    const tv: TeamVaultStored = {
      id: existing?.id ?? randomUUID(),
      name: input.name,
      backend: input.backend,
      gistId: input.gistId ?? existing?.gistId,
      gistTokenEnc: input.gistToken ? this.encrypt(input.gistToken) : existing?.gistTokenEnc,
      webdavUrl: input.webdavUrl ?? existing?.webdavUrl,
      webdavUsername: input.webdavUsername ?? existing?.webdavUsername,
      webdavPasswordEnc: input.webdavPassword
        ? this.encrypt(input.webdavPassword)
        : existing?.webdavPasswordEnc
    }
    const idx = list.findIndex((t) => t.id === tv.id)
    if (idx >= 0) list[idx] = tv
    else list.push(tv)
    this.persist()
    return tv
  }

  deleteTeamVault(id: string): void {
    this.data.teamVaults = this.teamVaults().filter((tv) => tv.id !== id)
    // Bu ekibe ait öğelerin etiketini temizle (yerelde kişisel kalırlar)
    for (const h of this.data.hosts) if (h.teamVaultId === id) h.teamVaultId = undefined
    for (const g of this.data.groups) if (g.teamVaultId === id) g.teamVaultId = undefined
    for (const s of this.data.snippets) if (s.teamVaultId === id) s.teamVaultId = undefined
    for (const i of this.data.identities) if (i.teamVaultId === id) i.teamVaultId = undefined
    this.persist()
  }

  resolveTeamSecrets(id: string): { gistToken?: string; webdavPassword?: string } {
    const tv = this.getTeamVault(id)
    if (!tv) return {}
    return {
      gistToken: tv.gistTokenEnc ? this.decrypt(tv.gistTokenEnc) : undefined,
      webdavPassword: tv.webdavPasswordEnc ? this.decrypt(tv.webdavPasswordEnc) : undefined
    }
  }

  setTeamGistId(id: string, gistId: string): void {
    const tv = this.getTeamVault(id)
    if (tv) {
      tv.gistId = gistId
      this.persist()
    }
  }

  /** Bir öğeyi ekip vault'una ata (ya da null ile çıkar) */
  assignToTeam(kind: 'host' | 'group' | 'snippet' | 'identity', itemId: string, teamId: string | null): void {
    const target =
      kind === 'host'
        ? this.data.hosts.find((h) => h.id === itemId)
        : kind === 'group'
          ? this.data.groups.find((g) => g.id === itemId)
          : kind === 'snippet'
            ? this.data.snippets.find((s) => s.id === itemId)
            : this.data.identities.find((i) => i.id === itemId)
    if (target) {
      target.teamVaultId = teamId ?? undefined
      this.persist()
    }
  }

  /**
   * Ekip vault'unun paylaşılabilir içeriğini üretir: yalnızca o ekibe etiketli
   * host/grup/snippet/kimlik. Kimlik SIRLARI (parola/passphrase) DAHİL EDİLMEZ —
   * her üye kendi sırlarını yerelde girer veya parola yöneticisi referansı kullanır.
   */
  exportTeam(teamId: string): PortableTeamVault {
    return {
      hosts: this.data.hosts.filter((h) => h.teamVaultId === teamId),
      groups: this.data.groups.filter((g) => g.teamVaultId === teamId),
      snippets: this.data.snippets.filter((s) => s.teamVaultId === teamId),
      identities: this.data.identities
        .filter((i) => i.teamVaultId === teamId)
        .map((i) => ({
          id: i.id,
          name: i.name,
          username: i.username,
          authType: i.authType,
          privateKeyPath: i.privateKeyPath,
          secretRef: i.secretRef
        }))
    }
  }

  /**
   * Ekip vault'unu içe alır: o ekibe ait mevcut yerel öğeler kaldırılır ve
   * gelenlerle değiştirilir (id korunur). Kimlik sırları korunur (yeni gelenlerde
   * sır yoktur; mevcut yerel sır varsa üzerine yazılmaz).
   */
  replaceTeam(teamId: string, data: PortableTeamVault): void {
    // Mevcut yerel kimlik sırlarını id bazında koru (yeniden girmeye gerek kalmasın)
    const localSecrets = new Map<string, { passwordEnc?: string; passphraseEnc?: string }>()
    for (const i of this.data.identities) {
      if (i.teamVaultId === teamId) {
        localSecrets.set(i.id, { passwordEnc: i.passwordEnc, passphraseEnc: i.passphraseEnc })
      }
    }

    // Eski ekip öğelerini kaldır
    this.data.hosts = this.data.hosts.filter((h) => h.teamVaultId !== teamId)
    this.data.groups = this.data.groups.filter((g) => g.teamVaultId !== teamId)
    this.data.snippets = this.data.snippets.filter((s) => s.teamVaultId !== teamId)
    this.data.identities = this.data.identities.filter((i) => i.teamVaultId !== teamId)

    // Gelenleri ekle (etiketi zorla)
    for (const h of data.hosts) this.data.hosts.push({ ...h, teamVaultId: teamId })
    for (const g of data.groups) this.data.groups.push({ ...g, teamVaultId: teamId })
    for (const s of data.snippets) this.data.snippets.push({ ...s, teamVaultId: teamId })
    for (const i of data.identities) {
      const prior = localSecrets.get(i.id)
      this.data.identities.push({
        id: i.id,
        name: i.name,
        username: i.username,
        authType: i.authType,
        privateKeyPath: i.privateKeyPath,
        secretRef: i.secretRef,
        teamVaultId: teamId,
        passwordEnc: prior?.passwordEnc,
        passphraseEnc: prior?.passphraseEnc
      })
    }
    this.persist()
  }
}
