import type { WebSocket } from 'ws'

/**
 * ironrdp-wasm istemcisinden gelen WebSocket bağlantısını RDCleanPath
 * protokolüyle karşılayıp hedef RDP sunucusuna TLS üzerinden köprüler.
 */
export function handleConnection(ws: WebSocket): void
export function parseDestination(destination: string): { host: string; port: number }
