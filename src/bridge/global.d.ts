import type { ConnexaApi } from './connexa'

declare global {
  interface Window {
    connexa: ConnexaApi
  }
}

export {}
