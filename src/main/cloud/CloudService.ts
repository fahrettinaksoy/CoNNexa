import type { VaultStore } from '../vault/VaultStore'
import type { ImportSummary } from '../../shared/types'

export type CloudProvider = 'digitalocean' | 'hetzner'

interface DiscoveredServer {
  name: string
  ip: string
}

/**
 * Bulut sağlayıcı envanteri (rapor §7 v2 — Ghostly Bridge / RoyalJSON deseni).
 * DigitalOcean ve Hetzner API'lerinden sunucuları çekip SSH hostu olarak içe
 * aktarır. Token yalnızca istek anında kullanılır, saklanmaz.
 */
export class CloudService {
  constructor(private vault: VaultStore) {}

  async import(
    provider: CloudProvider,
    token: string,
    identityId?: string
  ): Promise<ImportSummary> {
    const summary: ImportSummary = { ok: true, hosts: 0, identities: 0, groups: 0, skipped: 0 }
    if (!token) return { ...summary, ok: false, error: 'API token required' }

    let servers: DiscoveredServer[]
    try {
      servers =
        provider === 'digitalocean'
          ? await this.fetchDigitalOcean(token)
          : await this.fetchHetzner(token)
    } catch (err) {
      return { ...summary, ok: false, error: err instanceof Error ? err.message : String(err) }
    }

    // Sağlayıcı adında bir grup oluştur/yeniden kullan
    const label = provider === 'digitalocean' ? 'DigitalOcean' : 'Hetzner'
    const existingGroup = this.vault.getPublicData().groups.find((g) => g.name === label)
    const group = existingGroup ?? this.vault.saveGroup({ id: '', name: label })
    if (!existingGroup) summary.groups++

    const existingHosts = this.vault.getPublicData().hosts
    for (const server of servers) {
      if (!server.ip) {
        summary.skipped++
        continue
      }
      const dup = existingHosts.some(
        (h) => h.hostname === server.ip && h.port === 22 && h.protocol === 'ssh'
      )
      if (dup) {
        summary.skipped++
        continue
      }
      this.vault.saveHost({
        id: '',
        name: server.name || server.ip,
        protocol: 'ssh',
        hostname: server.ip,
        port: 22,
        identityId,
        groupId: group.id,
        tags: [provider]
      })
      summary.hosts++
    }

    return summary
  }

  private async fetchDigitalOcean(token: string): Promise<DiscoveredServer[]> {
    const res = await fetch('https://api.digitalocean.com/v2/droplets?per_page=200', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(`DigitalOcean ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as {
      droplets: Array<{
        name: string
        networks: { v4: Array<{ ip_address: string; type: string }> }
      }>
    }
    return json.droplets.map((d) => ({
      name: d.name,
      ip: d.networks.v4.find((n) => n.type === 'public')?.ip_address ?? ''
    }))
  }

  private async fetchHetzner(token: string): Promise<DiscoveredServer[]> {
    const res = await fetch('https://api.hetzner.cloud/v1/servers?per_page=50', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(`Hetzner ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as {
      servers: Array<{ name: string; public_net: { ipv4: { ip: string } | null } }>
    }
    return json.servers.map((s) => ({
      name: s.name,
      ip: s.public_net.ipv4?.ip ?? ''
    }))
  }
}
