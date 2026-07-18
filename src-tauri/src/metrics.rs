//! Uzak sunucu metrikleri (Linux). Tek exec komutu + string parse.

use crate::ssh::{self, SshHandle};
use crate::types::{DiskUsage, HostMetrics, ProcessInfo};

const CMD: &str = "echo __UP__; uptime; echo __MEM__; free -b; echo __CPU__; nproc; echo __DISK__; df -kP; echo __PROC__; ps -eo pid,pcpu,pmem,comm --sort=-pcpu | head -n 16";

pub async fn snapshot(handle: &SshHandle) -> HostMetrics {
    let out = match ssh::exec(handle, CMD).await {
        Ok((_, stdout, _)) => stdout,
        Err(e) => {
            return HostMetrics {
                ok: false,
                error: Some(e),
                ..Default::default()
            }
        }
    };
    parse(&out)
}

fn section<'a>(text: &'a str, start: &str, end: Option<&str>) -> &'a str {
    let s = match text.find(start) {
        Some(i) => i + start.len(),
        None => return "",
    };
    let rest = &text[s..];
    match end {
        Some(e) => match rest.find(e) {
            Some(i) => &rest[..i],
            None => rest,
        },
        None => rest,
    }
}

fn parse(out: &str) -> HostMetrics {
    let mut m = HostMetrics {
        ok: true,
        ..Default::default()
    };

    // uptime + load average
    let up = section(out, "__UP__", Some("__MEM__")).trim();
    if !up.is_empty() {
        m.uptime = Some(up.lines().next().unwrap_or("").trim().to_string());
        if let Some(idx) = up.find("load average") {
            // "load average: 0.15, 0.10, 0.05" — virgül/boşluk token ayracı;
            // ondalık ayracı nokta (SSH exec C locale). "load"/"average:" gibi
            // sayısal olmayan token'lar parse edilemez ve elenir.
            let after = &up[idx..];
            let nums: Vec<f64> = after
                .split(|c: char| c == ',' || c.is_whitespace())
                .filter_map(|tok| tok.trim().parse::<f64>().ok())
                .collect();
            if nums.len() >= 3 {
                m.load_avg = Some([nums[0], nums[1], nums[2]]);
            }
        }
    }

    // free -b → Mem satırı
    let mem = section(out, "__MEM__", Some("__CPU__"));
    for line in mem.lines() {
        if line.starts_with("Mem:") {
            let cols: Vec<u64> = line
                .split_whitespace()
                .skip(1)
                .filter_map(|s| s.parse::<u64>().ok())
                .collect();
            if cols.len() >= 3 {
                m.mem_total_bytes = Some(cols[0]);
                m.mem_used_bytes = Some(cols[1]);
            }
        }
    }

    // nproc
    let cpu = section(out, "__CPU__", Some("__DISK__")).trim();
    if let Ok(n) = cpu.lines().next().unwrap_or("").trim().parse::<u32>() {
        m.cpu_count = Some(n);
    }

    // df -kP
    let disk = section(out, "__DISK__", Some("__PROC__"));
    let mut disks = Vec::new();
    for line in disk.lines() {
        // Boş satır ve "Filesystem ..." başlığını atla (echo sonrası \n başlığı
        // ilk veri satırı yapıyordu — skip(1) yetmiyor).
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("Filesystem") {
            continue;
        }
        let c: Vec<&str> = line.split_whitespace().collect();
        if c.len() < 6 {
            continue;
        }
        let mount = c[5];
        // Sanal FS'leri atla (kök hariç)
        if mount != "/"
            && (mount.starts_with("/dev")
                || mount.starts_with("/proc")
                || mount.starts_with("/sys")
                || mount.starts_with("/run"))
        {
            continue;
        }
        let size_kb = c[1].parse::<u64>().unwrap_or(0);
        let used_kb = c[2].parse::<u64>().unwrap_or(0);
        let size = size_kb * 1024;
        let used = used_kb * 1024;
        let pct = if size > 0 {
            used as f64 / size as f64 * 100.0
        } else {
            0.0
        };
        disks.push(DiskUsage {
            mount: mount.to_string(),
            size_bytes: size,
            used_bytes: used,
            use_percent: pct,
        });
    }
    if !disks.is_empty() {
        m.disks = Some(disks);
    }

    // ps
    let proc = section(out, "__PROC__", None);
    let mut procs = Vec::new();
    for line in proc.lines() {
        // Boş satır ve "PID %CPU ..." başlığını atla.
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("PID") {
            continue;
        }
        let c: Vec<&str> = line.split_whitespace().collect();
        if c.len() < 4 {
            continue;
        }
        let pid = c[0].parse::<u32>().unwrap_or(0);
        let cpu = c[1].parse::<f64>().unwrap_or(0.0);
        let mem = c[2].parse::<f64>().unwrap_or(0.0);
        let command = c[3..].join(" ");
        procs.push(ProcessInfo {
            pid,
            cpu,
            mem,
            command,
        });
    }
    if !procs.is_empty() {
        m.processes = Some(procs);
    }

    m
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_sample_output() {
        let out = "__UP__\n 10:00:00 up 5 days,  1:23,  2 users,  load average: 0.15, 0.10, 0.05\n__MEM__\n              total        used        free\nMem: 1000000 400000 600000\n__CPU__\n4\n__DISK__\nFilesystem 1024-blocks Used Available Capacity Mounted\n/dev/disk1 1000000 500000 500000 50% /\ntmpfs 100 50 50 50% /run\n__PROC__\n  PID %CPU %MEM COMMAND\n 1 1.5 2.0 init\n 2 0.5 1.0 bash\n";
        let m = parse(out);
        assert!(m.ok);
        assert_eq!(m.cpu_count, Some(4));
        assert_eq!(m.load_avg, Some([0.15, 0.10, 0.05]));
        assert_eq!(m.mem_total_bytes, Some(1000000));
        assert_eq!(m.mem_used_bytes, Some(400000));
        let disks = m.disks.unwrap();
        // /run sanal FS atlanır, yalnız kök
        assert_eq!(disks.len(), 1);
        assert_eq!(disks[0].mount, "/");
        assert_eq!(disks[0].size_bytes, 1000000 * 1024);
        let procs = m.processes.unwrap();
        assert_eq!(procs.len(), 2);
        assert_eq!(procs[0].command, "init");
        assert_eq!(procs[0].pid, 1);
    }
}
