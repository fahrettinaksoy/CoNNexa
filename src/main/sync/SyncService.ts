import { encryptPayload, decryptPayload } from '../crypto/vaultCrypto'
import type { VaultStore, PortableVault } from '../vault/VaultStore'
import type { SyncResult, ImportSummary } from '../../shared/types'

/**
 * Zero-knowledge senkronizasyon (rapor §5.1 / §6.4): vault, kullanıcının sync
 * parolasıyla İSTEMCİ TARAFINDA şifrelenir; uzak depo (GitHub Gist / WebDAV)
 * yalnızca şifreli blob'u görür. "Trafiğinizi asla proxy'lemeyiz" garantisi.
 *
 * Şifreleme: scrypt (parola türetme) + AES-256-GCM.
 * Blob biçimi: base64(JSON{ v, kdf, salt, iv, tag, data }).
 */
const GIST_FILENAME = 'connexa-vault.enc'

export class SyncService {
  constructor(private vault: VaultStore) {}

  private encrypt(payload: PortableVault, passphrase: string): string {
    return encryptPayload(payload, passphrase)
  }

  private decrypt(blobB64: string, passphrase: string): PortableVault {
    return decryptPayload<PortableVault>(blobB64, passphrase)
  }

  async push(passphrase: string): Promise<SyncResult> {
    if (!passphrase) return { ok: false, error: 'Passphrase required' }
    const config = this.vault.getSyncConfig()
    const blob = this.encrypt(this.vault.exportPortable(), passphrase)
    try {
      if (config.backend === 'gist') {
        const gistId = await this.pushGist(blob)
        return { ok: true, gistId }
      }
      if (config.backend === 'webdav') {
        await this.pushWebdav(blob)
        return { ok: true }
      }
      return { ok: false, error: 'No sync backend configured' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async pull(passphrase: string): Promise<SyncResult> {
    if (!passphrase) return { ok: false, error: 'Passphrase required' }
    const config = this.vault.getSyncConfig()
    try {
      let blob: string
      if (config.backend === 'gist') blob = await this.pullGist()
      else if (config.backend === 'webdav') blob = await this.pullWebdav()
      else return { ok: false, error: 'No sync backend configured' }

      const payload = this.decrypt(blob, passphrase)
      this.vault.replacePortable(payload)
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

  private async pushGist(blob: string): Promise<string> {
    const { gistToken } = this.vault.resolveSyncSecrets()
    if (!gistToken) throw new Error('GitHub token not configured')
    const config = this.vault.getSyncConfig()
    const body = JSON.stringify({
      description: 'Connexa encrypted vault',
      files: { [GIST_FILENAME]: { content: blob } }
    })
    const headers = {
      Authorization: `Bearer ${gistToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    }
    const url = config.gistId
      ? `https://api.github.com/gists/${config.gistId}`
      : 'https://api.github.com/gists'
    const res = await fetch(url, {
      method: config.gistId ? 'PATCH' : 'POST',
      headers,
      body
    })
    if (!res.ok) throw new Error(`Gist ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { id: string }
    if (!config.gistId) this.vault.setGistId(json.id)
    return json.id
  }

  private async pullGist(): Promise<string> {
    const { gistToken } = this.vault.resolveSyncSecrets()
    const config = this.vault.getSyncConfig()
    if (!config.gistId) throw new Error('No Gist ID — push first')
    const res = await fetch(`https://api.github.com/gists/${config.gistId}`, {
      headers: {
        ...(gistToken ? { Authorization: `Bearer ${gistToken}` } : {}),
        Accept: 'application/vnd.github+json'
      }
    })
    if (!res.ok) throw new Error(`Gist ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { files: Record<string, { content: string }> }
    const file = json.files[GIST_FILENAME]
    if (!file) throw new Error('Vault file not found in Gist')
    return file.content
  }

  // ---- WebDAV ----

  private webdavHeaders(): Record<string, string> {
    const config = this.vault.getSyncConfig()
    const { webdavPassword } = this.vault.resolveSyncSecrets()
    const headers: Record<string, string> = {}
    if (config.webdavUsername) {
      const auth = Buffer.from(`${config.webdavUsername}:${webdavPassword ?? ''}`).toString(
        'base64'
      )
      headers.Authorization = `Basic ${auth}`
    }
    return headers
  }

  private webdavTarget(): string {
    const { webdavUrl } = this.vault.getSyncConfig()
    if (!webdavUrl) throw new Error('WebDAV URL not configured')
    // URL bir klasör ise dosya adını ekle
    return webdavUrl.endsWith('/') ? `${webdavUrl}${GIST_FILENAME}` : webdavUrl
  }

  private async pushWebdav(blob: string): Promise<void> {
    const res = await fetch(this.webdavTarget(), {
      method: 'PUT',
      headers: { ...this.webdavHeaders(), 'Content-Type': 'text/plain' },
      body: blob
    })
    if (!res.ok) throw new Error(`WebDAV ${res.status}: ${await res.text()}`)
  }

  private async pullWebdav(): Promise<string> {
    const res = await fetch(this.webdavTarget(), { headers: this.webdavHeaders() })
    if (!res.ok) throw new Error(`WebDAV ${res.status}: ${await res.text()}`)
    return res.text()
  }
}
