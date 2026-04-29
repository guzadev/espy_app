# Icons

Place your app icons here before building. Required files:

| File | Size | Format | Used for |
|---|---|---|---|
| `32x32.png` | 32×32 | PNG | Windows taskbar |
| `128x128.png` | 128×128 | PNG | Linux |
| `128x128@2x.png` | 256×256 | PNG | Linux HiDPI |
| `icon.icns` | multi-size | ICNS | macOS |
| `icon.ico` | multi-size | ICO | Windows installer |
| `icon.png` | 512×512 | PNG | Source (used by tauri icon command) |

## Quickest way to generate all icons

1. Create a single `icon.png` at 512×512 or 1024×1024 pixels
2. Run: `npm run tauri icon icon.png`

Tauri will auto-generate all required sizes from that one source file.
