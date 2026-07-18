/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// noVNC tip tanımı içermez
declare module '@novnc/novnc' {
  // eslint-disable-next-line ts/no-explicit-any
  const RFB: any
  export default RFB
}
