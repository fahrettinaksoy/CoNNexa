<script setup lang="ts">
/**
 * LtrRegion — teknik/kod içeriğini her zaman soldan-sağa (LTR) yalıtan bölge.
 *
 * Connexa RTL dillere hazırdır (bkz. vuetify `rtl: { ar, fa, he }` + `<html dir>`
 * senkronu, [[use-app-locale]]). Ancak arayüz RTL bir dile çevrilse bile
 * **teknik içerik LTR kalmalıdır**: terminal çıktısı ve komutlar, dosya yolları,
 * `kullanıcı@host:port` adresleri, IP'ler, tünel rotaları. Aksi halde
 * `/var/log/syslog` veya `ls -la | grep foo` gibi diziler ters/karışık görünür.
 *
 * Bu, Vuetify'ın **VLocaleProvider** bileşenini `:rtl="false"` ile kullanır;
 * bileşen `display: contents` ile render edildiğinden flexbox/grid yerleşimini
 * hiç etkilemez — yalnızca `direction`'ı alt ağaca miras verir.
 *
 * @see https://vuetifyjs.com/en/components/locale-providers/
 */
</script>

<template>
  <v-locale-provider :rtl="false">
    <slot />
  </v-locale-provider>
</template>
