import { readFileSync } from 'fs'
import { Client, type ConnectConfig } from 'ssh2'
import type { Host } from '../../shared/types'
import type { VaultStore } from '../vault/VaultStore'
import type { PasswordResolver } from '../secrets/PasswordResolver'

/**
 * Bir Host'un kimliğini (doğrudan ya da grup kalıtımıyla) çözüp ssh2
 * ConnectConfig üretir. Sırlar main süreçte kalır; renderer'a gitmez.
 * Parola bir harici yöneticiye bağlıysa (secretRef) bağlantı anında çözülür.
 * SessionManager ve TunnelManager bu mantığı paylaşır.
 */
export async function buildSshConfig(
  host: Host,
  vault: VaultStore,
  resolver: PasswordResolver
): Promise<ConnectConfig> {
  const identityId = vault.resolveIdentityId(host)
  const secrets = identityId ? vault.resolveSecrets(identityId) : null
  if (!secrets) {
    throw new Error('Host has no identity assigned (directly or via group)')
  }
  const { identity, passphrase } = secrets
  let password = secrets.password

  // Parola harici yöneticide ise bağlantı anında çöz
  if (identity.authType === 'password' && identity.secretRef) {
    password = await resolver.resolve(identity.secretRef)
  }

  let privateKey: Buffer | undefined
  if (identity.authType === 'key' && identity.privateKeyPath) {
    try {
      privateKey = readFileSync(identity.privateKeyPath)
    } catch {
      throw new Error(`Cannot read private key: ${identity.privateKeyPath}`)
    }
  }

  return {
    host: host.hostname,
    port: host.port || 22,
    username: identity.username,
    password: identity.authType === 'password' ? password : undefined,
    privateKey,
    passphrase,
    agent: identity.authType === 'agent' ? process.env.SSH_AUTH_SOCK : undefined,
    readyTimeout: 15000,
    keepaliveInterval: 30000
  }
}

/** Bağlı bir ssh2 Client döndürür (yalnızca bağlantı; shell açmaz). */
export async function connectSsh(
  host: Host,
  vault: VaultStore,
  resolver: PasswordResolver
): Promise<Client> {
  const config = await buildSshConfig(host, vault, resolver)
  return new Promise((resolve, reject) => {
    const client = new Client()
    let settled = false
    client.on('ready', () => {
      settled = true
      resolve(client)
    })
    client.on('error', (err) => {
      if (!settled) reject(err)
    })
    client.connect(config)
  })
}
