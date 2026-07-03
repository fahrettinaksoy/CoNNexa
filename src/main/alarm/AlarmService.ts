import type { VaultStore } from '../vault/VaultStore'
import type { SessionManager } from '../sessions/SessionManager'
import type { MetricsService } from '../metrics/MetricsService'
import type { AlarmConfig, HostMetrics } from '../../shared/types'

/**
 * Eşik bazlı alarmlar (rapor §7 v2 — Termix izleme+alarm deseni).
 * Aktif SSH oturumlarını arka planda periyodik izler; CPU/bellek/disk eşiği
 * aşıldığında ntfy veya webhook ile bildirim gönderir. Bildirim yalnızca yeni
 * bir eşik aşımında gönderilir (durum değişimi) — tekrar tekrar spam yapmaz.
 */
const POLL_MS = 30000

export class AlarmService {
  private timer: ReturnType<typeof setInterval> | null = null
  /** Şu an eşik aşımında olan oturumlar (spam önleme) */
  private breached = new Set<string>()

  constructor(
    private vault: VaultStore,
    private sessions: SessionManager,
    private metrics: MetricsService
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.evaluate(), POLL_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private breaches(config: AlarmConfig, m: HostMetrics): string[] {
    const hits: string[] = []
    if (m.loadAvg && m.cpuCount) {
      const cpu = Math.round((m.loadAvg[0] / m.cpuCount) * 100)
      if (cpu >= config.cpuPercent) hits.push(`CPU ${cpu}%`)
    }
    if (m.memTotalBytes && m.memUsedBytes) {
      const mem = Math.round((m.memUsedBytes / m.memTotalBytes) * 100)
      if (mem >= config.memPercent) hits.push(`RAM ${mem}%`)
    }
    for (const disk of m.disks ?? []) {
      if (disk.usePercent >= config.diskPercent) hits.push(`Disk ${disk.mount} ${disk.usePercent}%`)
    }
    return hits
  }

  private async evaluate(): Promise<void> {
    const config = this.vault.getAlarmConfig()
    if (!config.enabled || !config.notifyTarget) return

    const active = this.sessions.list().filter((s) => s.protocol === 'ssh')
    const activeIds = new Set(active.map((s) => s.id))
    // Kapanan oturumların durumunu temizle
    for (const id of this.breached) if (!activeIds.has(id)) this.breached.delete(id)

    for (const session of active) {
      const m = await this.metrics.snapshot(session.id)
      if (!m.ok) continue
      const hits = this.breaches(config, m)
      if (hits.length > 0) {
        if (!this.breached.has(session.id)) {
          this.breached.add(session.id)
          await this.notify(
            config,
            `⚠️ ${session.title}`,
            hits.join(', '),
            session.title
          )
        }
      } else {
        this.breached.delete(session.id)
      }
    }
  }

  async notify(
    config: AlarmConfig,
    title: string,
    message: string,
    host: string
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      if (config.notifyType === 'ntfy') {
        const res = await fetch(config.notifyTarget, {
          method: 'POST',
          headers: { Title: title, Priority: 'high', Tags: 'warning' },
          body: message
        })
        if (!res.ok) throw new Error(`ntfy ${res.status}`)
      } else {
        const res = await fetch(config.notifyTarget, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, message, host })
        })
        if (!res.ok) throw new Error(`webhook ${res.status}`)
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /** UI'daki test butonu için: verilen yapılandırmayla anında bir bildirim gönderir */
  test(config: AlarmConfig): Promise<{ ok: boolean; error?: string }> {
    return this.notify(config, 'Connexa test', 'Alarm bildirimi çalışıyor ✅', 'test')
  }
}
