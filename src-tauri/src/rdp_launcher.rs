//! Harici RDP istemcisi başlatıcı.
//! Platforma göre mstsc / open .rdp / xfreerdp.

use crate::types::Host;

pub fn launch(host: &Host, username: &str, password: &str) -> Result<(), String> {
    // addr yalnız windows/macos kollarında kullanılır; linux xfreerdp'de host+port
    // ayrı geçer. Platforma göre kullanılmadığında uyarı vermesin.
    #[allow(unused_variables)]
    let addr = format!(
        "{}:{}",
        host.hostname,
        if host.port == 0 { 3389 } else { host.port }
    );

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let target = format!("TERMSRV/{}", host.hostname);
        let _ = Command::new("cmdkey")
            .arg(format!("/generic:{target}"))
            .arg(format!("/user:{username}"))
            .arg(format!("/pass:{password}"))
            .output();
        Command::new("mstsc.exe")
            .arg(format!("/v:{addr}"))
            .spawn()
            .map_err(|e| format!("mstsc başlatılamadı: {e}"))?;
        // 20 sn sonra kimlik bilgisini sil
        let target2 = target.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(20));
            let _ = Command::new("cmdkey")
                .arg(format!("/delete:{target2}"))
                .output();
        });
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let _ = username;
        let _ = password;
        let file = std::env::temp_dir().join(format!("connexa-{}.rdp", host.id));
        let content = format!(
            "full address:s:{addr}\nusername:s:{username}\nscreen mode id:i:2\nauthentication level:i:2\n"
        );
        std::fs::write(&file, content).map_err(|e| format!("rdp dosyası yazılamadı: {e}"))?;
        Command::new("open")
            .arg(&file)
            .spawn()
            .map_err(|e| format!("open başarısız: {e}"))?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        use std::process::Command;
        let args: Vec<String> = vec![
            format!("/v:{}", host.hostname),
            format!("/port:{}", if host.port == 0 { 3389 } else { host.port }),
            format!("/u:{username}"),
            format!("/p:{password}"),
            "/cert:ignore".into(),
            "+clipboard".into(),
            "/dynamic-resolution".into(),
        ];
        for bin in ["xfreerdp", "freerdp"] {
            if Command::new(bin).args(&args).spawn().is_ok() {
                return Ok(());
            }
        }
        return Err("xfreerdp/freerdp bulunamadı".into());
    }

    #[allow(unreachable_code)]
    Err("bu platformda desteklenmiyor".into())
}
