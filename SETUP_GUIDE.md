# Guía Completa: React + Tauri v2 + GitHub Actions Auto-Release

Esta guía documenta todo el proceso para convertir una app React/Vite en una app de escritorio Windows con instalador automático y auto-actualizaciones.

---

## Stack utilizado

- **Frontend**: React 19 + TypeScript + Vite
- **Desktop**: Tauri v2
- **CI/CD**: GitHub Actions
- **Auto-update**: tauri-plugin-updater (minisign)
- **Targets**: Windows (.msi + .exe NSIS)

---

## PARTE 1 — Preparación del proyecto

### 1.1 Estructura esperada

```
mi-app/
├── src/                   # Código React
├── public/
├── src-tauri/             # Generado por Tauri
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── .github/
│   └── workflows/
│       └── release.yml
├── .gitignore
├── package.json
└── vite.config.ts
```

### 1.2 Requisitos previos

- Node.js 18+
- Rust (instalar desde https://rustup.rs)
- Visual Studio C++ Build Tools (Windows)
- WebView2 (viene incluido en Windows 11)

---

## PARTE 2 — Instalar Tauri v2

### 2.1 Agregar dependencias al package.json

```bash
npm install --save-dev @tauri-apps/cli@^2
```

Agregar scripts en `package.json`:

```json
"scripts": {
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

### 2.2 Inicializar Tauri

```bash
npm run tauri init
```

Cuando pregunte:
- App name: `NombreApp`
- Window title: `NombreApp`
- Where are web assets: `../dist`
- URL of dev server: `http://localhost:8080` (o el puerto de Vite)
- Frontend dev command: `npm run dev`
- Frontend build command: `npm run build`

### 2.3 Configurar Vite para Tauri

En `vite.config.ts` agregar dentro de `defineConfig`:

```ts
server: {
  port: 8080,
  strictPort: true,
  watch: {
    ignored: ["**/src-tauri/**"],
  },
},
build: {
  target: process.env.TAURI_ENV_PLATFORM == "windows"
    ? "chrome105"
    : "safari13",
  minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
  sourcemap: !!process.env.TAURI_ENV_DEBUG,
},
clearScreen: false,
```

---

## PARTE 3 — Configurar Tauri v2

### 3.1 tauri.conf.json (estructura completa Tauri v2)

**IMPORTANTE**: En Tauri v2 `identifier` va SOLO en el nivel raíz, no dentro de `bundle`.

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "NombreApp",
  "version": "0.1.0",
  "identifier": "com.tudominio.nombreapp",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:8080",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "NombreApp",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  },
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/TUUSUARIO/TUREPO/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "AQUI_VA_LA_CLAVE_PUBLICA_MINISIGN"
    }
  }
}
```

### 3.2 Cargo.toml

```toml
[package]
name = "nombre-app-lib"
version = "0.1.0"
edition = "2021"

[lib]
name = "nombre_app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-updater = "2"
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
strip = true
```

### 3.3 src/main.rs

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    nombre_app_lib::run()
}
```

### 3.4 src/lib.rs

```rust
use tauri_plugin_updater::UpdaterExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(updater) = handle.updater() {
                    if let Ok(Some(update)) = updater.check().await {
                        let _ = update.download_and_install(|_, _| {}, || {}).await;
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3.5 build.rs

```rust
fn main() {
    tauri_build::build()
}
```

### 3.6 capabilities/default.json

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "updater:default"
  ]
}
```

---

## PARTE 4 — Iconos

Crear un PNG de 512x512 o 1024x1024 y correr:

```bash
npm run tauri icon icon.png
```

Genera automáticamente todos los tamaños requeridos en `src-tauri/icons/`.

---

## PARTE 5 — Clave de firma para auto-updates

El auto-updater requiere que los instaladores estén firmados con minisign.

### 5.1 Generar el par de claves

```bash
npx tauri signer generate -w %USERPROFILE%\.tauri\miapp.key
```

Cuando pida password, ingresá una contraseña y **guardala** (la vas a necesitar en GitHub Secrets).

Output esperado:
```
Public Key: AQUI_APARECE_LA_CLAVE_PUBLICA
Private Key saved to: C:\Users\TU_USUARIO\.tauri\miapp.key
```

### 5.2 Colocar la clave pública en tauri.conf.json

El valor de `pubkey` en la sección `plugins.updater` debe ser la clave pública generada (el string largo en base64).

### 5.3 Guardar la clave privada

La clave privada queda en `C:\Users\TU_USUARIO\.tauri\miapp.key`. **No la subas a git.**

---

## PARTE 6 — GitHub Actions (auto-release)

### 6.1 Crear el workflow

Crear archivo `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    permissions:
      contents: write
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: package-lock.json

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri -> target

      - name: Install frontend dependencies
        run: npm ci

      - name: Build and release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: NombreApp ${{ github.ref_name }}
          releaseBody: |
            ## What's new
            See the commit history for changes.
          releaseDraft: false
          prerelease: false
```

**Nota**: Si la app está en una subcarpeta (ej: `app/`), agregar `projectPath: app` en el paso `tauri-apps/tauri-action` y ajustar `cache-dependency-path: app/package-lock.json` y `working-directory: app` donde corresponda.

### 6.2 Agregar Secrets en GitHub

Ir a: `https://github.com/TUUSUARIO/TUREPO/settings/secrets/actions`

Crear estos dos secrets:

| Name | Value |
|------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contenido completo del archivo `.tauri/miapp.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | La contraseña que usaste al generar la clave |

---

## PARTE 7 — .gitignore

```gitignore
# Dependencies
node_modules/

# Build output
dist/
dist-ssr/

# Rust / Tauri build artifacts (pueden pesar cientos de MB)
src-tauri/target/
src-tauri/gen/

# Environment variables
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# Editor / OS
.DS_Store
Thumbs.db
.vscode/*
!.vscode/extensions.json
.idea/
*.suo
*.sw?
```

---

## PARTE 8 — Build local (para probar antes de publicar)

```bash
npm run tauri:build
```

Los instaladores se generan en:
```
src-tauri/target/release/bundle/
├── msi/     → NombreApp_0.1.0_x64_en-US.msi
└── nsis/    → NombreApp_0.1.0_x64-setup.exe
```

Para compilar con firma (necesario para que el updater funcione):

**Windows CMD:**
```cmd
set TAURI_SIGNING_PRIVATE_KEY=contenido_del_archivo_key
set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=tu_password
npm run tauri:build
```

**PowerShell:**
```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\miapp.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "tu_password"
npm run tauri:build
```

---

## PARTE 9 — Publicar una versión

### Primera vez:

```bash
git init
git remote add origin git@github.com:TUUSUARIO/TUREPO.git
git add .
git commit -m "Initial commit"
git branch -m main
git push -u origin main
git tag v0.1.0
git push origin v0.1.0
```

### Versiones siguientes:

1. Cambiar `"version": "0.2.0"` en `src-tauri/tauri.conf.json`
2. Commitear y pushear los cambios normalmente
3. Crear y pushear el tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions compila (~15-20 min) y publica el instalador en Releases automáticamente.

---

## PARTE 10 — Cómo funciona el auto-update para el usuario

1. El usuario descarga e instala la app desde GitHub Releases
2. Cada vez que abre la app, esta chequea en segundo plano si hay una versión nueva
3. Si hay update disponible, aparece un diálogo:
   ```
   Update Available
   NombreApp v0.2.0 is available. Do you want to install it?
   [Install]   [Later]
   ```
4. Con un click en Install, se descarga, instala y reinicia la app sola

---

## PARTE 11 — Convención de versiones (semver)

| Versión | Cuándo usarla |
|---------|---------------|
| `0.1.0` | Primera versión funcional, en desarrollo |
| `0.x.x` | Todavía en desarrollo, puede cambiar todo |
| `1.0.0` | Primera versión estable lista para el público |
| `1.0.1` | Fix de bug, sin cambios de funcionalidad |
| `1.1.0` | Nueva funcionalidad, compatible con lo anterior |
| `2.0.0` | Cambio grande que rompe compatibilidad anterior |

---

## Errores comunes y soluciones

### `bundle: Additional properties are not allowed ('identifier')`
**Causa**: En Tauri v2, `identifier` va SOLO en el nivel raíz del JSON, no dentro de `bundle`.
**Fix**: Mover `identifier` fuera de `bundle`.

### `npm run tauri signer generate -w` falla
**Causa**: npm interpreta `-w` como `--workspace`.
**Fix**: Usar `npx tauri signer generate -w` en lugar de `npm run tauri`.

### `~` no se expande en Windows CMD
**Causa**: `~` solo funciona en bash/PowerShell, no en CMD.
**Fix**: Usar `%USERPROFILE%` en CMD o `$env:USERPROFILE` en PowerShell.

### Error de TypeScript `useRef` sin argumento (React 19)
**Causa**: React 19 requiere argumento inicial en `useRef`.
**Fix**: Cambiar `useRef<number>()` por `useRef<number>(undefined)`.

### El workflow falla en GitHub Actions
**Causas frecuentes**:
- Falta alguno de los dos secrets
- El `projectPath` en el workflow no coincide con la estructura del repo
- La versión en `tauri.conf.json` no coincide con el tag pusheado
