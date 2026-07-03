import { encryptPayload, decryptPayload } from '../crypto/vaultCrypto'
import type { VaultStore, PortableTeamVault, TeamVaultStored } from '../vault/VaultStore'
import type { TeamVaultResult, ImportSummary } from '../../shared/types'

/**
 * Ekip vault paylaşımı (rapor §9 — Termius ekip vault deseninin açık kaynak,
 * zero-knowledge sürümü). Bir ekip vault'u; host/grup/snippet ve SIRSIZ kimlikleri
 * ekip parolasıyla İSTEMCİ TARAFINDA şifreleyip ortak bir depoya (GitHub Gist /
 * WebDAV) yükler. Kişisel parolalar asla paylaşılmaz; her üye kendi sırlarını
 * yerelde girer veya parola yöneticisi referansı kullanır.
 */
export class TeamVaultService {
  constructor(private vault: VaultStore) {}

  private gistFilename(teamId: string): string {
    return `connexa-team-${teamId}.enc`
  }

  async push(teamId: string, passphrase: string): Promise<TeamVaultResult> {
    if (!passphrase) return { ok: false, error: 'Passphrase required' }
    const tv = this.vault.getTeamVault(teamId)
    if (!tv) return { ok: false, error: 'Team vault not found' }

    const blob = encryptPayload(this.vault.exportTeam(teamId), passphrase)
    try {
      if (tv.backend === 'gist') {
        const gistId = await this.pushGist(tv, blob, teamId)
        return { ok: true, gistId }
      }
      await this.pushWebdav(tv, blob, teamId)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async pull(teamId: string, passphrase: string): Promise<TeamVaultResult> {
    if (!passphrase) return { ok: false, error: 'Passphrase required' }
    const tv = this.vault.getTeamVault(teamId)
    if (!tv) return { ok: false, error: 'Team vault not found' }

    try {
      const blob = tv.backend === 'gist' ? await this.pullGist(tv, teamId) : await this.pullWebdav(tv, teamId)
      const payload = decryptPayload<PortableTeamVault>(blob, passphrase)
      this.vault.replaceTeam(teamId, payload)
      const summary: ImportSummary = {
        ok: true,
        hosts: payload.hosts.length,
        identities: payload.identities.length,
        groups: payload.groups.length,
        skipped: 0
      }
      return { ok: true, summary }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  // ---- GitHub Gist ----

  private async pushGist(tv: TeamVaultStored, blob: string, teamId: string): Promise<string> {
    const { gistToken } = this.vault.resolveTeamSecrets(teamId)
    if (!gistToken) throw new Error('GitHub token not configured for this team')
    const body = JSON.stringify({
      description: `Connexa team vault: ${tv.name}`,
      files: { [this.gistFilename(teamId)]: { content: blob } }
    })
    const headers = {
      Authorization: `Bearer ${gistToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    }
    const url = tv.gistId
      ? `https://api.github.com/gists/${tv.gistId}`
      : 'https://api.github.com/gists'
    const res = await fetch(url, { method: tv.gistId ? 'PATCH' : 'POST', headers, body })
    if (!res.ok) throw new Error(`Gist ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { id: string }
    if (!tv.gistId) this.vault.setTeamGistId(teamId, json.id)
    return json.id
  }

  private async pullGist(tv: TeamVaultStored, teamId: string): Promise<string> {
    const { gistToken } = this.vault.resolveTeamSecrets(teamId)
    if (!tv.gistId) throw new Error('No Gist ID — push first or set it')
    const res = await fetch(`https://api.github.com/gists/${tv.gistId}`, {
      headers: {
        ...(gistToken ? { Authorization: `Bearer ${gistToken}` } : {}),
        Accept: 'application/vnd.github+json'
      }
    })
    if (!res.ok) throw new Error(`Gist ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { files: Record<string, { content: string }> }
    const file = json.files[this.gistFilename(teamId)]
    if (!file) throw new Error('Team vault file not found in Gist')
    return file.content
  }

  // ---- WebDAV ----

  private webdavHeaders(tv: TeamVaultStored, teamId: string): Record<string, string> {
    const { webdavPassword } = this.vault.resolveTeamSecrets(teamId)
    const headers: Record<string, string> = {}
    if (tv.webdavUsername) {
      const auth = Buffer.from(`${tv.webdavUsername}:${webdavPassword ?? ''}`).toString('base64')
      headers.Authorization = `Basic ${auth}`
    }
    return headers
  }

  private webdavTarget(tv: TeamVaultStored, teamId: string): string {
    if (!tv.webdavUrl) throw new Error('WebDAV URL not configured')
    return tv.webdavUrl.endsWith('/')
      ? `${tv.webdavUrl}${this.gistFilename(teamId)}`
      : tv.webdavUrl
  }

  private async pushWebdav(tv: TeamVaultStored, blob: string, teamId: string): Promise<void> {
    const res = await fetch(this.webdavTarget(tv, teamId), {
      method: 'PUT',
      headers: { ...this.webdavHeaders(tv, teamId), 'Content-Type': 'text/plain' },
      body: blob
    })
    if (!res.ok) throw new Error(`WebDAV ${res.status}: ${await res.text()}`)
  }

  private async pullWebdav(tv: TeamVaultStored, teamId: string): Promise<string> {
    const res = await fetch(this.webdavTarget(tv, teamId), {
      headers: this.webdavHeaders(tv, teamId)
    })
    if (!res.ok) throw new Error(`WebDAV ${res.status}: ${await res.text()}`)
    return res.text()
  }
}
