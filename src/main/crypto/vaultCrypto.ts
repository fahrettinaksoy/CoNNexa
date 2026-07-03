import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto'

/**
 * Zero-knowledge şifreleme yardımcıları (rapor §5.1 / §6.4).
 * Sync ve ekip vault paylaşımı bu ortak mantığı kullanır.
 *
 * Şifreleme: scrypt (parola türetme) + AES-256-GCM.
 * Blob biçimi: base64(JSON{ v, kdf, salt, iv, tag, data }).
 */
interface EncryptedBlob {
  v: 1
  kdf: 'scrypt'
  salt: string
  iv: string
  tag: string
  data: string
}

export function encryptPayload(payload: unknown, passphrase: string): string {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 })
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf-8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const blob: EncryptedBlob = {
    v: 1,
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  }
  return Buffer.from(JSON.stringify(blob), 'utf-8').toString('base64')
}

export function decryptPayload<T>(blobB64: string, passphrase: string): T {
  let blob: EncryptedBlob
  try {
    blob = JSON.parse(Buffer.from(blobB64, 'base64').toString('utf-8'))
  } catch {
    throw new Error('Corrupt or unrecognized encrypted blob')
  }
  const key = scryptSync(passphrase, Buffer.from(blob.salt, 'base64'), 32, {
    N: 16384,
    r: 8,
    p: 1
  })
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'))
  try {
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(blob.data, 'base64')),
      decipher.final()
    ])
    return JSON.parse(decrypted.toString('utf-8')) as T
  } catch {
    throw new Error('Wrong passphrase or corrupted data')
  }
}
