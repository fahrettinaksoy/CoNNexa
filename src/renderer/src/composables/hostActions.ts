import type { InjectionKey } from 'vue'
import type { Host, Group } from '@shared/types'

/**
 * Özyinelemeli ağaç bileşenlerinde (HostTreeNode) emit zinciri yerine
 * provide/inject ile aksiyon geçirmek için anahtar.
 */
export interface HostActions {
  connect(host: Host): void
  editHost(host: Host): void
  editGroup(group: Group): void
  addGroup(parentId?: string): void
  launchExternalRdp(host: Host): void
}

export const hostActionsKey: InjectionKey<HostActions> = Symbol('hostActions')
