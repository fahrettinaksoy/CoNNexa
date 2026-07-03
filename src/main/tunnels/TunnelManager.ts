import { EventEmitter } from 'events'
import { createServer, Server, Socket } from 'net'
import type { Client } from 'ssh2'
import { connectSsh } from '../sessions/sshConnect'
import type { Host, Tunnel } from '../../shared/types'
import type { VaultStore } from '../vault/VaultStore'
import type { PasswordResolver } from '../secrets/PasswordResolver'

interface ActiveTunnel {
  client: Client
  server?: Server
  close(): void
}

/**
 * SSH port yönlendirme yöneticisi (rapor §7 v1.x — MobaXterm grafiksel tünel deseni).
 * Her tünel kendi ssh2 bağlantısını açar; böylece tünel yaşam döngüsü terminal
 * sekmelerinden bağımsızdır.
 *
 * - local  (-L): yerel port → SSH sunucusu üzerinden hedefe (forwardOut)
 * - remote (-R): uzak port → yerelden hedefe (forwardIn + tcp connection)
 * - dynamic (-D): yerel SOCKS5 proxy (forwardOut)
 *
 * Events: 'state' (tunnelId, running, error?)
 */
export class TunnelManager extends EventEmitter {
  private active = new Map<string, ActiveTunnel>()

  constructor(
    private vault: VaultStore,
    private resolver: PasswordResolver
  ) {
    super()
  }

  isRunning(tunnelId: string): boolean {
    return this.active.has(tunnelId)
  }

  runningIds(): string[] {
    return [...this.active.keys()]
  }

  async start(tunnel: Tunnel, host: Host): Promise<void> {
    if (this.active.has(tunnel.id)) return

    let client: Client
    try {
      client = await connectSsh(host, this.vault, this.resolver)
    } catch (err) {
      this.emit('state', tunnel.id, false, err instanceof Error ? err.message : String(err))
      throw err
    }

    const fail = (message: string): void => {
      this.stop(tunnel.id)
      this.emit('state', tunnel.id, false, message)
    }

    client.on('error', (err) => fail(err.message))
    client.on('close', () => {
      if (this.active.delete(tunnel.id)) this.emit('state', tunnel.id, false)
    })

    try {
      if (tunnel.type === 'local') this.startLocal(tunnel, client)
      else if (tunnel.type === 'dynamic') this.startDynamic(tunnel, client)
      else await this.startRemote(tunnel, client)
    } catch (err) {
      client.end()
      const message = err instanceof Error ? err.message : String(err)
      this.emit('state', tunnel.id, false, message)
      throw err
    }
    this.emit('state', tunnel.id, true)
  }

  private register(tunnel: Tunnel, client: Client, server?: Server): void {
    this.active.set(tunnel.id, {
      client,
      server,
      close: () => {
        server?.close()
        client.end()
      }
    })
  }

  private startLocal(tunnel: Tunnel, client: Client): void {
    const server = createServer((socket) => {
      client.forwardOut(
        socket.remoteAddress ?? '127.0.0.1',
        socket.remotePort ?? 0,
        tunnel.destHost ?? '127.0.0.1',
        tunnel.destPort ?? 0,
        (err, stream) => {
          if (err) {
            socket.destroy()
            return
          }
          socket.pipe(stream).pipe(socket)
        }
      )
    })
    server.on('error', (err) => this.emit('state', tunnel.id, false, err.message))
    server.listen(tunnel.listenPort, tunnel.listenHost || '127.0.0.1')
    this.register(tunnel, client, server)
  }

  private startRemote(tunnel: Tunnel, client: Client): Promise<void> {
    return new Promise((resolve, reject) => {
      client.forwardIn(tunnel.listenHost || '127.0.0.1', tunnel.listenPort, (err) => {
        if (err) {
          reject(err)
          return
        }
        this.register(tunnel, client)
        resolve()
      })
      client.on('tcp connection', (_info, accept) => {
        const stream = accept()
        const socket = new Socket()
        socket.connect(tunnel.destPort ?? 0, tunnel.destHost ?? '127.0.0.1', () => {
          stream.pipe(socket).pipe(stream)
        })
        socket.on('error', () => stream.end())
      })
    })
  }

  /** Minimal SOCKS5 (kimlik doğrulamasız, CONNECT; IPv4 + domain) */
  private startDynamic(tunnel: Tunnel, client: Client): void {
    const server = createServer((socket) => {
      socket.once('data', (greeting: Buffer) => {
        // VER=5; kimlik doğrulama yöntemi kabul et → "no auth"
        if (greeting[0] !== 0x05) {
          socket.destroy()
          return
        }
        socket.write(Buffer.from([0x05, 0x00]))

        socket.once('data', (req: Buffer) => {
          // VER CMD RSV ATYP ...
          if (req[0] !== 0x05 || req[1] !== 0x01) {
            socket.end(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
            return
          }
          const atyp = req[3]
          let host: string
          let offset: number
          if (atyp === 0x01) {
            host = `${req[4]}.${req[5]}.${req[6]}.${req[7]}`
            offset = 8
          } else if (atyp === 0x03) {
            const len = req[4]
            host = req.slice(5, 5 + len).toString('utf-8')
            offset = 5 + len
          } else {
            socket.end(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
            return
          }
          const port = req.readUInt16BE(offset)

          client.forwardOut(socket.remoteAddress ?? '127.0.0.1', socket.remotePort ?? 0, host, port, (err, stream) => {
            if (err) {
              socket.end(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
              return
            }
            // Başarı yanıtı (bağlı adres önemsenmez)
            socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
            socket.pipe(stream).pipe(socket)
          })
        })
      })
      socket.on('error', () => socket.destroy())
    })
    server.on('error', (err) => this.emit('state', tunnel.id, false, err.message))
    server.listen(tunnel.listenPort, tunnel.listenHost || '127.0.0.1')
    this.register(tunnel, client, server)
  }

  stop(tunnelId: string): void {
    const entry = this.active.get(tunnelId)
    if (!entry) return
    this.active.delete(tunnelId)
    entry.close()
    this.emit('state', tunnelId, false)
  }

  disposeAll(): void {
    for (const [, entry] of this.active) entry.close()
    this.active.clear()
  }
}
