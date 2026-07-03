import { app } from 'electron'
import { spawn, execFile } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import type { Host } from '../../shared/types'
import type { VaultStore } from '../vault/VaultStore'

/**
 * Harici RDP istemcisine delege (1Remote "runner" deseni, rapor §8/1):
 * in-app WASM istemcisi NLA/çoklu ekran/HiDPI için yetersizse platformun
 * yerel RDP istemcisini başlatır.
 *  - Windows: cmdkey ile kimlik + mstsc
 *  - macOS: geçici .rdp dosyası + Microsoft Remote Desktop (parola kullanıcıdan)
 *  - Linux: xfreerdp / freerdp
 */
export class RdpLauncher {
  constructor(private vault: VaultStore) {}

  launch(host: Host): { ok: boolean; error?: string } {
    const identityId = this.vault.resolveIdentityId(host)
    const secrets = identityId ? this.vault.resolveSecrets(identityId) : null
    const username = secrets?.identity.username
    const password = secrets?.password
    const port = host.port || 3389

    try {
      switch (process.platform) {
        case 'win32':
          this.launchWindows(host.hostname, port, username, password)
          break
        case 'darwin':
          this.launchMac(host, port, username)
          break
        default:
          this.launchLinux(host.hostname, port, username, password)
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  private launchWindows(
    hostname: string,
    port: number,
    username?: string,
    password?: string
  ): void {
    const target = `${hostname}:${port}`
    // Kimlik bilgisini geçici olarak Windows credential store'a yaz
    if (username && password) {
      execFile('cmdkey', [`/generic:TERMSRV/${hostname}`, `/user:${username}`, `/pass:${password}`])
    }
    const child = spawn('mstsc.exe', [`/v:${target}`], { detached: true, stdio: 'ignore' })
    child.unref()
    // Bağlantı kurulduktan sonra kimliği temizle (kısa gecikme)
    if (username) {
      setTimeout(() => execFile('cmdkey', [`/delete:TERMSRV/${hostname}`]), 20000)
    }
  }

  private launchMac(host: Host, port: number, username?: string): void {
    // macOS RDP istemcileri CLI ile parola almaz; .rdp dosyası üretip açıyoruz
    const lines = [
      `full address:s:${host.hostname}:${port}`,
      username ? `username:s:${username}` : '',
      'screen mode id:i:2',
      'authentication level:i:2'
    ].filter(Boolean)
    const filePath = join(app.getPath('temp'), `connexa-${host.id || 'rdp'}.rdp`)
    writeFileSync(filePath, lines.join('\n'), 'utf-8')
    const child = spawn('open', [filePath], { detached: true, stdio: 'ignore' })
    child.unref()
  }

  private launchLinux(
    hostname: string,
    port: number,
    username?: string,
    password?: string
  ): void {
    const args = [`/v:${hostname}`, `/port:${port}`]
    if (username) args.push(`/u:${username}`)
    if (password) args.push(`/p:${password}`)
    args.push('/cert:ignore', '+clipboard', '/dynamic-resolution')

    // xfreerdp yoksa freerdp'ye düş; ikisi de yoksa sessizce log'la
    // (spawn hatası asenkron geldiğinden launch() dönüşüne yansımaz)
    const tryClient = (client: string, onFail: () => void): void => {
      const child = spawn(client, args, { detached: true, stdio: 'ignore' })
      child.on('error', onFail)
      child.unref()
    }
    tryClient('xfreerdp', () => {
      tryClient('freerdp', () => {
        console.error('No FreeRDP client found (install xfreerdp/freerdp)')
      })
    })
  }
}
