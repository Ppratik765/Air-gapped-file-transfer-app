# System Architecture

WaveDrop is architectured as a multi-tier, air-gapped data transmission engine. It consists of a zero-dependency TypeScript web core, an in-browser WebAssembly decoding pipeline, and a native Kotlin Android wrapper providing hardware-accelerated scanning and direct Wi-Fi P2P connectivity.

---

## 1. Application Layers

```text
+-------------------------------------------------------------------------+
|                              User Interface                             |
|       Home (Cards, App Promo) | Sender (Stream/WebRTC) | Receiver       |
+-------------------------------------------------------------------------+
                                     |
+------------------------------------+------------------------------------+
|                                    |                                    |
v                                    v                                    v
+------------------------+  +------------------------+  +------------------------+
|   Optical Stream Core  |  |  WebRTC Direct Engine  |  |  Native Android Bridge |
| - Fountain Coding (LT) |  | - SDP Prune/Compress   |  | - CameraX & ML-Kit     |
| - QR Module Rasterizer |  | - DataChannel Transfer |  | - Wi-Fi Direct (P2P)   |
| - Frame Capacity Math  |  | - Interactive Focus    |  | - Local Asset Loader   |
+------------------------+  +------------------------+  +------------------------+
            |                            |                           |
            +----------------------------+---------------------------+
                                         |
                                         v
+-------------------------------------------------------------------------+
|                           Shared Protocol Core                          |
|   SHA-256 Verifier | GZIP Compressor | Stream Identity | Worker Pool    |
+-------------------------------------------------------------------------+
                                         |
                                         v
+-------------------------------------------------------------------------+
|                            Execution Runtime                            |
|       Web: Web Workers + WASM (zxing) | Android: JVM + C++ NNAPI        |
+-------------------------------------------------------------------------+
```

---

## 2. Web Application Pages

The web application contains no heavyweight frontend frameworks or state management libraries. Each page is a modular TypeScript application wiring the DOM directly to shared protocol logic:

| Directory | Page Purpose | Entry Point |
|---|---|---|
| `/` | Landing portal, navigation cards, PWA/APK installation prompts, share dialog. | `home/main.ts` |
| `send/` | File and text chunking, Luby transform encoding, WebRTC Offer generation, animated QR canvas rendering. | `send/main.ts` |
| `receive/` | Camera feed capture, WebAssembly QR decoding worker pool, fountain reconstruction, WebRTC Answer generation. | `receive/main.ts`, `receive/worker.ts` |

---

## 3. Shared Protocol Modules (`shared/`)

- `fountain.ts` — Deterministic Luby Transform encoder and peeling decoder. Implements bit-exact IEEE-754 logarithm arithmetic (`dlog`) to prevent cross-engine desynchronization between V8, JavaScriptCore, and SpiderMonkey.
- `protocol.ts` — 20-byte wire-format header serialization/parsing, binary container packing, SHA-256 digest validation, stream identity hashes, and payload limits (64 MB Web / 512 MB Native).
- `webrtc.ts` — Serverless WebRTC signaling pipeline. Performs SDP dictionary pruning, Deflate compression, and DataChannel binary streaming for high-speed local transfer.
- `qr-scanner.ts` — Reusable camera scanner for bidirectional optical signaling handshakes.
- `camera-focus.ts` — Tap-to-focus controller utilizing `MediaStreamTrack.applyConstraints({ advanced: [{ pointsOfInterest }] })` with fallback to native Android focus triggers.
- `worker-pool.ts` — Multi-threaded Web Worker pool managing instances of `zxing-wasm` for parallel video frame decoding.
- `qr-raster.ts` — High-performance QR module matrix to RGBA bitmap rasterizer with crisp non-antialiased pixel rendering.
- `frame-capacity.ts` — QR symbol density and version capacity calculators mapping byte lengths to standard QR versions (Version 1 through 40).
- `display.ts` — Viewport-aware responsive fitting algorithms for sender canvas elements.
- `platform.ts` — Hardware capability probing (torch, focus modes, maximum frame rate) using feature detection over user-agent sniffing.
- `progress.ts` — Mathematical progress model based on unique frame arrival frequency and degree distribution cascade modeling.
- `app-promo.ts` — Context-aware installation banner managing PWA and native APK download states.

---

## 4. Native Android Architecture (`android/`)

The native Android application wraps the offline web assets inside a hardware-accelerated `WebView` while exposing native APIs through `JavascriptInterface` (`AndroidNativeCamera`):

- **Offline Asset Serving:** Web assets are compiled via `npm run build:android` and loaded locally from `file:///android_asset/www/index.html`.
- **CameraX Pipeline:** Manages low-latency camera preview streams using `ProcessCameraProvider` and `ImageAnalysis` with `STRATEGY_KEEP_ONLY_LATEST` backpressure handling.
- **Google ML-Kit Vision:** Replaces in-browser software decoding with native, hardware-accelerated QR barcode scanning via `BarcodeScanning.getClient()`.
- **Wi-Fi Direct Subsystem:** Interfaces with Android's `WifiP2pManager` to discover nearby devices and establish peer-to-peer Wi-Fi Direct groups without external access points.

---

## 5. Build and Inlining Tooling (`build/`)

The build pipeline uses Rollup and Vite plugins designed for strict markup verification:

- `html-tokens.ts` — Inlines dynamic variables (application version, site URL, transfer options) at compile time.
- `root-pwa-head.ts` — Injects Service Worker registrations and validates web manifest links across nested subpaths.
- `rewrite-standalone-links.ts` — Strips external references for zero-dependency single-file HTML distributions.
- `inline-zxing-wasm.ts` & `use-inline-variants.ts` — Embeds the 940 KB WebAssembly decoder binary directly into standalone HTML builds as a Base64 URI.
- `make-icons.ts` — Rasterizes PWA asset icons from SVG source vector graphics.
