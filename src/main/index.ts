import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { VaultStore } from './vault/VaultStore'
import { SessionManager } from './sessions/SessionManager'
import { SftpService } from './sessions/SftpService'
import { ImportService } from './import/ImportService'
import { TunnelManager } from './tunnels/TunnelManager'
import { SyncService } from './sync/SyncService'
import { RdpLauncher } from './rdp/RdpLauncher'
import { MetricsService } from './metrics/MetricsService'
import { RecordingService } from './recording/RecordingService'
import { CloudService } from './cloud/CloudService'
import { PasswordResolver } from './secrets/PasswordResolver'
import { AlarmService } from './alarm/AlarmService'
import { AiService } from './ai/AiService'
import { PluginService } from './plugins/PluginService'
import { TeamVaultService } from './team/TeamVaultService'
import { registerIpc } from './ipc'

let vault: VaultStore
let sessions: SessionManager
let tunnels: TunnelManager
let recording: RecordingService
let alarm: AlarmService

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Connexa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Güvenlik varsayılanları (rapor §6.1): renderer'da Node yok, izolasyon açık
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  vault = new VaultStore()
  const resolver = new PasswordResolver()
  sessions = new SessionManager(vault, resolver)
  tunnels = new TunnelManager(vault, resolver)
  recording = new RecordingService(sessions)
  const metrics = new MetricsService(sessions)
  alarm = new AlarmService(vault, sessions, metrics)
  alarm.start()
  registerIpc(
    vault,
    sessions,
    new SftpService(sessions),
    new ImportService(vault),
    tunnels,
    new SyncService(vault),
    new RdpLauncher(vault),
    metrics,
    recording,
    new CloudService(vault),
    alarm,
    new AiService(vault),
    new PluginService(),
    new TeamVaultService(vault)
  )
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  alarm?.stop()
  recording?.disposeAll()
  sessions?.disposeAll()
  tunnels?.disposeAll()
})
