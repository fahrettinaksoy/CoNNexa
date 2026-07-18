//! `src/shared/types.ts`'in Rust/serde karşılığı. Frontend camelCase JSON
//! gönderir; tüm struct'lar `rename_all = "camelCase"` ile eşlenir.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    Ssh,
    Telnet,
    Local,
    Rdp,
    Vnc,
    Serial,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuthType {
    Password,
    Key,
    Agent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SecretManager {
    Bitwarden,
    Onepassword,
    Command,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretRef {
    pub manager: SecretManager,
    #[serde(rename = "ref")]
    pub reference: String,
}

/// Diskte saklanan Identity (sırlar şifreli).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    pub id: String,
    pub name: String,
    pub username: String,
    pub auth_type: AuthType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password_enc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub private_key_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passphrase_enc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secret_ref: Option<SecretRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_vault_id: Option<String>,
}

/// Arayüze gönderilen sırsız Identity görünümü.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityPublic {
    pub id: String,
    pub name: String,
    pub username: String,
    pub auth_type: AuthType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub private_key_path: Option<String>,
    pub has_password: bool,
    pub has_passphrase: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secret_ref: Option<SecretRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_vault_id: Option<String>,
}

impl Identity {
    pub fn to_public(&self) -> IdentityPublic {
        IdentityPublic {
            id: self.id.clone(),
            name: self.name.clone(),
            username: self.username.clone(),
            auth_type: self.auth_type,
            private_key_path: self.private_key_path.clone(),
            has_password: self.password_enc.is_some(),
            has_passphrase: self.passphrase_enc.is_some(),
            secret_ref: self.secret_ref.clone(),
            team_vault_id: self.team_vault_id.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identity_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_vault_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Host {
    pub id: String,
    pub name: String,
    pub protocol: Protocol,
    pub hostname: String,
    pub port: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identity_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub startup_command: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_vault_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snippet {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_vault_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TunnelType {
    Local,
    Remote,
    Dynamic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tunnel {
    pub id: String,
    pub name: String,
    pub host_id: String,
    #[serde(rename = "type")]
    pub tunnel_type: TunnelType,
    pub listen_host: String,
    pub listen_port: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dest_host: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dest_port: Option<u16>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultData {
    pub hosts: Vec<Host>,
    pub identities: Vec<IdentityPublic>,
    pub groups: Vec<Group>,
    pub snippets: Vec<Snippet>,
    pub tunnels: Vec<Tunnel>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VncInfo {
    pub ws_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RdpInfo {
    pub proxy_url: String,
    pub destination: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDescriptor {
    pub id: String,
    pub title: String,
    pub protocol: Protocol,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vnc: Option<VncInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rdp: Option<RdpInfo>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionRequest {
    #[serde(default)]
    pub host_id: Option<String>,
    #[serde(default)]
    pub local: Option<bool>,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session: Option<SessionDescriptor>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SftpEntryType {
    File,
    Dir,
    Link,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub entry_type: SftpEntryType,
    pub size: u64,
    pub mtime: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpResult<T: Serialize> {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

impl<T: Serialize> SftpResult<T> {
    pub fn ok(data: T) -> Self {
        Self { ok: true, error: None, data: Some(data) }
    }
    pub fn err(msg: impl Into<String>) -> Self {
        Self { ok: false, error: Some(msg.into()), data: None }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub canceled: Option<bool>,
    pub hosts: u32,
    pub identities: u32,
    pub groups: u32,
    pub skipped: u32,
}

impl ImportSummary {
    pub fn canceled() -> Self {
        Self { ok: false, error: None, canceled: Some(true), hosts: 0, identities: 0, groups: 0, skipped: 0 }
    }
    pub fn error(msg: impl Into<String>) -> Self {
        Self { ok: false, error: Some(msg.into()), canceled: None, hosts: 0, identities: 0, groups: 0, skipped: 0 }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskUsage {
    pub mount: String,
    pub size_bytes: u64,
    pub used_bytes: u64,
    pub use_percent: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub cpu: f64,
    pub mem: f64,
    pub command: String,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostMetrics {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub load_avg: Option<[f64; 3]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mem_total_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mem_used_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disks: Option<Vec<DiskUsage>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processes: Option<Vec<ProcessInfo>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlarmNotifyType {
    Ntfy,
    Webhook,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlarmConfig {
    pub enabled: bool,
    pub cpu_percent: f64,
    pub mem_percent: f64,
    pub disk_percent: f64,
    pub notify_type: AlarmNotifyType,
    pub notify_target: String,
}

impl Default for AlarmConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            cpu_percent: 90.0,
            mem_percent: 90.0,
            disk_percent: 90.0,
            notify_type: AlarmNotifyType::Ntfy,
            notify_target: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    pub snippet_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub plugins: Vec<PluginInfo>,
    pub snippets: Vec<Snippet>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigPublic {
    pub model: String,
    pub has_api_key: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigInput {
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncBackend {
    None,
    Gist,
    Webdav,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfigPublic {
    pub backend: SyncBackend,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gist_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webdav_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webdav_username: Option<String>,
    pub has_gist_token: bool,
    pub has_webdav_password: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfigInput {
    pub backend: SyncBackend,
    #[serde(default)]
    pub gist_token: Option<String>,
    #[serde(default)]
    pub gist_id: Option<String>,
    #[serde(default)]
    pub webdav_url: Option<String>,
    #[serde(default)]
    pub webdav_username: Option<String>,
    #[serde(default)]
    pub webdav_password: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gist_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<ImportSummary>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TeamBackend {
    Gist,
    Webdav,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamVaultPublic {
    pub id: String,
    pub name: String,
    pub backend: TeamBackend,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gist_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webdav_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webdav_username: Option<String>,
    pub has_gist_token: bool,
    pub has_webdav_password: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamVaultInput {
    #[serde(default)]
    pub id: Option<String>,
    pub name: String,
    pub backend: TeamBackend,
    #[serde(default)]
    pub gist_token: Option<String>,
    #[serde(default)]
    pub gist_id: Option<String>,
    #[serde(default)]
    pub webdav_url: Option<String>,
    #[serde(default)]
    pub webdav_username: Option<String>,
    #[serde(default)]
    pub webdav_password: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamVaultResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gist_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<ImportSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SimpleResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl SimpleResult {
    pub fn ok() -> Self {
        Self { ok: true, error: None }
    }
    pub fn err(msg: impl Into<String>) -> Self {
        Self { ok: false, error: Some(msg.into()) }
    }
    pub fn from(res: Result<(), String>) -> Self {
        match res {
            Ok(()) => Self::ok(),
            Err(e) => Self::err(e),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStartResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStopResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentitySaveRequest {
    #[serde(default)]
    pub id: Option<String>,
    pub name: String,
    pub username: String,
    pub auth_type: AuthType,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub private_key_path: Option<String>,
    #[serde(default)]
    pub passphrase: Option<String>,
    // null = temizle, alan yok = koru, obj = ayarla. Bu üçlü ayrımı yakalamak
    // için çift Option: dış = alan var mı, iç = null mı.
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub secret_ref: Option<Option<SecretRef>>,
}

/// `Option<Option<T>>`: alan yoksa `None`, `null` ise `Some(None)`, değer varsa
/// `Some(Some(v))`. JS `null` gönderdiğinde "temizle" niyetini korumak için.
fn deserialize_optional_field<'de, D>(
    deserializer: D,
) -> Result<Option<Option<SecretRef>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}
