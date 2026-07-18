//! Şifreli yerel veri deposu (`vault.json`).
//!
//! - Tek JSON dosyası, pretty (2-space). Eksik koleksiyonlar `?? []` gibi
//!   tolere edilir. Parse hatasında dosya `vault.json.corrupt`'a kopyalanır.
//! - Sırlar (identity parola/passphrase, sync/team token/parola, ai apiKey)
//!   at-rest [`FieldCipher`] ile şifrelenir; diğer her şey düz metin.

use crate::crypto::FieldCipher;
use crate::types::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const DEFAULT_AI_MODEL: &str = "claude-opus-4-8";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncConfigStored {
    backend: SyncBackend,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    gist_token_enc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    gist_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    webdav_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    webdav_username: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    webdav_password_enc: Option<String>,
}

impl Default for SyncConfigStored {
    fn default() -> Self {
        Self {
            backend: SyncBackend::None,
            gist_token_enc: None,
            gist_id: None,
            webdav_url: None,
            webdav_username: None,
            webdav_password_enc: None,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiConfigStored {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    api_key_enc: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TeamVaultStored {
    id: String,
    name: String,
    backend: TeamBackend,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    gist_token_enc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    gist_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    webdav_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    webdav_username: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    webdav_password_enc: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VaultFile {
    version: u8,
    #[serde(default)]
    hosts: Vec<Host>,
    #[serde(default)]
    identities: Vec<Identity>,
    #[serde(default)]
    groups: Vec<Group>,
    #[serde(default)]
    snippets: Vec<Snippet>,
    #[serde(default)]
    tunnels: Vec<Tunnel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    sync: Option<SyncConfigStored>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    alarm: Option<AlarmConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    ai: Option<AiConfigStored>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    team_vaults: Option<Vec<TeamVaultStored>>,
}

impl Default for VaultFile {
    fn default() -> Self {
        Self {
            version: 1,
            hosts: vec![],
            identities: vec![],
            groups: vec![],
            snippets: vec![],
            tunnels: vec![],
            sync: None,
            alarm: None,
            ai: None,
            team_vaults: None,
        }
    }
}

// ---- Taşınabilir (portable) yapılar — sync/team paketleri ----

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableIdentity {
    pub id: String,
    pub name: String,
    pub username: String,
    pub auth_type: AuthType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub private_key_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secret_ref: Option<SecretRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_vault_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableVault {
    #[serde(default)]
    pub hosts: Vec<Host>,
    #[serde(default)]
    pub identities: Vec<PortableIdentity>,
    #[serde(default)]
    pub groups: Vec<Group>,
    #[serde(default)]
    pub snippets: Vec<Snippet>,
    #[serde(default)]
    pub tunnels: Vec<Tunnel>,
}

/// SSH bağlanırken kullanılan çözülmüş sırlar.
pub struct ResolvedSecrets {
    pub identity: Identity,
    pub password: Option<String>,
    pub passphrase: Option<String>,
}

pub struct VaultStore {
    path: PathBuf,
    pub config_dir: PathBuf,
    cipher: FieldCipher,
    data: VaultFile,
}

impl VaultStore {
    pub fn new(config_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        let cipher = FieldCipher::new(config_dir.clone())?;
        let path = config_dir.join("vault.json");
        let data = Self::load(&path);
        Ok(Self { path, config_dir, cipher, data })
    }

    fn load(path: &std::path::Path) -> VaultFile {
        match std::fs::read_to_string(path) {
            Ok(text) => match serde_json::from_str::<VaultFile>(&text) {
                Ok(v) => v,
                Err(e) => {
                    log::error!("vault.json parse hatası: {e}; .corrupt'a kopyalanıyor");
                    let _ = std::fs::copy(path, path.with_extension("json.corrupt"));
                    VaultFile::default()
                }
            },
            Err(_) => VaultFile::default(),
        }
    }

    fn persist(&self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())?;
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, &json).map_err(|e| e.to_string())?;
        std::fs::rename(&tmp, &self.path).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn encrypt(&self, plain: &str) -> Result<String, String> {
        self.cipher.encrypt(plain)
    }
    fn decrypt(&self, enc: &str) -> Result<String, String> {
        self.cipher.decrypt(enc)
    }

    // ---- Public görünüm ----

    pub fn get_public_data(&self) -> VaultData {
        VaultData {
            hosts: self.data.hosts.clone(),
            identities: self.data.identities.iter().map(|i| i.to_public()).collect(),
            groups: self.data.groups.clone(),
            snippets: self.data.snippets.clone(),
            tunnels: self.data.tunnels.clone(),
        }
    }

    // ---- Hosts ----

    pub fn get_host(&self, id: &str) -> Option<Host> {
        self.data.hosts.iter().find(|h| h.id == id).cloned()
    }

    pub fn save_host(&mut self, mut host: Host) -> Result<Host, String> {
        if host.id.is_empty() {
            host.id = new_id();
        }
        upsert(&mut self.data.hosts, host.clone(), |h| &h.id);
        self.persist()?;
        Ok(host)
    }

    pub fn delete_host(&mut self, id: &str) -> Result<(), String> {
        self.data.hosts.retain(|h| h.id != id);
        self.persist()
    }

    // ---- Identities ----

    pub fn save_identity(&mut self, req: IdentitySaveRequest) -> Result<IdentityPublic, String> {
        let id = req.id.clone().filter(|s| !s.is_empty()).unwrap_or_else(new_id);
        let existing = self.data.identities.iter().find(|i| i.id == id).cloned();

        let password_enc = match &req.password {
            Some(p) if !p.is_empty() => Some(self.encrypt(p)?),
            Some(_) => existing.as_ref().and_then(|e| e.password_enc.clone()),
            None => existing.as_ref().and_then(|e| e.password_enc.clone()),
        };
        let passphrase_enc = match &req.passphrase {
            Some(p) if !p.is_empty() => Some(self.encrypt(p)?),
            _ => existing.as_ref().and_then(|e| e.passphrase_enc.clone()),
        };
        // secretRef: Some(None)=temizle, None=koru, Some(Some)=ayarla
        let secret_ref = match req.secret_ref {
            Some(inner) => inner,
            None => existing.as_ref().and_then(|e| e.secret_ref.clone()),
        };

        let identity = Identity {
            id: id.clone(),
            name: req.name,
            username: req.username,
            auth_type: req.auth_type,
            password_enc,
            private_key_path: req.private_key_path.filter(|s| !s.is_empty()),
            passphrase_enc,
            secret_ref,
            team_vault_id: existing.and_then(|e| e.team_vault_id),
        };
        let public = identity.to_public();
        upsert(&mut self.data.identities, identity, |i| &i.id);
        self.persist()?;
        Ok(public)
    }

    pub fn delete_identity(&mut self, id: &str) -> Result<(), String> {
        self.data.identities.retain(|i| i.id != id);
        // Referans veren hostların identityId'sini temizle
        for h in &mut self.data.hosts {
            if h.identity_id.as_deref() == Some(id) {
                h.identity_id = None;
            }
        }
        for g in &mut self.data.groups {
            if g.identity_id.as_deref() == Some(id) {
                g.identity_id = None;
            }
        }
        self.persist()
    }

    // ---- Groups ----

    pub fn save_group(&mut self, mut group: Group) -> Result<Group, String> {
        if group.id.is_empty() {
            group.id = new_id();
        }
        upsert(&mut self.data.groups, group.clone(), |g| &g.id);
        self.persist()?;
        Ok(group)
    }

    pub fn delete_group(&mut self, id: &str) -> Result<(), String> {
        self.data.groups.retain(|g| g.id != id);
        for h in &mut self.data.hosts {
            if h.group_id.as_deref() == Some(id) {
                h.group_id = None;
            }
        }
        // Alt grupların parent'ını temizle
        for g in &mut self.data.groups {
            if g.parent_id.as_deref() == Some(id) {
                g.parent_id = None;
            }
        }
        self.persist()
    }

    // ---- Snippets ----

    pub fn save_snippet(&mut self, mut s: Snippet) -> Result<Snippet, String> {
        if s.id.is_empty() {
            s.id = new_id();
        }
        upsert(&mut self.data.snippets, s.clone(), |x| &x.id);
        self.persist()?;
        Ok(s)
    }

    pub fn delete_snippet(&mut self, id: &str) -> Result<(), String> {
        self.data.snippets.retain(|s| s.id != id);
        self.persist()
    }

    // ---- Tunnels ----

    pub fn save_tunnel(&mut self, mut t: Tunnel) -> Result<Tunnel, String> {
        if t.id.is_empty() {
            t.id = new_id();
        }
        upsert(&mut self.data.tunnels, t.clone(), |x| &x.id);
        self.persist()?;
        Ok(t)
    }

    pub fn delete_tunnel(&mut self, id: &str) -> Result<(), String> {
        self.data.tunnels.retain(|t| t.id != id);
        self.persist()
    }

    pub fn get_tunnel(&self, id: &str) -> Option<Tunnel> {
        self.data.tunnels.iter().find(|t| t.id == id).cloned()
    }

    // ---- Kimlik kalıtımı ----

    /// host.identityId yoksa grup zincirinde yukarı yürüyerek ilk tanımlı
    /// group.identityId'yi bulur (döngü koruması ile).
    pub fn resolve_identity_id(&self, host: &Host) -> Option<String> {
        if let Some(id) = &host.identity_id {
            return Some(id.clone());
        }
        let mut current = host.group_id.clone();
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
        while let Some(gid) = current {
            if !seen.insert(gid.clone()) {
                break;
            }
            let group = self.data.groups.iter().find(|g| g.id == gid)?;
            if let Some(iid) = &group.identity_id {
                return Some(iid.clone());
            }
            current = group.parent_id.clone();
        }
        None
    }

    pub fn get_identity(&self, id: &str) -> Option<Identity> {
        self.data.identities.iter().find(|i| i.id == id).cloned()
    }

    /// SSH bağlanırken: identity + çözülmüş (decrypt edilmiş) parola/passphrase.
    pub fn resolve_secrets(&self, identity_id: &str) -> Result<ResolvedSecrets, String> {
        let identity = self
            .get_identity(identity_id)
            .ok_or_else(|| "Identity not found".to_string())?;
        let password = match &identity.password_enc {
            Some(enc) => Some(self.decrypt(enc)?),
            None => None,
        };
        let passphrase = match &identity.passphrase_enc {
            Some(enc) => Some(self.decrypt(enc)?),
            None => None,
        };
        Ok(ResolvedSecrets { identity, password, passphrase })
    }

    // ---- Sync config ----

    fn sync(&self) -> SyncConfigStored {
        self.data.sync.clone().unwrap_or_default()
    }

    pub fn get_sync_public(&self) -> SyncConfigPublic {
        let s = self.sync();
        SyncConfigPublic {
            backend: s.backend,
            gist_id: s.gist_id,
            webdav_url: s.webdav_url,
            webdav_username: s.webdav_username,
            has_gist_token: s.gist_token_enc.is_some(),
            has_webdav_password: s.webdav_password_enc.is_some(),
        }
    }

    pub fn save_sync_config(&mut self, input: SyncConfigInput) -> Result<(), String> {
        let mut s = self.sync();
        s.backend = input.backend;
        if let Some(t) = input.gist_token.filter(|x| !x.is_empty()) {
            s.gist_token_enc = Some(self.encrypt(&t)?);
        }
        if let Some(id) = input.gist_id {
            s.gist_id = Some(id);
        }
        s.webdav_url = input.webdav_url.or(s.webdav_url);
        s.webdav_username = input.webdav_username.or(s.webdav_username);
        if let Some(p) = input.webdav_password.filter(|x| !x.is_empty()) {
            s.webdav_password_enc = Some(self.encrypt(&p)?);
        }
        self.data.sync = Some(s);
        self.persist()
    }

    pub fn resolve_sync_secrets(&self) -> Result<(Option<String>, Option<String>), String> {
        let s = self.sync();
        let token = match &s.gist_token_enc {
            Some(e) => Some(self.decrypt(e)?),
            None => None,
        };
        let pw = match &s.webdav_password_enc {
            Some(e) => Some(self.decrypt(e)?),
            None => None,
        };
        Ok((token, pw))
    }

    pub fn sync_backend(&self) -> SyncBackend {
        self.sync().backend
    }
    pub fn sync_gist_id(&self) -> Option<String> {
        self.sync().gist_id
    }
    pub fn sync_webdav(&self) -> (Option<String>, Option<String>) {
        let s = self.sync();
        (s.webdav_url, s.webdav_username)
    }

    pub fn set_gist_id(&mut self, id: &str) -> Result<(), String> {
        let mut s = self.sync();
        s.gist_id = Some(id.to_string());
        self.data.sync = Some(s);
        self.persist()
    }

    // ---- Alarm ----

    pub fn get_alarm_config(&self) -> AlarmConfig {
        self.data.alarm.clone().unwrap_or_default()
    }
    pub fn save_alarm_config(&mut self, config: AlarmConfig) -> Result<(), String> {
        self.data.alarm = Some(config);
        self.persist()
    }

    // ---- AI ----

    pub fn get_ai_public(&self) -> AiConfigPublic {
        let ai = self.data.ai.clone().unwrap_or_default();
        AiConfigPublic {
            model: ai.model.unwrap_or_else(|| DEFAULT_AI_MODEL.to_string()),
            has_api_key: ai.api_key_enc.is_some(),
        }
    }

    pub fn save_ai_config(&mut self, input: AiConfigInput) -> Result<(), String> {
        let mut ai = self.data.ai.clone().unwrap_or_default();
        if let Some(m) = input.model.filter(|x| !x.is_empty()) {
            ai.model = Some(m);
        }
        if let Some(k) = input.api_key.filter(|x| !x.is_empty()) {
            ai.api_key_enc = Some(self.encrypt(&k)?);
        }
        self.data.ai = Some(ai);
        self.persist()
    }

    pub fn resolve_ai(&self) -> Result<(String, Option<String>), String> {
        let ai = self.data.ai.clone().unwrap_or_default();
        let model = ai.model.unwrap_or_else(|| DEFAULT_AI_MODEL.to_string());
        let key = match &ai.api_key_enc {
            Some(e) => Some(self.decrypt(e)?),
            None => None,
        };
        Ok((model, key))
    }

    // ---- Portable export/import (sync) ----

    pub fn export_portable(&self) -> Result<PortableVault, String> {
        let mut identities = Vec::new();
        for i in &self.data.identities {
            let password = match &i.password_enc {
                Some(e) => Some(self.decrypt(e)?),
                None => None,
            };
            let passphrase = match &i.passphrase_enc {
                Some(e) => Some(self.decrypt(e)?),
                None => None,
            };
            identities.push(PortableIdentity {
                id: i.id.clone(),
                name: i.name.clone(),
                username: i.username.clone(),
                auth_type: i.auth_type,
                password,
                private_key_path: i.private_key_path.clone(),
                passphrase,
                secret_ref: i.secret_ref.clone(),
                team_vault_id: i.team_vault_id.clone(),
            });
        }
        Ok(PortableVault {
            hosts: self.data.hosts.clone(),
            identities,
            groups: self.data.groups.clone(),
            snippets: self.data.snippets.clone(),
            tunnels: self.data.tunnels.clone(),
        })
    }

    pub fn replace_portable(&mut self, data: PortableVault) -> Result<(), String> {
        self.data.hosts = data.hosts;
        self.data.groups = data.groups;
        self.data.snippets = data.snippets;
        self.data.tunnels = data.tunnels;
        let mut identities = Vec::new();
        for p in data.identities {
            let password_enc = match p.password.filter(|s| !s.is_empty()) {
                Some(pw) => Some(self.encrypt(&pw)?),
                None => None,
            };
            let passphrase_enc = match p.passphrase.filter(|s| !s.is_empty()) {
                Some(pp) => Some(self.encrypt(&pp)?),
                None => None,
            };
            identities.push(Identity {
                id: p.id,
                name: p.name,
                username: p.username,
                auth_type: p.auth_type,
                password_enc,
                private_key_path: p.private_key_path,
                passphrase_enc,
                secret_ref: p.secret_ref,
                team_vault_id: p.team_vault_id,
            });
        }
        self.data.identities = identities;
        self.persist()
    }

    // ---- Team vaults ----

    fn team_vaults(&self) -> Vec<TeamVaultStored> {
        self.data.team_vaults.clone().unwrap_or_default()
    }

    pub fn get_team_vaults_public(&self) -> Vec<TeamVaultPublic> {
        self.team_vaults()
            .into_iter()
            .map(|t| TeamVaultPublic {
                id: t.id,
                name: t.name,
                backend: t.backend,
                gist_id: t.gist_id,
                webdav_url: t.webdav_url,
                webdav_username: t.webdav_username,
                has_gist_token: t.gist_token_enc.is_some(),
                has_webdav_password: t.webdav_password_enc.is_some(),
            })
            .collect()
    }

    pub fn save_team_vault(&mut self, input: TeamVaultInput) -> Result<TeamVaultPublic, String> {
        let mut list = self.team_vaults();
        let id = input.id.clone().filter(|s| !s.is_empty()).unwrap_or_else(new_id);
        let existing = list.iter().find(|t| t.id == id).cloned();
        let mut stored = existing.unwrap_or(TeamVaultStored {
            id: id.clone(),
            name: input.name.clone(),
            backend: input.backend,
            gist_token_enc: None,
            gist_id: None,
            webdav_url: None,
            webdav_username: None,
            webdav_password_enc: None,
        });
        stored.name = input.name;
        stored.backend = input.backend;
        if let Some(t) = input.gist_token.filter(|x| !x.is_empty()) {
            stored.gist_token_enc = Some(self.encrypt(&t)?);
        }
        if let Some(gid) = input.gist_id {
            stored.gist_id = Some(gid);
        }
        stored.webdav_url = input.webdav_url.or(stored.webdav_url);
        stored.webdav_username = input.webdav_username.or(stored.webdav_username);
        if let Some(p) = input.webdav_password.filter(|x| !x.is_empty()) {
            stored.webdav_password_enc = Some(self.encrypt(&p)?);
        }
        let public = TeamVaultPublic {
            id: stored.id.clone(),
            name: stored.name.clone(),
            backend: stored.backend,
            gist_id: stored.gist_id.clone(),
            webdav_url: stored.webdav_url.clone(),
            webdav_username: stored.webdav_username.clone(),
            has_gist_token: stored.gist_token_enc.is_some(),
            has_webdav_password: stored.webdav_password_enc.is_some(),
        };
        upsert(&mut list, stored, |t| &t.id);
        self.data.team_vaults = Some(list);
        self.persist()?;
        Ok(public)
    }

    pub fn delete_team_vault(&mut self, id: &str) -> Result<(), String> {
        let mut list = self.team_vaults();
        list.retain(|t| t.id != id);
        self.data.team_vaults = Some(list);
        // İlgili öğelerin teamVaultId'sini temizle
        for h in &mut self.data.hosts {
            if h.team_vault_id.as_deref() == Some(id) {
                h.team_vault_id = None;
            }
        }
        for g in &mut self.data.groups {
            if g.team_vault_id.as_deref() == Some(id) {
                g.team_vault_id = None;
            }
        }
        for s in &mut self.data.snippets {
            if s.team_vault_id.as_deref() == Some(id) {
                s.team_vault_id = None;
            }
        }
        for i in &mut self.data.identities {
            if i.team_vault_id.as_deref() == Some(id) {
                i.team_vault_id = None;
            }
        }
        self.persist()
    }

    pub fn get_team_backend(&self, id: &str) -> Option<TeamBackend> {
        self.team_vaults().into_iter().find(|t| t.id == id).map(|t| t.backend)
    }
    pub fn team_gist_id(&self, id: &str) -> Option<String> {
        self.team_vaults().into_iter().find(|t| t.id == id).and_then(|t| t.gist_id)
    }
    pub fn team_webdav(&self, id: &str) -> (Option<String>, Option<String>) {
        match self.team_vaults().into_iter().find(|t| t.id == id) {
            Some(t) => (t.webdav_url, t.webdav_username),
            None => (None, None),
        }
    }

    pub fn resolve_team_secrets(&self, id: &str) -> Result<(Option<String>, Option<String>), String> {
        let t = self
            .team_vaults()
            .into_iter()
            .find(|t| t.id == id)
            .ok_or_else(|| "Team vault not found".to_string())?;
        let token = match &t.gist_token_enc {
            Some(e) => Some(self.decrypt(e)?),
            None => None,
        };
        let pw = match &t.webdav_password_enc {
            Some(e) => Some(self.decrypt(e)?),
            None => None,
        };
        Ok((token, pw))
    }

    pub fn set_team_gist_id(&mut self, id: &str, gist_id: &str) -> Result<(), String> {
        let mut list = self.team_vaults();
        if let Some(t) = list.iter_mut().find(|t| t.id == id) {
            t.gist_id = Some(gist_id.to_string());
        }
        self.data.team_vaults = Some(list);
        self.persist()
    }

    pub fn assign_to_team(
        &mut self,
        kind: &str,
        item_id: &str,
        team_id: Option<String>,
    ) -> Result<(), String> {
        match kind {
            "host" => {
                if let Some(h) = self.data.hosts.iter_mut().find(|h| h.id == item_id) {
                    h.team_vault_id = team_id;
                }
            }
            "group" => {
                if let Some(g) = self.data.groups.iter_mut().find(|g| g.id == item_id) {
                    g.team_vault_id = team_id;
                }
            }
            "snippet" => {
                if let Some(s) = self.data.snippets.iter_mut().find(|s| s.id == item_id) {
                    s.team_vault_id = team_id;
                }
            }
            "identity" => {
                if let Some(i) = self.data.identities.iter_mut().find(|i| i.id == item_id) {
                    i.team_vault_id = team_id;
                }
            }
            _ => return Err(format!("bilinmeyen tür: {kind}")),
        }
        self.persist()
    }

    /// Ekibe etiketli öğeler; identity SIRLARI HARİÇ (secretRef dahil).
    pub fn export_team(&self, team_id: &str) -> PortableVault {
        let hosts: Vec<Host> = self
            .data
            .hosts
            .iter()
            .filter(|h| h.team_vault_id.as_deref() == Some(team_id))
            .cloned()
            .collect();
        let groups: Vec<Group> = self
            .data
            .groups
            .iter()
            .filter(|g| g.team_vault_id.as_deref() == Some(team_id))
            .cloned()
            .collect();
        let snippets: Vec<Snippet> = self
            .data
            .snippets
            .iter()
            .filter(|s| s.team_vault_id.as_deref() == Some(team_id))
            .cloned()
            .collect();
        let identities: Vec<PortableIdentity> = self
            .data
            .identities
            .iter()
            .filter(|i| i.team_vault_id.as_deref() == Some(team_id))
            .map(|i| PortableIdentity {
                id: i.id.clone(),
                name: i.name.clone(),
                username: i.username.clone(),
                auth_type: i.auth_type,
                password: None,
                private_key_path: i.private_key_path.clone(),
                passphrase: None,
                secret_ref: i.secret_ref.clone(),
                team_vault_id: Some(team_id.to_string()),
            })
            .collect();
        PortableVault { hosts, identities, groups, snippets, tunnels: vec![] }
    }

    /// Eski ekip öğelerini sil + değiştir; YEREL identity sırlarını id bazında koru.
    pub fn replace_team(&mut self, team_id: &str, data: PortableVault) -> Result<(), String> {
        self.data.hosts.retain(|h| h.team_vault_id.as_deref() != Some(team_id));
        self.data.groups.retain(|g| g.team_vault_id.as_deref() != Some(team_id));
        self.data.snippets.retain(|s| s.team_vault_id.as_deref() != Some(team_id));

        for mut h in data.hosts {
            h.team_vault_id = Some(team_id.to_string());
            self.data.hosts.push(h);
        }
        for mut g in data.groups {
            g.team_vault_id = Some(team_id.to_string());
            self.data.groups.push(g);
        }
        for mut s in data.snippets {
            s.team_vault_id = Some(team_id.to_string());
            self.data.snippets.push(s);
        }
        // Identity'ler: yerel sırları koru; yoksa ekle
        for p in data.identities {
            if let Some(existing) = self.data.identities.iter_mut().find(|i| i.id == p.id) {
                existing.name = p.name;
                existing.username = p.username;
                existing.auth_type = p.auth_type;
                existing.private_key_path = p.private_key_path;
                existing.secret_ref = p.secret_ref;
                existing.team_vault_id = Some(team_id.to_string());
                // password_enc/passphrase_enc KORUNUR
            } else {
                self.data.identities.push(Identity {
                    id: p.id,
                    name: p.name,
                    username: p.username,
                    auth_type: p.auth_type,
                    password_enc: None,
                    private_key_path: p.private_key_path,
                    passphrase_enc: None,
                    secret_ref: p.secret_ref,
                    team_vault_id: Some(team_id.to_string()),
                });
            }
        }
        self.persist()
    }
}

impl VaultStore {
    /// İçe aktarılan veriyi dedup ile uygular; özet döndürür.
    pub fn apply_import(&mut self, parsed: crate::import::ParsedImport) -> ImportSummary {
        use std::collections::HashMap;
        let mut group_ids: HashMap<String, String> = HashMap::new();
        let mut identity_ids: HashMap<String, String> = HashMap::new();
        let mut summary = ImportSummary { ok: true, error: None, canceled: None, hosts: 0, identities: 0, groups: 0, skipped: 0 };

        // Gruplar (önce oluştur, sonra parent bağla)
        for g in &parsed.groups {
            let existing = self.data.groups.iter().find(|x| x.name == g.name).map(|x| x.id.clone());
            let id = existing.unwrap_or_else(|| {
                let id = new_id();
                self.data.groups.push(Group { id: id.clone(), name: g.name.clone(), parent_id: None, identity_id: None, team_vault_id: None });
                summary.groups += 1;
                id
            });
            group_ids.insert(g.name.clone(), id);
        }
        for g in &parsed.groups {
            if let Some(parent_name) = &g.parent_name {
                if let (Some(gid), Some(pid)) = (group_ids.get(&g.name), group_ids.get(parent_name)) {
                    let gid = gid.clone();
                    let pid = pid.clone();
                    if let Some(grp) = self.data.groups.iter_mut().find(|x| x.id == gid) {
                        grp.parent_id = Some(pid);
                    }
                }
            }
        }

        // Kimlikler (ada göre dedup)
        for i in &parsed.identities {
            let existing = self.data.identities.iter().find(|x| x.name == i.name).map(|x| x.id.clone());
            let id = existing.unwrap_or_else(|| {
                let id = new_id();
                self.data.identities.push(Identity {
                    id: id.clone(),
                    name: i.name.clone(),
                    username: i.username.clone(),
                    auth_type: i.auth_type,
                    password_enc: None,
                    private_key_path: i.private_key_path.clone(),
                    passphrase_enc: None,
                    secret_ref: None,
                    team_vault_id: None,
                });
                summary.identities += 1;
                id
            });
            identity_ids.insert(i.name.clone(), id);
        }

        // Hostlar (hostname+port+protocol dedup)
        for h in &parsed.hosts {
            let dup = self.data.hosts.iter().any(|x| x.hostname == h.hostname && x.port == h.port && x.protocol == h.protocol);
            if dup {
                summary.skipped += 1;
                continue;
            }
            let identity_id = h.identity_name.as_ref().and_then(|n| identity_ids.get(n)).cloned();
            let group_id = h.group_name.as_ref().and_then(|n| group_ids.get(n)).cloned();
            self.data.hosts.push(Host {
                id: new_id(),
                name: h.name.clone(),
                protocol: h.protocol,
                hostname: h.hostname.clone(),
                port: h.port,
                identity_id,
                group_id,
                tags: h.tags.clone(),
                color: None,
                startup_command: None,
                team_vault_id: None,
            });
            summary.hosts += 1;
        }

        if let Err(e) = self.persist() {
            return ImportSummary::error(e);
        }
        summary
    }
}

impl VaultStore {
    /// Bulut envanteri: sağlayıcı adında grup + ssh hostlar (port 22, dedup).
    pub fn import_cloud_hosts(
        &mut self,
        provider: &str,
        servers: Vec<(String, String)>, // (name, ip)
        identity_id: Option<String>,
    ) -> ImportSummary {
        let mut summary = ImportSummary { ok: true, error: None, canceled: None, hosts: 0, identities: 0, groups: 0, skipped: 0 };
        // Grup
        let group_id = match self.data.groups.iter().find(|g| g.name == provider) {
            Some(g) => g.id.clone(),
            None => {
                let id = new_id();
                self.data.groups.push(Group { id: id.clone(), name: provider.to_string(), parent_id: None, identity_id: None, team_vault_id: None });
                summary.groups += 1;
                id
            }
        };
        for (name, ip) in servers {
            let dup = self.data.hosts.iter().any(|h| h.hostname == ip && h.port == 22 && h.protocol == Protocol::Ssh);
            if dup {
                summary.skipped += 1;
                continue;
            }
            self.data.hosts.push(Host {
                id: new_id(),
                name,
                protocol: Protocol::Ssh,
                hostname: ip,
                port: 22,
                identity_id: identity_id.clone(),
                group_id: Some(group_id.clone()),
                tags: vec![provider.to_string()],
                color: None,
                startup_command: None,
                team_vault_id: None,
            });
            summary.hosts += 1;
        }
        if let Err(e) = self.persist() {
            return ImportSummary::error(e);
        }
        summary
    }
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn upsert<T, F>(list: &mut Vec<T>, item: T, key: F)
where
    F: Fn(&T) -> &String,
{
    let id = key(&item).clone();
    if let Some(slot) = list.iter_mut().find(|x| *key(x) == id) {
        *slot = item;
    } else {
        list.push(item);
    }
}
