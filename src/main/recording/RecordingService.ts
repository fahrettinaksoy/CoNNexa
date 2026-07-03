import { app, shell } from 'electron'
import { createWriteStream, mkdirSync, WriteStream } from 'fs'
import { join } from 'path'
import type { SessionManager } from '../sessions/SessionManager'

interface ActiveRecording {
  stream: WriteStream
  startMs: number
  filePath: string
}

/**
 * Oturum kaydı (rapor §7 v2). Terminal çıktısını asciicast v2 (.cast) biçiminde
 * kaydeder — asciinema ile oynatılabilir, düz metindir. Yalnızca çıktı kaydedilir
 * (girdi/sırlar değil). Kayıtlar userData/recordings altına yazılır.
 *
 * Zaman damgası main süreçte Date.now ile alınır (yalnızca kayıt için;
 * workflow kısıtı burada geçerli değil).
 */
export class RecordingService {
  private active = new Map<string, ActiveRecording>()
  private readonly dir: string

  constructor(sessions: SessionManager) {
    this.dir = join(app.getPath('userData'), 'recordings')
    sessions.on('output', (id: string, data: string) => this.onOutput(id, data))
    sessions.on('exit', (id: string) => {
      if (this.active.has(id)) this.stop(id)
    })
  }

  private sanitize(name: string): string {
    return name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40)
  }

  isRecording(sessionId: string): boolean {
    return this.active.has(sessionId)
  }

  activeIds(): string[] {
    return [...this.active.keys()]
  }

  start(
    sessionId: string,
    title: string,
    cols: number,
    rows: number
  ): { ok: boolean; error?: string; filePath?: string } {
    if (this.active.has(sessionId)) return { ok: true, filePath: this.active.get(sessionId)!.filePath }
    try {
      mkdirSync(this.dir, { recursive: true })
      const now = Date.now()
      const stamp = new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filePath = join(this.dir, `${stamp}-${this.sanitize(title)}.cast`)
      const stream = createWriteStream(filePath, { encoding: 'utf-8' })
      const header = {
        version: 2,
        width: cols,
        height: rows,
        timestamp: Math.floor(now / 1000),
        title
      }
      stream.write(JSON.stringify(header) + '\n')
      this.active.set(sessionId, { stream, startMs: now, filePath })
      return { ok: true, filePath }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  private onOutput(sessionId: string, data: string): void {
    const rec = this.active.get(sessionId)
    if (!rec) return
    const elapsed = (Date.now() - rec.startMs) / 1000
    rec.stream.write(JSON.stringify([elapsed, 'o', data]) + '\n')
  }

  stop(sessionId: string): { ok: boolean; filePath?: string } {
    const rec = this.active.get(sessionId)
    if (!rec) return { ok: false }
    rec.stream.end()
    this.active.delete(sessionId)
    return { ok: true, filePath: rec.filePath }
  }

  openFolder(): void {
    mkdirSync(this.dir, { recursive: true })
    shell.openPath(this.dir)
  }

  disposeAll(): void {
    for (const [, rec] of this.active) rec.stream.end()
    this.active.clear()
  }
}
