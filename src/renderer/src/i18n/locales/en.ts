export default {
  app: {
    name: 'Connexa'
  },
  nav: {
    workspace: 'Workspace',
    tunnels: 'Tunnels',
    sync: 'Sync',
    teams: 'Teams',
    settings: 'Settings'
  },
  hosts: {
    title: 'Hosts',
    add: 'Add Host',
    edit: 'Edit Host',
    delete: 'Delete',
    connect: 'Connect',
    empty: 'No hosts yet. Click "Add Host" to get started.',
    name: 'Name',
    protocol: 'Protocol',
    hostname: 'Hostname',
    port: 'Port',
    devicePath: 'Device path',
    baudRate: 'Baud rate',
    identity: 'Identity',
    group: 'Group',
    tags: 'Tags',
    startupCommand: 'Startup command (optional)',
    noGroup: 'Ungrouped',
    search: 'Search hosts…',
    identityInheritHint: "If empty, the group's default identity is used",
    externalRdp: 'Open with external RDP client',
    externalRdpLaunched: 'External RDP client launched.'
  },
  groups: {
    add: 'Add Group',
    addSub: 'Add subgroup',
    edit: 'Edit Group',
    name: 'Group name',
    parent: 'Parent group',
    defaultIdentity: 'Default identity',
    defaultIdentityHint: 'Hosts in this group without an identity inherit this one',
    hasDefaultIdentity: 'Default identity: {name}'
  },
  identities: {
    title: 'Identities',
    add: 'Add Identity',
    edit: 'Edit Identity',
    name: 'Identity name',
    username: 'Username',
    authType: 'Authentication',
    password: 'Password',
    passwordKeep: 'Password (leave empty to keep current)',
    privateKeyPath: 'Private key file path',
    passphrase: 'Key passphrase',
    authTypes: {
      password: 'Password',
      key: 'Private Key',
      agent: 'SSH Agent'
    },
    passwordSource: 'Password source',
    passwordSources: {
      stored: 'Store in vault',
      bitwarden: 'Bitwarden CLI (bw)',
      onepassword: '1Password CLI (op)',
      command: 'Custom command (KeePassXC etc.)'
    },
    secretRef: 'Secret reference / command',
    empty: 'No identities yet.',
    secure: 'Secrets are encrypted with the OS keychain.'
  },
  sessions: {
    localTerminal: 'Local Terminal',
    newLocal: 'New local terminal',
    close: 'Close session',
    splitVertical: 'Split vertically (side by side)',
    splitHorizontal: 'Split horizontally (stacked)',
    connecting: 'Connecting…',
    connectionFailed: 'Connection failed',
    disconnected: 'Disconnected',
    welcomeTitle: 'Welcome to Connexa',
    welcomeText: 'Connect to a host from the list on the left, or open a new local terminal.'
  },
  snippets: {
    title: 'Snippets',
    add: 'Add Snippet',
    edit: 'Edit Snippet',
    name: 'Name',
    command: 'Command',
    run: 'Run',
    empty: 'No snippets yet.',
    noTarget: 'No open terminal session to run in.',
    ranBroadcast: 'Ran in {count} sessions'
  },
  broadcast: {
    toggle: 'Broadcast mode (type to all terminals)',
    active: 'Broadcast on — input sent to {count} terminals'
  },
  tunnels: {
    title: 'SSH Tunnels',
    add: 'Add Tunnel',
    edit: 'Edit Tunnel',
    name: 'Name',
    type: 'Type',
    host: 'SSH Host',
    route: 'Route',
    listenHost: 'Listen host',
    listenPort: 'Listen port',
    destHost: 'Destination host',
    destPort: 'Destination port',
    start: 'Start',
    stop: 'Stop',
    empty: 'No tunnels defined yet.',
    types: {
      local: 'Local (-L)',
      remote: 'Remote (-R)',
      dynamic: 'Dynamic / SOCKS (-D)'
    },
    hints: {
      local: 'Forwards a local port through the SSH host to a destination (-L).',
      remote: 'Forwards a port on the SSH host to a local destination (-R).',
      dynamic: 'Opens a local SOCKS5 proxy; destination is chosen per connection (-D).'
    }
  },
  teams: {
    title: 'Team Vaults',
    description:
      'Share hosts, groups and snippets with your team, encrypted. Personal passwords are NEVER shared — only the username, key path and password-manager reference are sent; each member fills in their own secrets locally. Content is encrypted on-device with the team passphrase.',
    add: 'Add Team Vault',
    edit: 'Edit Team Vault',
    empty: 'No team vaults yet.',
    name: 'Team name',
    backend: 'Store type',
    members: '{count} shared items',
    passphrase: 'Team passphrase',
    push: 'Push',
    pull: 'Pull',
    pushDone: 'Pushed to team “{name}”.',
    pullDone: 'Pulled a team vault with {hosts} hosts.',
    gistToken: 'GitHub token (gist scope)',
    gistId: 'Gist ID (give it to teammates to share)',
    webdavUrl: 'WebDAV URL',
    webdavUsername: 'Username',
    webdavPassword: 'Password',
    zeroKnowledge: 'End-to-end encryption: scrypt + AES-256-GCM. The team passphrase stays on your device.',
    assign: 'Assign to team',
    unassign: 'Remove from team'
  },
  sync: {
    title: 'Sync',
    description:
      'Back up your vault to a remote store encrypted, and move it across devices. Data is encrypted with your sync passphrase before leaving your device — the remote only ever sees the encrypted blob.',
    backend: 'Store type',
    backends: {
      none: 'Off',
      gist: 'GitHub Gist',
      webdav: 'WebDAV'
    },
    gistToken: 'GitHub personal access token (gist scope)',
    gistId: 'Gist ID (auto-created on first push)',
    gistIdHint: 'Leave empty to create a new secret Gist on first push.',
    webdavUrl: 'WebDAV URL (folder or file)',
    webdavUsername: 'Username',
    webdavPassword: 'Password',
    passphrase: 'Sync passphrase',
    passphraseHint:
      'This passphrase encrypts the vault. If you lose it you cannot access the backup — it is never stored remotely.',
    push: 'Push (back up)',
    pull: 'Pull (restore)',
    pushDone: 'Vault encrypted and pushed.',
    pullDone: 'Restored a backup with {hosts} hosts.',
    configSaved: 'Sync settings saved.',
    zeroKnowledge: 'End-to-end encryption: scrypt + AES-256-GCM. The passphrase stays on your device.'
  },
  palette: {
    open: 'Command palette (Cmd/Ctrl+K)',
    placeholder: 'Search hosts, snippets or actions…',
    runSnippet: 'Run snippet',
    action: 'Action',
    noResults: 'No results',
    navigate: 'navigate',
    select: 'select',
    close: 'close'
  },
  alarm: {
    title: 'Threshold Alarms',
    description:
      'Open SSH sessions are monitored in the background; when a threshold is exceeded a notification is sent via ntfy or webhook.',
    enabled: 'Enable alarms',
    cpu: 'CPU threshold',
    mem: 'Memory threshold',
    disk: 'Disk threshold',
    notifyType: 'Notification type',
    notifyTarget: 'Notification target',
    test: 'Send test notification',
    saved: 'Alarm settings saved.',
    testSent: 'Test notification sent.'
  },
  cloud: {
    title: 'Cloud Inventory',
    description:
      'Automatically import servers from your cloud provider as SSH hosts. The API token is used only for the request and never stored.',
    provider: 'Provider',
    token: 'API token',
    identity: 'Identity to assign (optional)',
    identityHint: 'This identity is assigned to all imported servers',
    import: 'Import servers'
  },
  plugins: {
    title: 'Plugins',
    description:
      'Add snippet packs. Plugins do not run code; they only contribute command snippets via a plugin.json manifest. Plugin snippets appear in the command palette.',
    install: 'Install plugin',
    openFolder: 'Open plugins folder',
    empty: 'No plugins installed yet.',
    snippetCount: '{count} snippets'
  },
  ai: {
    title: 'AI Command Assistant',
    settings: 'AI Assistant',
    description:
      'Generate commands from natural language with your own Anthropic (Claude) API key. The key is stored encrypted on your device; requests go only to the Anthropic API.',
    model: 'Model',
    apiKey: 'Anthropic API key',
    prompt: 'What do you want to do?',
    placeholder: 'e.g. delete .log files older than 7 days in this directory',
    ask: 'Ask',
    insert: 'Insert command into terminal',
    thinking: 'Thinking…',
    saved: 'AI settings saved.'
  },
  recording: {
    toggle: 'Start/stop session recording (.cast)',
    folder: 'Open recordings folder',
    openFolder: 'Open session recordings folder'
  },
  monitor: {
    toggle: 'Toggle server monitor panel',
    title: 'Server Monitor',
    uptime: 'Uptime',
    cpu: 'CPU',
    cores: 'cores',
    memory: 'Memory',
    disks: 'Disks',
    topProcesses: 'Top processes',
    command: 'Command',
    unavailable: 'Could not fetch metrics (only Linux SSH sessions are supported).'
  },
  sftp: {
    toggle: 'Toggle SFTP panel',
    up: 'Parent directory',
    refresh: 'Refresh',
    newFolder: 'New folder',
    folderName: 'Folder name',
    upload: 'Upload files',
    download: 'Download',
    rename: 'Rename',
    emptyDir: 'This directory is empty.',
    downloaded: 'Downloaded: {path}',
    uploaded: 'Uploaded {count} file(s)'
  },
  importer: {
    title: 'Import',
    description: 'Bring your connections from existing tools. Existing entries are skipped.',
    sshConfig: '~/.ssh/config',
    mremoteng: 'mRemoteNG (confCons.xml)',
    termius: 'Termius (JSON)',
    summary:
      'Imported {hosts} hosts, {identities} identities, {groups} groups; skipped {skipped} entries.',
    passwordNote:
      'Note: mRemoteNG passwords are encrypted with a master password and cannot be imported; update passwords in Connexa after importing identities.'
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    terminalTheme: 'Terminal color scheme'
  },
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirmDelete: 'Are you sure you want to delete this?',
    required: 'This field is required'
  }
}
