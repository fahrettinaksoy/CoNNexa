import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TeamVaultPublic } from '@shared/types'

export const useTeamsStore = defineStore('teams', () => {
  const teams = ref<TeamVaultPublic[]>([])
  let loaded = false

  async function load(force = false): Promise<void> {
    if (loaded && !force) return
    loaded = true
    teams.value = await window.connexa.team.list()
  }

  function teamName(id?: string): string {
    if (!id) return ''
    return teams.value.find((t) => t.id === id)?.name ?? ''
  }

  return { teams, load, teamName }
})
