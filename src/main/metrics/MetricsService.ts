import type { SessionManager } from '../sessions/SessionManager'
import type { HostMetrics, DiskUsage, ProcessInfo } from '../../shared/types'

/**
 * Sunucu izleme (rapor §7 v2 — Muon "sysadmin araç kutusu" mirası).
 * Tek bir SSH exec çağrısıyla CPU/RAM/disk/uptime/süreç bilgisini toplar ve
 * ayrıştırır. Linux hedefler için tasarlanmıştır (portatif komutlar).
 */
const MARKERS = {
  up: '__UP__',
  mem: '__MEM__',
  cpu: '__CPU__',
  disk: '__DISK__',
  proc: '__PROC__'
}

const SNAPSHOT_COMMAND = [
  `echo ${MARKERS.up}`,
  'uptime',
  `echo ${MARKERS.mem}`,
  'free -b',
  `echo ${MARKERS.cpu}`,
  'nproc',
  `echo ${MARKERS.disk}`,
  'df -kP',
  `echo ${MARKERS.proc}`,
  'ps -eo pid,pcpu,pmem,comm --sort=-pcpu 2>/dev/null | head -n 16'
].join('; ')

export class MetricsService {
  constructor(private sessions: SessionManager) {}

  async snapshot(sessionId: string): Promise<HostMetrics> {
    try {
      const { stdout } = await this.sessions.exec(sessionId, SNAPSHOT_COMMAND)
      return this.parse(stdout)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  private section(output: string, marker: string, next?: string): string {
    const start = output.indexOf(marker)
    if (start < 0) return ''
    const from = start + marker.length
    const end = next ? output.indexOf(next, from) : output.length
    return output.slice(from, end < 0 ? output.length : end).trim()
  }

  private parse(output: string): HostMetrics {
    const metrics: HostMetrics = { ok: true }

    // uptime: "... load average: 0.10, 0.20, 0.30"
    const up = this.section(output, MARKERS.up, MARKERS.mem)
    if (up) {
      metrics.uptime = up.replace(/\s+/g, ' ')
      const load = up.match(/load average[s]?:\s*([\d.]+),?\s*([\d.]+),?\s*([\d.]+)/i)
      if (load) {
        metrics.loadAvg = [parseFloat(load[1]), parseFloat(load[2]), parseFloat(load[3])]
      }
    }

    // free -b: "Mem: total used free ..."
    const mem = this.section(output, MARKERS.mem, MARKERS.cpu)
    const memLine = mem.split('\n').find((l) => /^Mem:/i.test(l.trim()))
    if (memLine) {
      const parts = memLine.trim().split(/\s+/)
      metrics.memTotalBytes = parseInt(parts[1], 10)
      metrics.memUsedBytes = parseInt(parts[2], 10)
    }

    const cpu = this.section(output, MARKERS.cpu, MARKERS.disk)
    const cpuCount = parseInt(cpu.trim(), 10)
    if (!Number.isNaN(cpuCount)) metrics.cpuCount = cpuCount

    // df -kP: satırlar Filesystem 1024-blocks Used Available Capacity Mounted
    const disk = this.section(output, MARKERS.disk, MARKERS.proc)
    const disks: DiskUsage[] = []
    for (const line of disk.split('\n').slice(1)) {
      const p = line.trim().split(/\s+/)
      if (p.length < 6) continue
      const sizeKb = parseInt(p[1], 10)
      const usedKb = parseInt(p[2], 10)
      const mount = p.slice(5).join(' ')
      if (Number.isNaN(sizeKb) || sizeKb === 0) continue
      // Sanal dosya sistemlerini atla
      if (/^\/(dev|proc|sys|run)/.test(mount) && mount !== '/') continue
      disks.push({
        mount,
        sizeBytes: sizeKb * 1024,
        usedBytes: usedKb * 1024,
        usePercent: Math.round((usedKb / sizeKb) * 100)
      })
    }
    metrics.disks = disks

    // ps: pid pcpu pmem comm
    const proc = this.section(output, MARKERS.proc)
    const processes: ProcessInfo[] = []
    for (const line of proc.split('\n').slice(1)) {
      const p = line.trim().split(/\s+/)
      if (p.length < 4) continue
      const pid = parseInt(p[0], 10)
      if (Number.isNaN(pid)) continue
      processes.push({
        pid,
        cpu: parseFloat(p[1]) || 0,
        mem: parseFloat(p[2]) || 0,
        command: p.slice(3).join(' ')
      })
    }
    metrics.processes = processes

    return metrics
  }
}
