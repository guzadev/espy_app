use std::net::UdpSocket;
use std::time::Duration;

#[tauri::command]
fn discover_espy() -> Result<String, String> {
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.set_broadcast(true).map_err(|e| e.to_string())?;
    socket
        .set_read_timeout(Some(Duration::from_millis(2000)))
        .map_err(|e| e.to_string())?;

    socket
        .send_to(b"ESPY_DISCOVER", "255.255.255.255:5555")
        .map_err(|e| e.to_string())?;

    let mut buf = [0u8; 256];
    match socket.recv_from(&mut buf) {
        Ok((len, _)) => Ok(String::from_utf8_lossy(&buf[..len]).to_string()),
        Err(_) => Err("Espy not found".to_string()),
    }
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![discover_espy, restart_app])
        .run(tauri::generate_context!())
        .expect("error while running Espy");
}
