import { execFile, exec } from 'child_process'
import { promisify } from 'util'
import type { SecretRef } from '../../shared/types'

const execFileAsync = promisify(execFile)
const execAsync = promisify(exec)

/**
 * Harici parola yöneticisi CLI'larından sır çözer (rapor §7 v2 — RustConn deseni).
 * Sırlar yalnızca bağlantı anında çözülür ve bellekte kalır; vault'a yazılmaz.
 *  - bitwarden: `bw get password <ref>` (BW_SESSION ile kilidi açık olmalı)
 *  - onepassword: `op read <ref>`
 *  - command: kullanıcının verdiği kabuk komutu (stdout = sır)
 */
export class PasswordResolver {
  async resolve(ref: SecretRef): Promise<string> {
    switch (ref.manager) {
      case 'bitwarden': {
        const { stdout } = await execFileAsync('bw', ['get', 'password', ref.ref], {
          timeout: 15000
        })
        return stdout.trim()
      }
      case 'onepassword': {
        const { stdout } = await execFileAsync('op', ['read', ref.ref], { timeout: 15000 })
        return stdout.trim()
      }
      case 'command': {
        const { stdout } = await execAsync(ref.ref, { timeout: 15000 })
        return stdout.replace(/\n$/, '')
      }
      default:
        throw new Error(`Unknown secret manager: ${ref.manager}`)
    }
  }
}
