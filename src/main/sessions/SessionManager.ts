import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { Socket } from 'net'
import * as pty from 'node-pty'
import { Client } from 'ssh2'
import { SerialPort } from 'serialport'
import { BridgeServer } from '../bridge/BridgeServer'
import { buildSshConfig } from './sshConnect'
import type { Host, SessionDescriptor } from '../../shared/types'
import type { VaultStore } from '../vault/VaultStore'
import type { PasswordResolver } from '../secrets/PasswordResolver'

interface LiveSession {
  descriptor: SessionDescriptor
  write(data: string): void
  resize(cols: number, rows: number): void
  dispose(): void
  /** SSH oturumlarında SFTP gibi alt sistemlerin erişimi için */
  sshClient?: Client
}

/**
 * Tüm oturum yaşam döngüsü main süreçte yaşar (rapor §6.1):
 * node-pty → yerel terminal, ssh2 → SSH, net.Socket → Telnet.
 * Renderer yalnızca oturum ID'leriyle konuşur; credential çözümü burada yapılır.
 *
 * Events:
 *  - 'output' (id: string, data: string)
 *  - 'exit'   (id: string, message?: string)
 */
export class SessionManager extends EventEmitter {
  private sessions = new Map<string, LiveSession>()
  private bridges = new BridgeServer()

  constructor(
    private vault: VaultStore,
    private resolver: PasswordResolver
  ) {
    super()
  }

  list(): SessionDescriptor[] {
    return [...this.sessions.values()].map((s) => s.descriptor)
  }

  createLocal(cols: number, rows: number): SessionDescriptor {
    const id = randomUUID()
    const shell =
      process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'
    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME,
      env: process.env as Record<string, string>
    })
    proc.onData((data) => this.emit('output', id, data))
    proc.onExit(({ exitCode }) => {
      this.sessions.delete(id)
      this.emit('exit', id, `exit ${exitCode}`)
    })

    const descriptor: SessionDescriptor = { id, title: 'Local', protocol: 'local' }
    this.sessions.set(id, {
      descriptor,
      write: (data) => proc.write(data),
      resize: (c, r) => proc.resize(c, r),
      dispose: () => proc.kill()
    })
    return descriptor
  }

  async createForHost(host: Host, cols: number, rows: number): Promise<SessionDescriptor> {
    switch (host.protocol) {
      case 'ssh':
        return this.createSsh(host, cols, rows)
      case 'telnet':
        return this.createTelnet(host)
      case 'serial':
        return this.createSerial(host)
      case 'vnc':
        return this.createVnc(host)
      case 'rdp':
        return this.createRdp(host)
      default:
        throw new Error(`Protocol not implemented yet: ${host.protocol}`)
    }
  }

  private async createVnc(host: Host): Promise<SessionDescriptor> {
    const id = randomUUID()
    const identityId = this.vault.resolveIdentityId(host)
    const secrets = identityId ? this.vault.resolveSecrets(identityId) : null

    const bridge = await this.bridges.createVncBridge(host.hostname, host.port || 5900, () => {
      if (this.sessions.delete(id)) this.emit('exit', id)
    })

    const descriptor: SessionDescriptor = {
      id,
      title: host.name,
      protocol: 'vnc',
      hostId: host.id,
      vnc: { wsUrl: bridge.wsUrl, password: secrets?.password }
    }
    this.sessions.set(id, {
      descriptor,
      write: () => undefined,
      resize: () => undefined,
      dispose: () => bridge.close()
    })
    return descriptor
  }

  private async createRdp(host: Host): Promise<SessionDescriptor> {
    const identityId = this.vault.resolveIdentityId(host)
    const secrets = identityId ? this.vault.resolveSecrets(identityId) : null
    if (!secrets?.password) {
      throw new Error('RDP requires an identity with username and password')
    }

    const id = randomUUID()
    const proxyUrl = await this.bridges.ensureRdpProxy()
    const descriptor: SessionDescriptor = {
      id,
      title: host.name,
      protocol: 'rdp',
      hostId: host.id,
      rdp: {
        proxyUrl,
        destination: `${host.hostname}:${host.port || 3389}`,
        username: secrets.identity.username,
        password: secrets.password
      }
    }
    // RDP trafiği paylaşımlı proxy üzerinden akar; oturum kaydı yalnızca
    // sekme yaşam döngüsü içindir. Kapatma istemci tarafında gerçekleşir.
    this.sessions.set(id, {
      descriptor,
      write: () => undefined,
      resize: () => undefined,
      dispose: () => undefined
    })
    return descriptor
  }

  private async createSsh(host: Host, cols: number, rows: number): Promise<SessionDescriptor> {
    // Kimlik + sır çözümü (harici parola yöneticisi dahil) bağlantıdan önce
    const config = await buildSshConfig(host, this.vault, this.resolver)

    return new Promise((resolve, reject) => {
      const id = randomUUID()
      const client = new Client()
      const descriptor: SessionDescriptor = {
        id,
        title: host.name,
        protocol: 'ssh',
        hostId: host.id
      }

      client.on('ready', () => {
        client.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
          if (err) {
            client.end()
            reject(err)
            return
          }
          stream.on('data', (data: Buffer) => this.emit('output', id, data.toString('utf-8')))
          stream.stderr.on('data', (data: Buffer) =>
            this.emit('output', id, data.toString('utf-8'))
          )
          stream.on('close', () => client.end())

          this.sessions.set(id, {
            descriptor,
            write: (data) => stream.write(data),
            resize: (c, r) => stream.setWindow(r, c, 0, 0),
            dispose: () => client.end(),
            sshClient: client
          })

          if (host.startupCommand) stream.write(host.startupCommand + '\n')
          resolve(descriptor)
        })
      })

      client.on('error', (err) => {
        // Bağlantı kurulduktan sonra hata: exit bildir; kurulmadan: reject
        const existed = this.sessions.delete(id)
        if (existed) this.emit('exit', id, err.message)
        else reject(err)
      })

      client.on('close', () => {
        if (this.sessions.delete(id)) this.emit('exit', id)
      })

      client.connect(config)
    })
  }

  private createTelnet(host: Host): Promise<SessionDescriptor> {
    return new Promise((resolve, reject) => {
      const id = randomUUID()
      const socket = new Socket()
      const descriptor: SessionDescriptor = {
        id,
        title: host.name,
        protocol: 'telnet',
        hostId: host.id
      }
      let connected = false

      socket.connect(host.port || 23, host.hostname, () => {
        connected = true
        this.sessions.set(id, {
          descriptor,
          write: (data) => socket.write(data),
          resize: () => undefined,
          dispose: () => socket.destroy()
        })
        resolve(descriptor)
      })

      socket.on('data', (data) => this.emit('output', id, data.toString('latin1')))
      socket.on('error', (err) => {
        if (!connected) reject(err)
      })
      socket.on('close', () => {
        if (this.sessions.delete(id)) this.emit('exit', id)
      })
    })
  }

  /** Seri port oturumu: hostname=cihaz yolu (ör. /dev/tty.usbserial), port=baud hızı */
  private createSerial(host: Host): Promise<SessionDescriptor> {
    return new Promise((resolve, reject) => {
      const id = randomUUID()
      const descriptor: SessionDescriptor = {
        id,
        title: host.name,
        protocol: 'serial',
        hostId: host.id
      }
      const serial = new SerialPort(
        { path: host.hostname, baudRate: host.port || 9600 },
        (err) => {
          if (err) {
            reject(err)
            return
          }
          this.sessions.set(id, {
            descriptor,
            write: (data) => serial.write(data),
            resize: () => undefined,
            dispose: () => serial.close(() => undefined)
          })
          resolve(descriptor)
        }
      )
      serial.on('data', (data: Buffer) => this.emit('output', id, data.toString('utf-8')))
      serial.on('close', () => {
        if (this.sessions.delete(id)) this.emit('exit', id)
      })
      serial.on('error', (err) => {
        if (this.sessions.delete(id)) this.emit('exit', id, err.message)
      })
    })
  }

  getSshClient(id: string): Client | undefined {
    return this.sessions.get(id)?.sshClient
  }

  /**
   * Aktif SSH oturumunun bağlantısında ayrı bir exec kanalı açar; interaktif
   * shell'i (kullanıcının terminali) kirletmeden komut çalıştırır. İzleme/araç
   * paneli bunu kullanır. Dönüş: çıkış kodu + stdout/stderr.
   */
  exec(
    id: string,
    command: string
  ): Promise<{ code: number | null; stdout: string; stderr: string }> {
    const client = this.getSshClient(id)
    if (!client) return Promise.reject(new Error('Not an active SSH session'))
    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) {
          reject(err)
          return
        }
        let stdout = ''
        let stderr = ''
        stream.on('data', (d: Buffer) => (stdout += d.toString('utf-8')))
        stream.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf-8')))
        stream.on('close', (code: number | null) => resolve({ code, stdout, stderr }))
      })
    })
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.resize(cols, rows)
  }

  close(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      this.sessions.delete(id)
      session.dispose()
    }
  }

  disposeAll(): void {
    for (const [, session] of this.sessions) session.dispose()
    this.sessions.clear()
    this.bridges.dispose()
  }
}
