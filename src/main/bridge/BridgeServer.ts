import { WebSocketServer } from 'ws'
import { Socket } from 'net'
import { randomBytes } from 'crypto'
import { handleConnection as handleRdpConnection } from './rdp-proxy'

export interface VncBridge {
  wsUrl: string
  close(): void
}

/**
 * Renderer'daki web tabanlı istemcileri (noVNC, ironrdp-wasm) ham TCP
 * konuşan sunuculara bağlayan yerel köprüler. Yalnızca 127.0.0.1'e bind
 * edilir; her VNC köprüsü tek kullanımlık rastgele token yoluyla korunur.
 */
export class BridgeServer {
  private rdpProxy: { wss: WebSocketServer; url: string } | null = null

  /**
   * VNC: oturum başına ham TCP↔WebSocket köprüsü (noVNC websockify eşdeğeri).
   */
  createVncBridge(
    targetHost: string,
    targetPort: number,
    onClosed: () => void
  ): Promise<VncBridge> {
    return new Promise((resolve, reject) => {
      const token = randomBytes(16).toString('hex')
      const wss = new WebSocketServer({ host: '127.0.0.1', port: 0, path: `/${token}` })

      wss.on('connection', (ws) => {
        const socket = new Socket()
        socket.connect(targetPort, targetHost)

        socket.on('data', (data) => {
          if (ws.readyState === ws.OPEN) ws.send(data)
        })
        ws.on('message', (data: Buffer) => {
          if (!socket.destroyed) socket.write(data)
        })

        const teardown = (): void => {
          if (!socket.destroyed) socket.destroy()
          if (ws.readyState === ws.OPEN) ws.close()
          onClosed()
        }
        socket.on('close', teardown)
        socket.on('error', teardown)
        ws.on('close', teardown)
        ws.on('error', teardown)
      })

      wss.on('error', reject)
      wss.on('listening', () => {
        const address = wss.address()
        if (typeof address === 'string' || !address) {
          reject(new Error('VNC bridge failed to bind'))
          return
        }
        resolve({
          wsUrl: `ws://127.0.0.1:${address.port}/${token}`,
          close: () => {
            for (const client of wss.clients) client.terminate()
            wss.close()
          }
        })
      })
    })
  }

  /**
   * RDP: tüm oturumların paylaştığı RDCleanPath proxy'si.
   * Hedef adres istemcinin RDCleanPath isteğinin içinde gelir.
   */
  ensureRdpProxy(): Promise<string> {
    if (this.rdpProxy) return Promise.resolve(this.rdpProxy.url)
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 })
      wss.on('connection', (ws) => handleRdpConnection(ws))
      wss.on('error', reject)
      wss.on('listening', () => {
        const address = wss.address()
        if (typeof address === 'string' || !address) {
          reject(new Error('RDP proxy failed to bind'))
          return
        }
        const url = `ws://127.0.0.1:${address.port}`
        this.rdpProxy = { wss, url }
        resolve(url)
      })
    })
  }

  dispose(): void {
    if (this.rdpProxy) {
      for (const client of this.rdpProxy.wss.clients) client.terminate()
      this.rdpProxy.wss.close()
      this.rdpProxy = null
    }
  }
}
