import { dialog, BrowserWindow } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join, basename } from 'path'
import { XMLParser } from 'fast-xml-parser'
import type { VaultStore } from '../vault/VaultStore'
import type { Host, Protocol, ImportSummary } from '../../shared/types'

/**
 * Rakip araçlardan içe aktarma — benimseme hızlandırıcı (rapor §7 MVP).
 * - ~/.ssh/config: alias, HostName, User, Port, IdentityFile
 * - mRemoteNG confCons.xml: Container → grup, Connection → host
 *   (mRemoteNG parolaları master-password ile şifrelidir; parolalar aktarılmaz)
 */
export class ImportService {
  constructor(private vault: VaultStore) {}

  private emptySummary(): ImportSummary {
    return { ok: true, hosts: 0, identities: 0, groups: 0, skipped: 0 }
  }

  private hostExists(hostname: string, port: number, protocol: Protocol): boolean {
    return this.vault
      .getPublicData()
      .hosts.some((h) => h.hostname === hostname && h.port === port && h.protocol === protocol)
  }

  /**
   * Aynı kullanıcı+anahtar kombinasyonu için tek kimlik oluşturur/yeniden kullanır.
   */
  private ensureIdentity(
    username: string,
    keyPath: string | undefined,
    summary: ImportSummary
  ): string {
    const name = keyPath ? `${username} (${basename(keyPath)})` : `${username} (agent)`
    const existing = this.vault.getPublicData().identities.find((i) => i.name === name)
    if (existing) return existing.id
    const created = this.vault.saveIdentity({
      name,
      username,
      authType: keyPath ? 'key' : 'agent',
      privateKeyPath: keyPath
    })
    summary.identities++
    return created.id
  }

  async importSshConfig(): Promise<ImportSummary> {
    const win = BrowserWindow.getFocusedWindow()
    const defaultPath = join(homedir(), '.ssh', 'config')
    const picked = await dialog.showOpenDialog(win!, {
      title: 'ssh_config',
      defaultPath: existsSync(defaultPath) ? defaultPath : homedir(),
      properties: ['openFile', 'showHiddenFiles']
    })
    if (picked.canceled || picked.filePaths.length === 0) {
      return { ...this.emptySummary(), canceled: true }
    }

    try {
      const content = readFileSync(picked.filePaths[0], 'utf-8')
      return this.parseSshConfig(content)
    } catch (err) {
      return {
        ...this.emptySummary(),
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  /** Test edilebilirlik için ayrık: içerik → import */
  parseSshConfig(content: string): ImportSummary {
    const summary = this.emptySummary()

    interface Block {
      alias: string
      hostname?: string
      user?: string
      port?: number
      identityFile?: string
    }

    const blocks: Block[] = []
    let current: Block | null = null

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const match = line.match(/^(\S+)\s+(.*)$/)
      if (!match) continue
      const keyword = match[1].toLowerCase()
      const value = match[2].trim()

      if (keyword === 'host') {
        // Çoklu pattern olabilir; wildcard içermeyen ilkini al
        const alias = value.split(/\s+/).find((p) => !p.includes('*') && !p.includes('?'))
        current = alias ? { alias } : null
        if (current) blocks.push(current)
        continue
      }
      if (!current) continue
      switch (keyword) {
        case 'hostname':
          current.hostname = value
          break
        case 'user':
          current.user = value
          break
        case 'port':
          current.port = parseInt(value, 10) || 22
          break
        case 'identityfile':
          current.identityFile = value.replace(/^~(?=\/)/, homedir())
          break
      }
    }

    for (const block of blocks) {
      const hostname = block.hostname ?? block.alias
      const port = block.port ?? 22
      if (this.hostExists(hostname, port, 'ssh')) {
        summary.skipped++
        continue
      }
      const identityId = block.user
        ? this.ensureIdentity(block.user, block.identityFile, summary)
        : undefined
      const host: Host = {
        id: '',
        name: block.alias,
        protocol: 'ssh',
        hostname,
        port,
        identityId,
        tags: ['ssh-config']
      }
      this.vault.saveHost(host)
      summary.hosts++
    }

    return summary
  }

  async importMRemoteNG(): Promise<ImportSummary> {
    const win = BrowserWindow.getFocusedWindow()
    const picked = await dialog.showOpenDialog(win!, {
      title: 'mRemoteNG confCons.xml',
      filters: [{ name: 'XML', extensions: ['xml'] }],
      properties: ['openFile']
    })
    if (picked.canceled || picked.filePaths.length === 0) {
      return { ...this.emptySummary(), canceled: true }
    }

    try {
      const content = readFileSync(picked.filePaths[0], 'utf-8')
      return this.parseMRemoteNG(content)
    } catch (err) {
      return {
        ...this.emptySummary(),
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  /** Test edilebilirlik için ayrık: içerik → import */
  parseMRemoteNG(content: string): ImportSummary {
    const summary = this.emptySummary()

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      isArray: (name) => name === 'Node'
    })
    const doc = parser.parse(content)
    const root = doc?.mrng?.Connections ?? doc?.Connections
    if (!root) {
      return { ...this.emptySummary(), ok: false, error: 'Unrecognized mRemoteNG XML format' }
    }

    const protocolMap: Record<string, Protocol | undefined> = {
      SSH1: 'ssh',
      SSH2: 'ssh',
      RDP: 'rdp',
      VNC: 'vnc',
      Telnet: 'telnet',
      telnet: 'telnet'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = (nodes: any[], parentGroupId?: string): void => {
      for (const node of nodes ?? []) {
        const type = node.Type ?? (node.Node ? 'Container' : 'Connection')
        if (type === 'Container') {
          const group = this.vault.saveGroup({
            id: '',
            name: node.Name ?? 'Imported',
            parentId: parentGroupId
          })
          summary.groups++
          walk(node.Node ?? [], group.id)
          continue
        }

        const protocol = protocolMap[node.Protocol as string]
        if (!protocol || !node.Hostname) {
          summary.skipped++
          continue
        }
        const port =
          parseInt(node.Port, 10) ||
          { ssh: 22, telnet: 23, rdp: 3389, vnc: 5900, local: 0, serial: 9600 }[protocol]
        if (this.hostExists(node.Hostname, port, protocol)) {
          summary.skipped++
          continue
        }
        const identityId =
          protocol === 'ssh' && node.Username
            ? this.ensureIdentity(node.Username, undefined, summary)
            : undefined
        this.vault.saveHost({
          id: '',
          name: node.Name ?? node.Hostname,
          protocol,
          hostname: node.Hostname,
          port,
          identityId,
          groupId: parentGroupId,
          tags: ['mremoteng']
        })
        summary.hosts++
      }
    }

    walk(root.Node ?? [])
    return summary
  }

  async importTermius(): Promise<ImportSummary> {
    const win = BrowserWindow.getFocusedWindow()
    const picked = await dialog.showOpenDialog(win!, {
      title: 'Termius export (JSON)',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (picked.canceled || picked.filePaths.length === 0) {
      return { ...this.emptySummary(), canceled: true }
    }

    try {
      const content = readFileSync(picked.filePaths[0], 'utf-8')
      return this.parseTermius(content)
    } catch (err) {
      return {
        ...this.emptySummary(),
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  /**
   * Termius JSON dışa aktarımını içe alır. Termius'un dışa aktarım biçimi
   * sürümlere göre değişir; bu ayrıştırıcı yaygın şekilleri tolere eder:
   * dizi | {hosts:[...]} | {Hosts:[...]}. Parolalar Termius tarafından dışa
   * aktarılmaz; yalnızca kullanıcı adından kimlik üretilir.
   * Test edilebilirlik için ayrık: içerik → import
   */
  parseTermius(content: string): ImportSummary {
    const summary = this.emptySummary()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let doc: any
    try {
      doc = JSON.parse(content)
    } catch {
      return { ...this.emptySummary(), ok: false, error: 'Invalid JSON' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawHosts: any[] = Array.isArray(doc)
      ? doc
      : (doc.hosts ?? doc.Hosts ?? doc.sshConnections ?? [])
    if (!Array.isArray(rawHosts) || rawHosts.length === 0) {
      return { ...this.emptySummary(), ok: false, error: 'Unrecognized Termius export format' }
    }

    // Opsiyonel grup tanımları (id → Connexa group id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawGroups: any[] = doc.groups ?? doc.Groups ?? []
    const groupIdMap = new Map<string, string>()
    for (const g of rawGroups) {
      const label = g.label ?? g.name ?? g.title
      if (!label) continue
      const created = this.vault.saveGroup({ id: '', name: String(label) })
      summary.groups++
      const key = String(g.id ?? g.uid ?? label)
      groupIdMap.set(key, created.id)
    }

    const protocolMap: Record<string, Protocol> = {
      ssh: 'ssh',
      telnet: 'telnet',
      mosh: 'ssh'
    }
    const defaultPort: Record<Protocol, number> = {
      ssh: 22,
      telnet: 23,
      rdp: 3389,
      vnc: 5900,
      local: 0,
      serial: 9600
    }

    for (const raw of rawHosts) {
      const hostname = raw.address ?? raw.hostname ?? raw.host ?? raw.ip
      if (!hostname) {
        summary.skipped++
        continue
      }
      const protocol: Protocol = protocolMap[String(raw.protocol ?? 'ssh').toLowerCase()] ?? 'ssh'
      const port = Number(raw.port) || defaultPort[protocol]
      if (this.hostExists(String(hostname), port, protocol)) {
        summary.skipped++
        continue
      }
      const username = raw.username ?? raw.user ?? raw.login
      const identityId =
        protocol === 'ssh' && username
          ? this.ensureIdentity(String(username), undefined, summary)
          : undefined

      // Grup: id referansı ya da doğrudan grup adı
      let groupId: string | undefined
      const groupRef = raw.group ?? raw.groupId ?? raw.group_id
      if (groupRef != null) {
        const key = String(groupRef)
        if (groupIdMap.has(key)) {
          groupId = groupIdMap.get(key)
        } else if (typeof groupRef === 'string') {
          const created = this.vault.saveGroup({ id: '', name: groupRef })
          summary.groups++
          groupIdMap.set(key, created.id)
          groupId = created.id
        }
      }

      this.vault.saveHost({
        id: '',
        name: raw.label ?? raw.name ?? String(hostname),
        protocol,
        hostname: String(hostname),
        port,
        identityId,
        groupId,
        tags: ['termius']
      })
      summary.hosts++
    }

    return summary
  }
}
