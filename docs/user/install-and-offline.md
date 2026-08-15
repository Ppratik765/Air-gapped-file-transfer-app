# Installation and Offline Usage

WaveDrop is built from the ground up for 100% offline functionality. It is distributed in four deployment formats:

| Format | Distribution Location | Network Requirement | Offline Support |
|---|---|---|---|
| **Progressive Web App (PWA)** | Static HTTPS Web Server | Required only for initial visit | Full offline functionality via Service Worker |
| **Native Android App (APK)** | `android/app/build/outputs/apk/` | None | Fully self-contained local assets (`file:///android_asset/`) |
| **Standalone Sender HTML** | `dist-standalone/wavedrop-sender.html` (~55 KB) | None | 100% offline, runnable directly from local filesystem |
| **Standalone Receiver HTML** | `dist-standalone/wavedrop-receiver.html` (~1.3 MB) | Local HTTP/HTTPS server | Embedded WASM, requires secure origin for camera access |

---

## 1. Installing as a Progressive Web App (PWA)

Once loaded over HTTPS, WaveDrop caches all necessary JavaScript bundles, stylesheets, and the WebAssembly decoder module (`zxing_reader.wasm`):

- **Android (Chrome / Edge / Firefox):** Tap the browser menu and select **Install app** or **Add to Home screen**.
- **iOS (Safari):** Tap the **Share** button and select **Add to Home Screen**.

Once installed, the application launches in standalone fullscreen mode and functions with all network interfaces (Wi-Fi, Bluetooth, Cellular) disabled.

---

## 2. Native Android Application Installation

The native Android app embeds the compiled web assets and adds hardware-accelerated CameraX scanning and direct Wi-Fi P2P device pairing:

1. Build the APK locally using Gradle:
   ```bash
   npm run build:android
   cd android && ./gradlew assembleDebug
   ```
2. Install the generated APK on your device:
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

---

## 3. Standalone Single-File Distributions

Generating standalone files:
```bash
npm run build:standalone
```

- `wavedrop-sender.html` can be loaded from any USB drive or filesystem directly via `file://`.
- `wavedrop-receiver.html` inlines the complete 940 KB `zxing` decoder binary as a Base64 data URI. *Note: Modern mobile browsers (iOS Safari, Android Chrome) block camera permissions on `file://` URLs. The receiver HTML must be served over a local HTTP/HTTPS server or opened within desktop browsers.*
