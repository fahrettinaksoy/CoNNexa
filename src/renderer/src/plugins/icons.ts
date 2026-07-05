import type { Protocol } from '@shared/types'

/**
 * Connexa semantik ikon kayıt defteri — ikonların tek gerçek kaynağı.
 *
 * Vuetify'ın **icon-fonts** özelliği, ham `mdi-*` sınıflarını doğrudan
 * bileşenlere yazmak yerine _semantik alias_'lar üzerinden çözmemizi sağlar:
 * bir alias `createVuetify({ icons: { aliases } })` içine kaydedilir ve şablonda
 * `$aliasAdı` ile referanslanır (ör. `<v-icon icon="$protocolSsh" />`). Vuetify
 * bunu aktif ikon setinin (mdi font) sınıfına çözer.
 *
 * Neden: protokol → ikon eşlemesi eskiden üç ayrı bileşende (HostListItem,
 * CommandPalette, WorkspaceView) kopyalanıyordu. Bir ikonu değiştirmek üç dosya
 * düzenlemek demekti. Artık burada tanımlanır; her yer alias'ı tüketir.
 *
 * @see https://vuetifyjs.com/en/features/icon-fonts/
 */

/** Protokol → mdi ikon. Alias'lar bundan türetilir; tema/marka değişimi tek yerden. */
const PROTOCOL_ICON: Record<Protocol, string> = {
  ssh: 'mdi-console-network',
  telnet: 'mdi-lan-connect',
  local: 'mdi-console',
  rdp: 'mdi-monitor',
  vnc: 'mdi-monitor-eye',
  serial: 'mdi-serial-port'
}

/**
 * Vuetify `icons.aliases` içine karıştırılacak uygulama alias haritası.
 * Anahtarlar `$` olmadan yazılır; şablonda `$` önekiyle referanslanır.
 * Yeni semantik ikonlar (host, group, identity, …) buraya eklenip her yerde
 * `$ad` ile kullanılabilir.
 */
export const appAliases: Record<string, string> = {
  // Protokoller
  protocolSsh: PROTOCOL_ICON.ssh,
  protocolTelnet: PROTOCOL_ICON.telnet,
  protocolLocal: PROTOCOL_ICON.local,
  protocolRdp: PROTOCOL_ICON.rdp,
  protocolVnc: PROTOCOL_ICON.vnc,
  protocolSerial: PROTOCOL_ICON.serial,
  // Bilinmeyen protokol / genel sunucu için güvenli varsayılan
  host: 'mdi-server'
}

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)

/**
 * Bir protokol için Vuetify ikon alias referansını döndürür.
 * Bilinmeyen/boş protokolde `$host` (sunucu) varsayılanına düşer.
 *
 * @example protocolIcon('ssh')  // → '$protocolSsh'  → <i class="mdi mdi-console-network">
 */
export function protocolIcon(protocol?: Protocol | string): string {
  const key = protocol ? `protocol${capitalize(protocol)}` : ''
  return key in appAliases ? `$${key}` : '$host'
}
