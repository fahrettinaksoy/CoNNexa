//! İki şifreleme katmanı:
//!
//! 1. **At-rest alan şifrelemesi** (OS anahtarlığı): 32-byte
//!    rastgele ana anahtar OS anahtarlığında (keyring) saklanır; alanlar
//!    AES-256-GCM ile şifrelenir. Anahtarlık yoksa app config dizininde 0600
//!    izinli anahtar dosyasına düşülür (uyarı loglanır). Makineye bağlıdır,
//!    taşınamaz.
//!
//! 2. **Payload şifrelemesi** (sync/team, taşınabilir): parola tabanlı
//!    scrypt(N=16384, r=8, p=1, 32 byte) + AES-256-GCM. Blob biçimi TS
//!    `vaultCrypto.ts` ile BİREBİR aynıdır (base64(JSON{v,kdf,salt,iv,tag,data})).

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const KEYRING_SERVICE: &str = "com.connexa.app";
const KEYRING_USER: &str = "vault-master-key";

/// At-rest ana anahtarı çözer/oluşturur. Önce keyring, olmazsa dosya fallback.
fn master_key(fallback_dir: &std::path::Path) -> Result<[u8; 32], String> {
    // 1) Keyring dene
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        match entry.get_password() {
            Ok(b64) => {
                if let Ok(bytes) = B64.decode(b64.as_bytes()) {
                    if bytes.len() == 32 {
                        let mut k = [0u8; 32];
                        k.copy_from_slice(&bytes);
                        return Ok(k);
                    }
                }
            }
            Err(keyring::Error::NoEntry) => {
                let key = random_key();
                if entry.set_password(&B64.encode(key)).is_ok() {
                    return Ok(key);
                }
                // set başarısızsa dosyaya düş
            }
            Err(_) => { /* keyring erişilemedi → dosya fallback */ }
        }
    }

    // 2) Dosya fallback (0600)
    let path = fallback_dir.join("master.key");
    if let Ok(b64) = std::fs::read_to_string(&path) {
        if let Ok(bytes) = B64.decode(b64.trim().as_bytes()) {
            if bytes.len() == 32 {
                let mut k = [0u8; 32];
                k.copy_from_slice(&bytes);
                return Ok(k);
            }
        }
    }
    log::warn!("OS anahtarlığı kullanılamadı; ana anahtar dosyaya yazılıyor (daha az güvenli)");
    std::fs::create_dir_all(fallback_dir).map_err(|e| e.to_string())?;
    let key = random_key();
    std::fs::write(&path, B64.encode(key)).map_err(|e| e.to_string())?;
    set_file_permissions_600(&path);
    Ok(key)
}

fn random_key() -> [u8; 32] {
    let mut k = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut k);
    k
}

#[cfg(unix)]
fn set_file_permissions_600(path: &std::path::Path) {
    use std::os::unix::fs::PermissionsExt;
    let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
}
#[cfg(not(unix))]
fn set_file_permissions_600(_path: &std::path::Path) {}

/// At-rest alan şifreleyici. `fallback_dir` app config dizinidir.
#[derive(Clone)]
pub struct FieldCipher {
    key: [u8; 32],
}

impl FieldCipher {
    pub fn new(fallback_dir: PathBuf) -> Result<Self, String> {
        Ok(Self {
            key: master_key(&fallback_dir)?,
        })
    }

    /// base64(nonce(12) || ciphertext+tag)
    pub fn encrypt(&self, plain: &str) -> Result<String, String> {
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&self.key));
        let mut nonce_bytes = [0u8; 12];
        rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ct = cipher
            .encrypt(nonce, plain.as_bytes())
            .map_err(|_| "şifreleme başarısız".to_string())?;
        let mut out = Vec::with_capacity(12 + ct.len());
        out.extend_from_slice(&nonce_bytes);
        out.extend_from_slice(&ct);
        Ok(B64.encode(out))
    }

    pub fn decrypt(&self, enc_b64: &str) -> Result<String, String> {
        let raw = B64.decode(enc_b64.as_bytes()).map_err(|e| e.to_string())?;
        if raw.len() < 13 {
            return Err("bozuk şifreli veri".into());
        }
        let (nonce_bytes, ct) = raw.split_at(12);
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&self.key));
        let pt = cipher
            .decrypt(Nonce::from_slice(nonce_bytes), ct)
            .map_err(|_| "çözme başarısız (yanlış anahtar?)".to_string())?;
        String::from_utf8(pt).map_err(|e| e.to_string())
    }
}

// ---- Payload şifrelemesi (taşınabilir, scrypt + AES-256-GCM) ----

#[derive(Serialize, Deserialize)]
struct Blob {
    v: u8,
    kdf: String,
    salt: String,
    iv: String,
    tag: String,
    data: String,
}

fn derive_key(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    // N=16384 → log_n=14, r=8, p=1, len=32 (TS ile aynı).
    let params = scrypt::Params::new(14, 8, 1, 32).map_err(|e| e.to_string())?;
    let mut key = [0u8; 32];
    scrypt::scrypt(passphrase.as_bytes(), salt, &params, &mut key).map_err(|e| e.to_string())?;
    Ok(key)
}

/// TS `encryptPayload` ile birebir uyumlu blob üretir.
pub fn encrypt_payload<T: Serialize>(payload: &T, passphrase: &str) -> Result<String, String> {
    let plaintext = serde_json::to_vec(payload).map_err(|e| e.to_string())?;
    let mut salt = [0u8; 16];
    let mut iv = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut salt);
    rand::rngs::OsRng.fill_bytes(&mut iv);
    let key = derive_key(passphrase, &salt)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    // aes-gcm tag'ı ciphertext'e ekler; TS formatı için ayır.
    let mut sealed = cipher
        .encrypt(
            Nonce::from_slice(&iv),
            Payload {
                msg: &plaintext,
                aad: b"",
            },
        )
        .map_err(|_| "şifreleme başarısız".to_string())?;
    let tag = sealed.split_off(sealed.len() - 16);
    let blob = Blob {
        v: 1,
        kdf: "scrypt".into(),
        salt: B64.encode(salt),
        iv: B64.encode(iv),
        tag: B64.encode(&tag),
        data: B64.encode(&sealed),
    };
    let json = serde_json::to_vec(&blob).map_err(|e| e.to_string())?;
    Ok(B64.encode(json))
}

/// TS `decryptPayload` ile birebir uyumlu; yanlış parola/bozuk blob → Err.
pub fn decrypt_payload<T: for<'de> Deserialize<'de>>(
    blob_b64: &str,
    passphrase: &str,
) -> Result<T, String> {
    let json = B64
        .decode(blob_b64.trim().as_bytes())
        .map_err(|e| e.to_string())?;
    let blob: Blob = serde_json::from_slice(&json).map_err(|e| e.to_string())?;
    let salt = B64
        .decode(blob.salt.as_bytes())
        .map_err(|e| e.to_string())?;
    let iv = B64.decode(blob.iv.as_bytes()).map_err(|e| e.to_string())?;
    let tag = B64.decode(blob.tag.as_bytes()).map_err(|e| e.to_string())?;
    let data = B64
        .decode(blob.data.as_bytes())
        .map_err(|e| e.to_string())?;
    let key = derive_key(passphrase, &salt)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let mut combined = data;
    combined.extend_from_slice(&tag);
    let pt = cipher
        .decrypt(
            Nonce::from_slice(&iv),
            Payload {
                msg: &combined,
                aad: b"",
            },
        )
        .map_err(|_| "çözme başarısız (yanlış parola?)".to_string())?;
    serde_json::from_slice(&pt).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(serde::Serialize, serde::Deserialize, PartialEq, Debug)]
    struct Sample {
        a: u32,
        b: String,
    }

    #[test]
    fn payload_round_trip() {
        let s = Sample {
            a: 42,
            b: "gizli".into(),
        };
        let blob = encrypt_payload(&s, "parola123").unwrap();
        let back: Sample = decrypt_payload(&blob, "parola123").unwrap();
        assert_eq!(s, back);
    }

    #[test]
    fn wrong_passphrase_fails() {
        let s = Sample {
            a: 1,
            b: "x".into(),
        };
        let blob = encrypt_payload(&s, "dogru").unwrap();
        assert!(decrypt_payload::<Sample>(&blob, "yanlis").is_err());
    }

    #[test]
    fn tampered_blob_fails() {
        let s = Sample {
            a: 7,
            b: "z".into(),
        };
        let blob = encrypt_payload(&s, "p").unwrap();
        let mut bad = blob.clone();
        bad.push('X'); // base64'ü boz
        assert!(decrypt_payload::<Sample>(&bad, "p").is_err());
    }
}
