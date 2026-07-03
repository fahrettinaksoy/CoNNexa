export default {
  app: {
    name: 'Connexa'
  },
  nav: {
    workspace: 'Çalışma Alanı',
    tunnels: 'Tüneller',
    sync: 'Senkronizasyon',
    teams: 'Ekipler',
    settings: 'Ayarlar'
  },
  hosts: {
    title: 'Sunucular',
    add: 'Sunucu Ekle',
    edit: 'Sunucuyu Düzenle',
    delete: 'Sil',
    connect: 'Bağlan',
    empty: 'Henüz sunucu eklenmedi. Başlamak için "Sunucu Ekle"ye tıklayın.',
    name: 'Ad',
    protocol: 'Protokol',
    hostname: 'Adres',
    port: 'Port',
    devicePath: 'Cihaz yolu',
    baudRate: 'Baud hızı',
    identity: 'Kimlik',
    group: 'Grup',
    tags: 'Etiketler',
    startupCommand: 'Başlangıç komutu (opsiyonel)',
    noGroup: 'Grupsuz',
    search: 'Sunucu ara…',
    identityInheritHint: 'Boş bırakılırsa grubun varsayılan kimliği kullanılır',
    externalRdp: 'Harici RDP istemcisiyle aç',
    externalRdpLaunched: 'Harici RDP istemcisi başlatıldı.'
  },
  groups: {
    add: 'Grup Ekle',
    addSub: 'Alt grup ekle',
    edit: 'Grubu Düzenle',
    name: 'Grup adı',
    parent: 'Üst grup',
    defaultIdentity: 'Varsayılan kimlik',
    defaultIdentityHint: 'Bu gruptaki kimliksiz sunucular bu kimliği devralır',
    hasDefaultIdentity: 'Varsayılan kimlik: {name}'
  },
  identities: {
    title: 'Kimlikler',
    add: 'Kimlik Ekle',
    edit: 'Kimliği Düzenle',
    name: 'Kimlik adı',
    username: 'Kullanıcı adı',
    authType: 'Kimlik doğrulama',
    password: 'Parola',
    passwordKeep: 'Parola (boş bırakılırsa mevcut korunur)',
    privateKeyPath: 'Özel anahtar dosyası yolu',
    passphrase: 'Anahtar parolası (passphrase)',
    authTypes: {
      password: 'Parola',
      key: 'Özel Anahtar',
      agent: 'SSH Agent'
    },
    passwordSource: 'Parola kaynağı',
    passwordSources: {
      stored: 'Vault’ta sakla',
      bitwarden: 'Bitwarden CLI (bw)',
      onepassword: '1Password CLI (op)',
      command: 'Özel komut (KeePassXC vb.)'
    },
    secretRef: 'Sır referansı / komut',
    empty: 'Henüz kimlik eklenmedi.',
    secure: 'Sırlar işletim sistemi anahtar zincirinde şifrelenir.'
  },
  sessions: {
    localTerminal: 'Yerel Terminal',
    newLocal: 'Yeni yerel terminal',
    close: 'Oturumu kapat',
    splitVertical: 'Dikey böl (yan yana)',
    splitHorizontal: 'Yatay böl (alt alta)',
    connecting: 'Bağlanıyor…',
    connectionFailed: 'Bağlantı başarısız',
    disconnected: 'Bağlantı kapandı',
    welcomeTitle: 'Connexa’ya hoş geldiniz',
    welcomeText:
      'Soldaki listeden bir sunucuya bağlanın veya yeni bir yerel terminal açın.'
  },
  snippets: {
    title: 'Komut Parçacıkları',
    add: 'Parçacık Ekle',
    edit: 'Parçacığı Düzenle',
    name: 'Ad',
    command: 'Komut',
    run: 'Çalıştır',
    empty: 'Henüz komut parçacığı yok.',
    noTarget: 'Çalıştırmak için açık bir terminal oturumu yok.',
    ranBroadcast: '{count} oturumda çalıştırıldı'
  },
  broadcast: {
    toggle: 'Yayın modu (tüm terminallere yaz)',
    active: 'Yayın modu açık — girdi {count} terminale gönderiliyor'
  },
  tunnels: {
    title: 'SSH Tünelleri',
    add: 'Tünel Ekle',
    edit: 'Tüneli Düzenle',
    name: 'Ad',
    type: 'Tür',
    host: 'SSH Sunucusu',
    route: 'Yönlendirme',
    listenHost: 'Dinlenen adres',
    listenPort: 'Dinlenen port',
    destHost: 'Hedef adres',
    destPort: 'Hedef port',
    start: 'Başlat',
    stop: 'Durdur',
    empty: 'Henüz tünel tanımlanmadı.',
    types: {
      local: 'Yerel (-L)',
      remote: 'Uzak (-R)',
      dynamic: 'Dinamik / SOCKS (-D)'
    },
    hints: {
      local: 'Yerel portu SSH sunucusu üzerinden hedefe yönlendirir (-L).',
      remote: 'SSH sunucusundaki portu yerel hedefe yönlendirir (-R).',
      dynamic: 'Yerel bir SOCKS5 proxy açar; hedef her bağlantıda belirlenir (-D).'
    }
  },
  teams: {
    title: 'Ekip Vault’ları',
    description:
      'Sunucu, grup ve komut parçacıklarını ekibinizle şifreli olarak paylaşın. Kişisel parolalar ASLA paylaşılmaz — yalnızca kullanıcı adı, anahtar yolu ve parola-yöneticisi referansı gider; her üye kendi sırlarını yerelde girer. İçerik ekip parolasıyla cihazda şifrelenir.',
    add: 'Ekip Vault’u Ekle',
    edit: 'Ekip Vault’unu Düzenle',
    empty: 'Henüz ekip vault’u yok.',
    name: 'Ekip adı',
    backend: 'Depo türü',
    members: '{count} paylaşılan öğe',
    passphrase: 'Ekip parolası',
    push: 'Gönder',
    pull: 'Getir',
    pushDone: '“{name}” ekibine gönderildi.',
    pullDone: '{hosts} sunucu içeren ekip vault’u getirildi.',
    gistToken: 'GitHub jetonu (gist yetkili)',
    gistId: 'Gist kimliği (paylaşım için ekip üyelerine verin)',
    webdavUrl: 'WebDAV adresi',
    webdavUsername: 'Kullanıcı adı',
    webdavPassword: 'Parola',
    zeroKnowledge: 'Uçtan uca şifreleme: scrypt + AES-256-GCM. Ekip parolası cihazınızda kalır.',
    assign: 'Ekibe ata',
    unassign: 'Ekipten çıkar'
  },
  sync: {
    title: 'Senkronizasyon',
    description:
      'Vault’unuzu şifreli olarak bir uzak depoya yedekleyin ve cihazlar arasında taşıyın. Veri cihazınızdan çıkmadan önce sync parolanızla şifrelenir — uzak depo yalnızca şifreli blob’u görür.',
    backend: 'Depo türü',
    backends: {
      none: 'Kapalı',
      gist: 'GitHub Gist',
      webdav: 'WebDAV'
    },
    gistToken: 'GitHub kişisel erişim jetonu (gist yetkili)',
    gistId: 'Gist kimliği (ilk push’ta otomatik oluşur)',
    gistIdHint: 'Boş bırakılırsa ilk gönderimde yeni bir gizli Gist oluşturulur.',
    webdavUrl: 'WebDAV adresi (klasör veya dosya)',
    webdavUsername: 'Kullanıcı adı',
    webdavPassword: 'Parola',
    passphrase: 'Sync parolası',
    passphraseHint:
      'Bu parola vault’u şifreler. Kaybederseniz yedeğe erişemezsiniz — uzak depoda saklanmaz.',
    push: 'Gönder (yedekle)',
    pull: 'Getir (geri yükle)',
    pushDone: 'Vault şifrelenip gönderildi.',
    pullDone: '{hosts} sunucu içeren yedek geri yüklendi.',
    configSaved: 'Sync ayarları kaydedildi.',
    zeroKnowledge: 'Uçtan uca şifreleme: scrypt + AES-256-GCM. Parola cihazınızda kalır.'
  },
  palette: {
    open: 'Komut paleti (Cmd/Ctrl+K)',
    placeholder: 'Sunucu, parçacık veya eylem ara…',
    runSnippet: 'Parçacığı çalıştır',
    action: 'Eylem',
    noResults: 'Sonuç yok',
    navigate: 'gezin',
    select: 'seç',
    close: 'kapat'
  },
  alarm: {
    title: 'Eşik Alarmları',
    description:
      'Açık SSH oturumları arka planda izlenir; bir eşik aşıldığında ntfy veya webhook ile bildirim gönderilir.',
    enabled: 'Alarmları etkinleştir',
    cpu: 'CPU eşiği',
    mem: 'Bellek eşiği',
    disk: 'Disk eşiği',
    notifyType: 'Bildirim türü',
    notifyTarget: 'Bildirim hedefi',
    test: 'Test bildirimi gönder',
    saved: 'Alarm ayarları kaydedildi.',
    testSent: 'Test bildirimi gönderildi.'
  },
  cloud: {
    title: 'Bulut Envanteri',
    description:
      'Bulut sağlayıcınızdaki sunucuları otomatik olarak SSH hostu olarak içe aktarın. API jetonu yalnızca istek anında kullanılır, saklanmaz.',
    provider: 'Sağlayıcı',
    token: 'API jetonu',
    identity: 'Atanacak kimlik (opsiyonel)',
    identityHint: 'İçe aktarılan tüm sunuculara bu kimlik atanır',
    import: 'Sunucuları içe aktar'
  },
  plugins: {
    title: 'Eklentiler',
    description:
      'Snippet paketleri ekleyin. Eklentiler kod çalıştırmaz; yalnızca bir plugin.json ile komut parçacıkları katar. Eklenti snippet’leri komut paletinde görünür.',
    install: 'Eklenti yükle',
    openFolder: 'Eklenti klasörünü aç',
    empty: 'Henüz eklenti yüklenmedi.',
    snippetCount: '{count} snippet'
  },
  ai: {
    title: 'AI Komut Asistanı',
    settings: 'AI Asistan',
    description:
      'Kendi Anthropic (Claude) API anahtarınızla doğal dilden komut üretin. Anahtar cihazınızda şifreli saklanır; istekler yalnızca Anthropic API’sine gider.',
    model: 'Model',
    apiKey: 'Anthropic API anahtarı',
    prompt: 'Ne yapmak istiyorsun?',
    placeholder: 'ör. bu dizindeki 7 günden eski .log dosyalarını sil',
    ask: 'Sor',
    insert: 'Komutu terminale ekle',
    thinking: 'Düşünüyor…',
    saved: 'AI ayarları kaydedildi.'
  },
  recording: {
    toggle: 'Oturum kaydını başlat/durdur (.cast)',
    folder: 'Kayıt klasörünü aç',
    openFolder: 'Oturum kayıtları klasörünü aç'
  },
  monitor: {
    toggle: 'Sunucu izleme panelini aç/kapat',
    title: 'Sunucu İzleme',
    uptime: 'Çalışma süresi',
    cpu: 'CPU',
    cores: 'çekirdek',
    memory: 'Bellek',
    disks: 'Diskler',
    topProcesses: 'En yoğun süreçler',
    command: 'Komut',
    unavailable: 'Metrikler alınamadı (yalnızca Linux SSH oturumları desteklenir).'
  },
  sftp: {
    toggle: 'SFTP panelini aç/kapat',
    up: 'Üst dizin',
    refresh: 'Yenile',
    newFolder: 'Yeni klasör',
    folderName: 'Klasör adı',
    upload: 'Dosya yükle',
    download: 'İndir',
    rename: 'Yeniden adlandır',
    emptyDir: 'Bu dizin boş.',
    downloaded: 'İndirildi: {path}',
    uploaded: '{count} dosya yüklendi'
  },
  importer: {
    title: 'İçe Aktar',
    description:
      'Mevcut araçlarınızdaki bağlantıları Connexa’ya taşıyın. Var olan kayıtlar atlanır.',
    sshConfig: '~/.ssh/config',
    mremoteng: 'mRemoteNG (confCons.xml)',
    termius: 'Termius (JSON)',
    summary:
      '{hosts} sunucu, {identities} kimlik, {groups} grup içe aktarıldı; {skipped} kayıt atlandı.',
    passwordNote:
      'Not: mRemoteNG parolaları master parola ile şifreli olduğundan aktarılmaz; kimlikleri içe aktardıktan sonra parolaları Connexa’da güncelleyin.'
  },
  settings: {
    title: 'Ayarlar',
    language: 'Dil',
    theme: 'Tema',
    themeDark: 'Koyu',
    themeLight: 'Açık',
    terminalTheme: 'Terminal renk şeması'
  },
  common: {
    save: 'Kaydet',
    cancel: 'İptal',
    delete: 'Sil',
    confirmDelete: 'Silmek istediğinize emin misiniz?',
    required: 'Bu alan zorunludur'
  }
}
