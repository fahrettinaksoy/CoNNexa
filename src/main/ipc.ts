import { ipcMain, WebContents } from 'electron'
import type { VaultStore } from './vault/VaultStore'
import type { SessionManager } from './sessions/SessionManager'
import type { SftpService } from './sessions/SftpService'
import type { ImportService } from './import/ImportService'
import type { TunnelManager } from './tunnels/TunnelManager'
import type { SyncService } from './sync/SyncService'
import type { RdpLauncher } from './rdp/RdpLauncher'
import type { MetricsService } from './metrics/MetricsService'
import type { RecordingService } from './recording/RecordingService'
import type { CloudService, CloudProvider } from './cloud/CloudService'
import type { AlarmService } from './alarm/AlarmService'
import type { AiService } from './ai/AiService'
import type { PluginService } from './plugins/PluginService'
import type { TeamVaultService } from './team/TeamVaultService'
import type {
  Host,
  Group,
  Snippet,
  Tunnel,
  SyncConfigInput,
  AlarmConfig,
  AiConfigInput,
  TeamVaultInput,
  IdentitySaveRequest,
  CreateSessionRequest,
  CreateSessionResult
} from '../shared/types'

/**
 * IPC yüzeyi bilinçli olarak dar tutulur (rapor §6.1):
 * renderer sırlara değil, yalnızca ID'lere ve genel (public) verilere erişir.
 */
export function registerIpc(
  vault: VaultStore,
  sessions: SessionManager,
  sftp: SftpService,
  importer: ImportService,
  tunnels: TunnelManager,
  sync: SyncService,
  rdpLauncher: RdpLauncher,
  metrics: MetricsService,
  recording: RecordingService,
  cloud: CloudService,
  alarm: AlarmService,
  ai: AiService,
  plugins: PluginService,
  team: TeamVaultService
): void {
  // ---- Vault ----
  ipcMain.handle('vault:get', () => vault.getPublicData())
  ipcMain.handle('vault:saveHost', (_e, host: Host) => vault.saveHost(host))
  ipcMain.handle('vault:deleteHost', (_e, id: string) => vault.deleteHost(id))
  ipcMain.handle('vault:saveIdentity', (_e, req: IdentitySaveRequest) => vault.saveIdentity(req))
  ipcMain.handle('vault:deleteIdentity', (_e, id: string) => vault.deleteIdentity(id))
  ipcMain.handle('vault:saveGroup', (_e, group: Group) => vault.saveGroup(group))
  ipcMain.handle('vault:deleteGroup', (_e, id: string) => vault.deleteGroup(id))
  ipcMain.handle('vault:saveSnippet', (_e, snippet: Snippet) => vault.saveSnippet(snippet))
  ipcMain.handle('vault:deleteSnippet', (_e, id: string) => vault.deleteSnippet(id))
  ipcMain.handle('vault:saveTunnel', (_e, tunnel: Tunnel) => vault.saveTunnel(tunnel))
  ipcMain.handle('vault:deleteTunnel', (_e, id: string) => {
    tunnels.stop(id)
    vault.deleteTunnel(id)
  })

  // ---- Sessions ----
  const subscribers = new Set<WebContents>()

  const subscribe = (wc: WebContents): void => {
    if (subscribers.has(wc)) return
    subscribers.add(wc)
    wc.once('destroyed', () => subscribers.delete(wc))
  }

  sessions.on('output', (id: string, data: string) => {
    for (const wc of subscribers) wc.send('session:output', id, data)
  })
  sessions.on('exit', (id: string, message?: string) => {
    for (const wc of subscribers) wc.send('session:exit', id, message)
  })
  tunnels.on('state', (tunnelId: string, running: boolean, error?: string) => {
    for (const wc of subscribers) wc.send('tunnel:state', tunnelId, running, error)
  })
  ai.on('delta', (requestId: string, text: string) => {
    for (const wc of subscribers) wc.send('ai:delta', requestId, text)
  })
  ai.on('done', (requestId: string) => {
    for (const wc of subscribers) wc.send('ai:done', requestId)
  })
  ai.on('error', (requestId: string, message: string) => {
    for (const wc of subscribers) wc.send('ai:error', requestId, message)
  })

  ipcMain.handle(
    'session:create',
    async (event, req: CreateSessionRequest): Promise<CreateSessionResult> => {
      subscribe(event.sender)
      try {
        if (req.local) {
          return { ok: true, session: sessions.createLocal(req.cols, req.rows) }
        }
        const host = req.hostId ? vault.getHost(req.hostId) : undefined
        if (!host) return { ok: false, error: 'Host not found' }
        const descriptor = await sessions.createForHost(host, req.cols, req.rows)
        return { ok: true, session: descriptor }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  // Yüksek frekanslı kanal: handle yerine on (yanıt beklemez)
  ipcMain.on('session:write', (_e, id: string, data: string) => sessions.write(id, data))
  ipcMain.on('session:resize', (_e, id: string, cols: number, rows: number) =>
    sessions.resize(id, cols, rows)
  )
  ipcMain.on('session:close', (_e, id: string) => sessions.close(id))

  // ---- SFTP ----
  ipcMain.handle('sftp:home', (_e, sessionId: string) => sftp.home(sessionId))
  ipcMain.handle('sftp:list', (_e, sessionId: string, path: string) =>
    sftp.list(sessionId, path)
  )
  ipcMain.handle('sftp:mkdir', (_e, sessionId: string, path: string) =>
    sftp.mkdir(sessionId, path)
  )
  ipcMain.handle('sftp:rename', (_e, sessionId: string, from: string, to: string) =>
    sftp.rename(sessionId, from, to)
  )
  ipcMain.handle('sftp:delete', (_e, sessionId: string, path: string, isDir: boolean) =>
    sftp.delete(sessionId, path, isDir)
  )
  ipcMain.handle('sftp:download', (_e, sessionId: string, remotePath: string) =>
    sftp.download(sessionId, remotePath)
  )
  ipcMain.handle('sftp:upload', (_e, sessionId: string, remoteDir: string) =>
    sftp.upload(sessionId, remoteDir)
  )

  // ---- Import ----
  ipcMain.handle('import:sshConfig', () => importer.importSshConfig())
  ipcMain.handle('import:mremoteng', () => importer.importMRemoteNG())
  ipcMain.handle('import:termius', () => importer.importTermius())

  // ---- Tunnels ----
  ipcMain.handle('tunnel:running', (event): string[] => {
    subscribe(event.sender)
    return tunnels.runningIds()
  })
  ipcMain.handle('tunnel:start', async (event, tunnelId: string) => {
    subscribe(event.sender)
    const tunnel = vault.getTunnel(tunnelId)
    if (!tunnel) return { ok: false, error: 'Tunnel not found' }
    const host = vault.getHost(tunnel.hostId)
    if (!host) return { ok: false, error: 'Tunnel host not found' }
    try {
      await tunnels.start(tunnel, host)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
  ipcMain.handle('tunnel:stop', (_e, tunnelId: string) => tunnels.stop(tunnelId))

  // ---- Sync ----
  ipcMain.handle('sync:getConfig', () => vault.getSyncPublic())
  ipcMain.handle('sync:saveConfig', (_e, input: SyncConfigInput) => vault.saveSyncConfig(input))
  ipcMain.handle('sync:push', (_e, passphrase: string) => sync.push(passphrase))
  ipcMain.handle('sync:pull', (_e, passphrase: string) => sync.pull(passphrase))

  // ---- Harici RDP ----
  ipcMain.handle('rdp:launchExternal', (_e, hostId: string) => {
    const host = vault.getHost(hostId)
    if (!host) return { ok: false, error: 'Host not found' }
    return rdpLauncher.launch(host)
  })

  // ---- Metrikler ----
  ipcMain.handle('metrics:snapshot', (_e, sessionId: string) => metrics.snapshot(sessionId))

  // ---- Oturum kaydı ----
  ipcMain.handle(
    'recording:start',
    (_e, sessionId: string, title: string, cols: number, rows: number) =>
      recording.start(sessionId, title, cols, rows)
  )
  ipcMain.handle('recording:stop', (_e, sessionId: string) => recording.stop(sessionId))
  ipcMain.handle('recording:active', () => recording.activeIds())
  ipcMain.handle('recording:openFolder', () => recording.openFolder())

  // ---- Bulut envanteri ----
  ipcMain.handle(
    'cloud:import',
    (_e, provider: CloudProvider, token: string, identityId?: string) =>
      cloud.import(provider, token, identityId)
  )

  // ---- Alarmlar ----
  ipcMain.handle('alarm:getConfig', () => vault.getAlarmConfig())
  ipcMain.handle('alarm:saveConfig', (_e, config: AlarmConfig) => vault.saveAlarmConfig(config))
  ipcMain.handle('alarm:test', (_e, config: AlarmConfig) => alarm.test(config))

  // ---- AI asistan ----
  ipcMain.handle('ai:getConfig', () => vault.getAiPublic())
  ipcMain.handle('ai:saveConfig', (_e, input: AiConfigInput) => vault.saveAiConfig(input))
  ipcMain.on('ai:ask', (event, requestId: string, prompt: string, context?: string) => {
    subscribe(event.sender)
    void ai.ask(requestId, prompt, context)
  })
  ipcMain.on('ai:cancel', (_e, requestId: string) => ai.cancel(requestId))

  // ---- Plugin'ler ----
  ipcMain.handle('plugins:list', () => plugins.list())
  ipcMain.handle('plugins:install', () => plugins.install())
  ipcMain.handle('plugins:remove', (_e, id: string) => plugins.remove(id))
  ipcMain.handle('plugins:openFolder', () => plugins.openFolder())

  // ---- Ekip vault'ları ----
  ipcMain.handle('team:list', () => vault.getTeamVaultsPublic())
  ipcMain.handle('team:save', (_e, input: TeamVaultInput) => vault.saveTeamVault(input))
  ipcMain.handle('team:delete', (_e, id: string) => vault.deleteTeamVault(id))
  ipcMain.handle(
    'team:assign',
    (_e, kind: 'host' | 'group' | 'snippet' | 'identity', itemId: string, teamId: string | null) =>
      vault.assignToTeam(kind, itemId, teamId)
  )
  ipcMain.handle('team:push', (_e, teamId: string, passphrase: string) => team.push(teamId, passphrase))
  ipcMain.handle('team:pull', (_e, teamId: string, passphrase: string) => team.pull(teamId, passphrase))
}
