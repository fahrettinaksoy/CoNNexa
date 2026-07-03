import type { ConnexaApi } from './index'

declare global {
  interface Window {
    connexa: ConnexaApi
  }
}

export {}
