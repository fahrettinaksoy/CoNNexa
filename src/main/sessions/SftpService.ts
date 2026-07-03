import { dialog, BrowserWindow } from 'electron'
import { basename } from 'path'
// Uzak yollar Windows'ta da daima POSIX biçimindedir
import posix from 'path/posix'
import type { SFTPWrapper } from 'ssh2'
import type { SftpEntry, SftpResult } from '../../shared/types'
import type { SessionManager } from './SessionManager'

/**
 * SSH oturumu üzerinden SFTP alt sistemi (MobaXterm "otomatik yan panel" deseni).
 * Aynı ssh2 Client'ı kullanır — ikinci bir kimlik doğrulama/bağlantı gerektirmez.
 * Dosya diyalogları main süreçte açılır; renderer yerel dosya sistemine dokunmaz.
 */
export class SftpService {
  private sftpMap = new Map<string, SFTPWrapper>()

  constructor(private sessions: SessionManager) {
    sessions.on('exit', (id: string) => {
      this.sftpMap.get(id)?.end()
      this.sftpMap.delete(id)
    })
  }

  private getSftp(sessionId: string): Promise<SFTPWrapper> {
    const cached = this.sftpMap.get(sessionId)
    if (cached) return Promise.resolve(cached)

    const client = this.sessions.getSshClient(sessionId)
    if (!client) return Promise.reject(new Error('Not an active SSH session'))

    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err)
          return
        }
        sftp.on('close', () => this.sftpMap.delete(sessionId))
        this.sftpMap.set(sessionId, sftp)
        resolve(sftp)
      })
    })
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<SftpResult<T>> {
    try {
      return { ok: true, data: await fn() }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  home(sessionId: string): Promise<SftpResult<string>> {
    return this.wrap(async () => {
      const sftp = await this.getSftp(sessionId)
      return new Promise<string>((resolve, reject) => {
        sftp.realpath('.', (err, path) => (err ? reject(err) : resolve(path)))
      })
    })
  }

  list(sessionId: string, dirPath: string): Promise<SftpResult<SftpEntry[]>> {
    return this.wrap(async () => {
      const sftp = await this.getSftp(sessionId)
      return new Promise<SftpEntry[]>((resolve, reject) => {
        sftp.readdir(dirPath, (err, items) => {
          if (err) {
            reject(err)
            return
          }
          const entries = items.map((item): SftpEntry => {
            const isDir = item.longname.startsWith('d')
            const isLink = item.longname.startsWith('l')
            return {
              name: item.filename,
              path: posix.join(dirPath, item.filename),
              type: isDir ? 'dir' : isLink ? 'link' : 'file',
              size: item.attrs.size ?? 0,
              mtime: (item.attrs.mtime ?? 0) * 1000
            }
          })
          entries.sort((a, b) =>
            a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1
          )
          resolve(entries)
        })
      })
    })
  }

  mkdir(sessionId: string, dirPath: string): Promise<SftpResult> {
    return this.wrap(async () => {
      const sftp = await this.getSftp(sessionId)
      return new Promise<undefined>((resolve, reject) => {
        sftp.mkdir(dirPath, (err) => (err ? reject(err) : resolve(undefined)))
      })
    })
  }

  rename(sessionId: string, from: string, to: string): Promise<SftpResult> {
    return this.wrap(async () => {
      const sftp = await this.getSftp(sessionId)
      return new Promise<undefined>((resolve, reject) => {
        sftp.rename(from, to, (err) => (err ? reject(err) : resolve(undefined)))
      })
    })
  }

  delete(sessionId: string, targetPath: string, isDir: boolean): Promise<SftpResult> {
    return this.wrap(async () => {
      const sftp = await this.getSftp(sessionId)
      return new Promise<undefined>((resolve, reject) => {
        const cb = (err: Error | null | undefined): void => (err ? reject(err) : resolve(undefined))
        if (isDir) sftp.rmdir(targetPath, cb)
        else sftp.unlink(targetPath, cb)
      })
    })
  }

  /** Kaydetme diyaloğu açar ve uzak dosyayı yerele indirir */
  download(sessionId: string, remotePath: string): Promise<SftpResult<string>> {
    return this.wrap(async () => {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: basename(remotePath)
      })
      if (result.canceled || !result.filePath) return ''
      const sftp = await this.getSftp(sessionId)
      const localPath = result.filePath
      await new Promise<void>((resolve, reject) => {
        sftp.fastGet(remotePath, localPath, (err) => (err ? reject(err) : resolve()))
      })
      return localPath
    })
  }

  /** Dosya seçme diyaloğu açar ve seçilenleri uzak dizine yükler */
  upload(sessionId: string, remoteDir: string): Promise<SftpResult<string[]>> {
    return this.wrap(async () => {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openFile', 'multiSelections']
      })
      if (result.canceled || result.filePaths.length === 0) return []
      const sftp = await this.getSftp(sessionId)
      const uploaded: string[] = []
      for (const localPath of result.filePaths) {
        const remotePath = posix.join(remoteDir, basename(localPath))
        await new Promise<void>((resolve, reject) => {
          sftp.fastPut(localPath, remotePath, (err) => (err ? reject(err) : resolve()))
        })
        uploaded.push(remotePath)
      }
      return uploaded
    })
  }
}
