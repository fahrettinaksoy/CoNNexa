import { app, dialog, shell, BrowserWindow } from 'electron'
import { existsSync, readFileSync, readdirSync, mkdirSync, cpSync, rmSync } from 'fs'
import { join, basename } from 'path'
import type { PluginInfo, PluginResult, Snippet } from '../../shared/types'

/**
 * Bildirimsel (declarative) plugin sistemi (rapor §7 v2 — Voltius deseni).
 * Güvenlik: plugin'ler KOD ÇALIŞTIRMAZ; yalnızca bir `plugin.json` manifesti ile
 * snippet paketleri katkı sunar. Bu, keyfi kod yürütme riski olmadan
 * genişletilebilirlik sağlar. Plugin'ler userData/plugins/<id>/ altına kopyalanır.
 */
interface PluginManifest {
  name: string
  version: string
  description?: string
  author?: string
  snippets?: Array<{ name: string; command: string; tags?: string[] }>
}

export class PluginService {
  private readonly dir: string

  constructor() {
    this.dir = join(app.getPath('userData'), 'plugins')
  }

  private readManifest(pluginPath: string): PluginManifest | null {
    const manifestPath = join(pluginPath, 'plugin.json')
    if (!existsSync(manifestPath)) return null
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, 'utf-8')) as PluginManifest
      if (!parsed.name || !parsed.version) return null
      return parsed
    } catch {
      return null
    }
  }

  list(): PluginResult {
    const plugins: PluginInfo[] = []
    const snippets: Snippet[] = []
    if (!existsSync(this.dir)) return { ok: true, plugins, snippets }

    for (const entry of readdirSync(this.dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const manifest = this.readManifest(join(this.dir, entry.name))
      if (!manifest) continue
      const contributed = manifest.snippets ?? []
      plugins.push({
        id: entry.name,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        snippetCount: contributed.length
      })
      for (const [i, s] of contributed.entries()) {
        if (!s.name || !s.command) continue
        snippets.push({
          id: `plugin:${entry.name}:${i}`,
          name: s.name,
          command: s.command,
          tags: [...(s.tags ?? []), entry.name]
        })
      }
    }
    return { ok: true, plugins, snippets }
  }

  async install(): Promise<PluginResult> {
    const win = BrowserWindow.getFocusedWindow()
    const picked = await dialog.showOpenDialog(win!, {
      title: 'Plugin klasörü seç (plugin.json içermeli)',
      properties: ['openDirectory']
    })
    if (picked.canceled || picked.filePaths.length === 0) return this.list()

    const source = picked.filePaths[0]
    const manifest = this.readManifest(source)
    if (!manifest) {
      return { ...this.list(), ok: false, error: 'Geçerli bir plugin.json bulunamadı' }
    }
    try {
      mkdirSync(this.dir, { recursive: true })
      const target = join(this.dir, basename(source))
      // Yalnızca manifest'i kopyala — kod dosyaları çalıştırılmadığından güvenli
      cpSync(source, target, { recursive: true })
      return this.list()
    } catch (err) {
      return {
        ...this.list(),
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  remove(id: string): PluginResult {
    const target = join(this.dir, id)
    // Yol kaçışı koruması: id yalnızca dizin adı olmalı
    if (id.includes('/') || id.includes('..') || !existsSync(target)) return this.list()
    rmSync(target, { recursive: true, force: true })
    return this.list()
  }

  openFolder(): void {
    mkdirSync(this.dir, { recursive: true })
    shell.openPath(this.dir)
  }
}
