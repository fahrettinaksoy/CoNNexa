import { describe, expect, it } from 'vitest'
import en from './en'
import tr from './tr'

// i18n anahtar paritesi: tr ve en aynı anahtar ağacına sahip olmalı. Eksik/fazla
// çeviri (bir dilde olup diğerinde olmayan anahtar) bu testle yakalanır.
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    return v !== null && typeof v === 'object' && !Array.isArray(v)
      ? keyPaths(v as Record<string, unknown>, path)
      : [path]
  })
}

describe('i18n locale parity', () => {
  it('tr ve en aynı anahtarlara sahip', () => {
    const trKeys = keyPaths(tr as Record<string, unknown>).sort()
    const enKeys = keyPaths(en as Record<string, unknown>).sort()
    expect(trKeys).toEqual(enKeys)
  })
})
