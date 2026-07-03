import { EventEmitter } from 'events'
import Anthropic from '@anthropic-ai/sdk'
import type { VaultStore } from '../vault/VaultStore'

/**
 * AI komut asistanı (rapor §7 v2 — electerm/Termius deseni). Kullanıcının kendi
 * Anthropic API anahtarıyla çalışır (bring-your-own-key); anahtar safeStorage'da
 * şifreli durur ve renderer'a gitmez. İstek main süreçte yapılır (CSP/CORS yok).
 *
 * Events:
 *  - 'delta' (requestId, text)
 *  - 'done'  (requestId)
 *  - 'error' (requestId, message)
 */
const SYSTEM_PROMPT = `Sen Connexa adlı bir SSH/terminal istemcisinin komut asistanısın.
Kullanıcı doğal dille bir görev tarifler; sen o görevi gerçekleştiren kabuk komutunu üret.
Yanıtın kısa olsun: önce tek satırlık açıklama, sonra komutu tek bir \`\`\`bash kod bloğunda ver.
Tehlikeli komutlarda (silme, biçimlendirme) kısa bir uyarı ekle. Türkçe açıkla.`

export class AiService extends EventEmitter {
  private aborters = new Map<string, AbortController>()

  constructor(private vault: VaultStore) {
    super()
  }

  /**
   * Bir istek başlatır; yanıt parça parça 'delta' olaylarıyla akar.
   * context: aktif terminalin son çıktısı (opsiyonel bağlam).
   */
  async ask(requestId: string, prompt: string, context?: string): Promise<void> {
    const { model, apiKey } = this.vault.resolveAi()
    if (!apiKey) {
      this.emit('error', requestId, 'API anahtarı ayarlı değil (Ayarlar → AI Asistan)')
      return
    }

    const client = new Anthropic({ apiKey })
    const controller = new AbortController()
    this.aborters.set(requestId, controller)

    const userContent = context
      ? `Bağlam (terminal çıktısı):\n${context.slice(-2000)}\n\nGörev: ${prompt}`
      : prompt

    try {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: 2048,
          thinking: { type: 'adaptive' },
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }]
        },
        { signal: controller.signal }
      )

      stream.on('text', (delta) => this.emit('delta', requestId, delta))

      await stream.finalMessage()
      this.emit('done', requestId)
    } catch (err) {
      if (controller.signal.aborted) {
        this.emit('done', requestId)
      } else {
        this.emit('error', requestId, err instanceof Error ? err.message : String(err))
      }
    } finally {
      this.aborters.delete(requestId)
    }
  }

  cancel(requestId: string): void {
    this.aborters.get(requestId)?.abort()
  }
}
