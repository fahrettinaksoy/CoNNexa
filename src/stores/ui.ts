import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

/**
 * İkincil yüzeylerin (side sheet) açık/kapalı durumunu tutan tek kaynak.
 *
 * Ayarlar, ekipler, senkron ve tüneller artık ayrı route sayfaları değil;
 * çalışma alanının üzerine sağdan kayan [[side-sheet]] panelleridir. Hangi
 * panelin açık olduğu tek yerden yönetilir ki hem uygulama rayı (App.vue) hem
 * de komut paleti aynı durumu paylaşsın.
 */
export type OverlaySheet = 'tunnels' | 'sync' | 'teams' | 'settings'

export const useUiStore = defineStore('ui', () => {
  /** Şu an açık olan panel (yoksa null). Aynı anda yalnızca biri açıktır. */
  const activeSheet = ref<OverlaySheet | null>(null)

  /** Klavye kısayolları yardım paneli. */
  const helpOpen = ref(false)

  /**
   * Bir panel en az bir kez açıldı mı? İçerik (ve onMounted IPC'leri) yalnızca
   * ilk açılışta monte edilir; sonra durumu korunsun diye monte kalır.
   */
  const mounted = reactive<Record<OverlaySheet, boolean>>({
    tunnels: false,
    sync: false,
    teams: false,
    settings: false
  })

  function openSheet(sheet: OverlaySheet): void {
    activeSheet.value = sheet
    mounted[sheet] = true
  }

  function closeSheet(): void {
    activeSheet.value = null
  }

  function toggleSheet(sheet: OverlaySheet): void {
    if (activeSheet.value === sheet) closeSheet()
    else openSheet(sheet)
  }

  return { activeSheet, helpOpen, mounted, openSheet, closeSheet, toggleSheet }
})
