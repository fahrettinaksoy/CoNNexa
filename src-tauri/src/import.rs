//! Rakip araç içe aktarma ayrıştırıcıları.
//! ssh_config / mRemoteNG (XML) / Termius (JSON). Parolalar aktarılmaz.

use crate::types::{AuthType, Protocol};

pub struct ParsedIdentity {
    pub name: String,
    pub username: String,
    pub auth_type: AuthType,
    pub private_key_path: Option<String>,
}

pub struct ParsedHost {
    pub name: String,
    pub protocol: Protocol,
    pub hostname: String,
    pub port: u16,
    pub identity_name: Option<String>,
    pub group_name: Option<String>,
    pub tags: Vec<String>,
}

pub struct ParsedGroup {
    pub name: String,
    pub parent_name: Option<String>,
}

#[derive(Default)]
pub struct ParsedImport {
    pub hosts: Vec<ParsedHost>,
    pub identities: Vec<ParsedIdentity>,
    pub groups: Vec<ParsedGroup>,
}

impl ParsedImport {
    fn ensure_identity(&mut self, username: &str, key_path: Option<String>) -> String {
        let name = match &key_path {
            Some(p) => {
                let base = p.rsplit(['/', '\\']).next().unwrap_or(p);
                format!("{username} ({base})")
            }
            None => format!("{username} (agent)"),
        };
        if !self.identities.iter().any(|i| i.name == name) {
            let auth_type = if key_path.is_some() { AuthType::Key } else { AuthType::Agent };
            self.identities.push(ParsedIdentity {
                name: name.clone(),
                username: username.to_string(),
                auth_type,
                private_key_path: key_path,
            });
        }
        name
    }
}

fn expand_home(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = std::env::var("HOME").ok().or_else(|| std::env::var("USERPROFILE").ok()) {
            return format!("{home}/{rest}");
        }
    }
    path.to_string()
}

// ---- ssh_config ----

pub fn default_ssh_config_path() -> Option<String> {
    let home = std::env::var("HOME").ok().or_else(|| std::env::var("USERPROFILE").ok())?;
    Some(format!("{home}/.ssh/config"))
}

pub fn parse_ssh_config(content: &str) -> ParsedImport {
    // (alias, hostname, user, port, key)
    type Block = (String, Option<String>, Option<String>, u16, Option<String>);
    let mut blocks: Vec<Block> = Vec::new();
    let mut cur: Option<Block> = None;

    for raw in content.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut parts = line.splitn(2, char::is_whitespace);
        let key = parts.next().unwrap_or("").to_lowercase();
        let val = parts.next().unwrap_or("").trim();
        match key.as_str() {
            "host" => {
                if let Some(b) = cur.take() {
                    blocks.push(b);
                }
                // wildcard içermeyen ilk alias
                let alias = val.split_whitespace().find(|a| !a.contains('*') && !a.contains('?'));
                cur = alias.map(|a| (a.to_string(), None, None, 0u16, None));
            }
            "hostname" => {
                if let Some(c) = cur.as_mut() {
                    c.1 = Some(val.to_string());
                }
            }
            "user" => {
                if let Some(c) = cur.as_mut() {
                    c.2 = Some(val.to_string());
                }
            }
            "port" => {
                if let Some(c) = cur.as_mut() {
                    c.3 = val.parse().unwrap_or(0);
                }
            }
            "identityfile" => {
                if let Some(c) = cur.as_mut() {
                    c.4 = Some(expand_home(val));
                }
            }
            _ => {}
        }
    }
    if let Some(b) = cur.take() {
        blocks.push(b);
    }

    let mut out = ParsedImport::default();
    for (alias, hostname, user, port, key) in blocks {
        let identity_name = user.as_ref().map(|u| out.ensure_identity(u, key.clone()));
        out.hosts.push(ParsedHost {
            name: alias.clone(),
            protocol: Protocol::Ssh,
            hostname: hostname.unwrap_or(alias),
            port: if port == 0 { 22 } else { port },
            identity_name,
            group_name: None,
            tags: vec!["ssh-config".into()],
        });
    }
    out
}

// ---- mRemoteNG (XML) ----

pub fn parse_mremoteng(content: &str) -> ParsedImport {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut out = ParsedImport::default();
    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);
    let mut group_stack: Vec<String> = Vec::new();

    let attr = |e: &quick_xml::events::BytesStart, name: &[u8]| -> Option<String> {
        e.attributes().flatten().find(|a| a.key.as_ref() == name).map(|a| {
            String::from_utf8_lossy(&a.value).to_string()
        })
    };

    // Her açık <Node> için container mı bilgisini tut; End'te ona göre pop.
    let mut node_is_container: Vec<bool> = Vec::new();

    let process_node = |out: &mut ParsedImport, e: &quick_xml::events::BytesStart, group_stack: &Vec<String>| -> bool {
        let node_type = attr(e, b"Type").unwrap_or_default();
        let name = attr(e, b"Name").unwrap_or_default();
        if node_type.eq_ignore_ascii_case("Container") {
            out.groups.push(ParsedGroup { name: name.clone(), parent_name: group_stack.last().cloned() });
            true
        } else {
            let hostname = attr(e, b"Hostname").unwrap_or_default();
            let proto = attr(e, b"Protocol").unwrap_or_default().to_lowercase();
            let protocol = map_protocol(&proto);
            let port = attr(e, b"Port").and_then(|p| p.parse::<u16>().ok()).unwrap_or(default_port(protocol));
            let username = attr(e, b"Username").unwrap_or_default();
            let identity_name = if !username.is_empty() { Some(out.ensure_identity(&username, None)) } else { None };
            out.hosts.push(ParsedHost {
                name: if name.is_empty() { hostname.clone() } else { name },
                protocol,
                hostname,
                port,
                identity_name,
                group_name: group_stack.last().cloned(),
                tags: vec!["mremoteng".into()],
            });
            false
        }
    };

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if e.name().as_ref() == b"Node" {
                    let is_container = process_node(&mut out, &e, &group_stack);
                    if is_container {
                        let name = attr(&e, b"Name").unwrap_or_default();
                        group_stack.push(name);
                    }
                    node_is_container.push(is_container);
                }
            }
            Ok(Event::Empty(e)) => {
                if e.name().as_ref() == b"Node" {
                    // self-closing → çocuk yok, stack'e girmez
                    let _ = process_node(&mut out, &e, &group_stack);
                }
            }
            Ok(Event::End(e)) => {
                if e.name().as_ref() == b"Node" {
                    if let Some(true) = node_is_container.pop() {
                        group_stack.pop();
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    out
}

// ---- Termius (JSON) ----

pub fn parse_termius(content: &str) -> ParsedImport {
    let mut out = ParsedImport::default();
    let root: serde_json::Value = match serde_json::from_str(content) {
        Ok(v) => v,
        Err(_) => return out,
    };

    let hosts_val = if root.is_array() {
        root.clone()
    } else {
        root.get("hosts")
            .or_else(|| root.get("Hosts"))
            .or_else(|| root.get("sshConnections"))
            .cloned()
            .unwrap_or(serde_json::Value::Null)
    };

    if let Some(arr) = hosts_val.as_array() {
        for h in arr {
            let hostname = h
                .get("address")
                .or_else(|| h.get("hostname"))
                .or_else(|| h.get("host"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if hostname.is_empty() {
                continue;
            }
            let name = h
                .get("label")
                .or_else(|| h.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or(&hostname)
                .to_string();
            let port = h.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
            let username = h
                .get("username")
                .or_else(|| h.get("user"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let identity_name = if !username.is_empty() {
                Some(out.ensure_identity(&username, None))
            } else {
                None
            };
            out.hosts.push(ParsedHost {
                name,
                protocol: Protocol::Ssh,
                hostname,
                port: if port == 0 { 22 } else { port },
                identity_name,
                group_name: None,
                tags: vec!["termius".into()],
            });
        }
    }
    out
}

fn map_protocol(p: &str) -> Protocol {
    match p {
        "ssh1" | "ssh2" | "ssh" => Protocol::Ssh,
        "rdp" => Protocol::Rdp,
        "vnc" => Protocol::Vnc,
        "telnet" => Protocol::Telnet,
        _ => Protocol::Ssh,
    }
}

fn default_port(p: Protocol) -> u16 {
    match p {
        Protocol::Ssh => 22,
        Protocol::Telnet => 23,
        Protocol::Rdp => 3389,
        Protocol::Vnc => 5900,
        Protocol::Serial => 9600,
        Protocol::Local => 0,
    }
}
