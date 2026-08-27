# WaveDrop: Optical & Air-Gapped High-Speed Data Transmission Engine

[![Live Web Application](https://img.shields.io/badge/Live%20Web%20App-wavedrop.vercel.app-0f8e83?style=for-the-badge&logo=vercel)](https://wavedrop.vercel.app)
[![Android APK Release](https://img.shields.io/badge/Android%20APK-v1.0.0%20Release-e68a00?style=for-the-badge&logo=android)](https://github.com/Ppratik765/Air-gapped-file-transfer-app/releases/download/v1.0.0/WaveDrop.apk)
[![Test Suite](https://img.shields.io/badge/Unit%20Tests-80%20Passing-brightgreen?style=for-the-badge)](https://github.com/Ppratik765/Air-gapped-file-transfer-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

WaveDrop is a multi-modal, zero-network data transfer engine engineered to transmit arbitrary binary files and encrypted payloads across physically isolated environments. Operating primarily over optical wavelengths (screen-to-camera) via deterministic rateless erasure codes (Luby Transform), WaveDrop eliminates reliance on radio frequencies, local network routing, external internet connectivity, or intermediary servers.

For high-throughput environments, WaveDrop incorporates an optically-signaled serverless WebRTC direct data channel and a native Kotlin Android subsystem with hardware-accelerated CameraX scanning, `WebViewAssetLoader` local origin virtualization, in-page WebAssembly decoding, and Android `MediaStore` downloads.

---

## Video Demo

https://github.com/user-attachments/assets/3129388d-31e4-493b-9844-d8b3c98cc9de

---

## Table of Contents
1. [Executive Overview](#1-executive-overview)
2. [Live Deployment & Distribution](#2-live-deployment--distribution)
3. [Multi-Modal Transmission Architecture](#3-multi-modal-transmission-architecture)
4. [Mathematical Foundation & Fountain Coding](#4-mathematical-foundation--fountain-coding)
5. [Wire-Format & Container Specification](#5-wire-format--container-specification)
6. [Serverless Optical WebRTC Handshake](#6-serverless-optical-webrtc-handshake)
7. [Native Android Subsystem & Hardware Integration](#7-native-android-subsystem--hardware-integration)
8. [WebAssembly Decoding & Parallel Worker Pool](#8-webassembly-decoding--parallel-worker-pool)
9. [Technology Stack](#9-technology-stack)
10. [Repository Structure](#10-repository-structure)
11. [Installation & Build Pipeline](#11-installation--build-pipeline)
12. [Operational Guides & User Instructions](#12-operational-guides--user-instructions)
13. [Security, Privacy & Cryptographic Integrity](#13-security-privacy--cryptographic-integrity)
14. [Documentation Index](#14-documentation-index)
15. [Similar Projects & Related Work](#15-similar-projects--related-work)
16. [License & Citation](#16-license--citation)

---

## 1. Executive Overview

Modern file transfer mechanisms (AirDrop, Quick Share, Bluetooth, Local Wi-Fi) introduce substantial attack surfaces through radio-frequency broadcast protocols, IP stack discovery, and operating system pairing handshakes. WaveDrop re-evaluates physical data transfer by establishing visual light communication channels between modern display hardware and digital optical sensors.

Key engineering capabilities include:
- **Physical Air-Gap Isolation:** Payloads are serialized entirely into structured photonic pulses (animated high-density QR matrices), requiring no RF transceiver activation.
- **Rateless Fountain Code Resilience:** Luby Transform erasure coding guarantees complete file reconstruction from any arbitrary subset of $(1 + \epsilon) \cdot K$ droplets, mitigating frame dropping, blur, and frame rate desynchronization without a reverse acknowledgment channel.
- **Serverless Optical Signaling:** High-capacity transfers transition seamlessly to peer-to-peer WebRTC DataChannels by exchanging compressed Session Description Protocol (SDP) tokens optically, bypassing STUN/TURN and signaling servers.
- **Zero-Dependency Portable Footprint:** Pure TypeScript web implementation compiled with WebAssembly (`zxing-wasm`) and distributed as a Progressive Web App, single-file zero-dependency HTML bundles, or a native Kotlin Android application.
- **Cryptographic Verification:** End-to-end payload validation utilizing embedded SHA-256 cryptographic digests before presentation to the filesystem.

---

## 2. Live Deployment & Distribution

| Channel | Access Link | Description |
|---|---|---|
| **Production Web App** | [wavedrop.vercel.app](https://wavedrop.vercel.app) | Live production PWA deployment. Works in mobile and desktop browsers. |
| **Direct APK Release** | [Download WaveDrop.apk (v1.0.0)](https://github.com/Ppratik765/Air-gapped-file-transfer-app/releases/download/v1.0.0/WaveDrop.apk) | Standalone native Android package with hardware-accelerated camera and direct downloads. |
| **Source Code** | [GitHub Repository](https://github.com/Ppratik765/Air-gapped-file-transfer-app) | Full open-source TypeScript, WebAssembly, and Kotlin codebase. |

---

## 3. Multi-Modal Transmission Architecture

WaveDrop operates across three primary transmission tiers, balancing physical security, channel isolation, and bandwidth:

```text
+-----------------------------------------------------------------------------------+
|                               WaveDrop Core Engine                                |
+-----------------------------------------------------------------------------------+
         |                                  |                                  |
         v                                  v                                  v
+------------------+              +-------------------+              +------------------+
|  Tier 1: Optical |              |  Tier 2: Optical  |              | Tier 3: Android  |
|  Fountain Stream |              |  WebRTC Direct    |              | Native Subsystem |
+------------------+              +-------------------+              +------------------+
| - 100% Air-Gapped|              | - Optical Handshake|             | - AssetLoader    |
| - Simplex Light  |              | - Direct P2P RTC  |              | - FileChooser    |
| - Luby Transform |              | - Zero Signaling  |              | - In-Page Camera |
| - Up to 64 MB    |              | - Up to 512 MB    |              | - MediaStore Save|
| - Default 30 FPS |              | - 10-50 MB/s Rate |              | - Share Sheet    |
+------------------+              +-------------------+              +------------------+
```

1. **Tier 1: Pure Optical Fountain Stream:** Transmits data unidirectionally as light. Suitable for high-security environments, air-gapped terminals, and foreign device transfers without network pairing. Defaults to 30 FPS for universal cross-device stability.
2. **Tier 2: Optically-Signaled WebRTC:** Uses single-frame QR visual scans to exchange pruned, Deflate-compressed SDP Offer/Answer tokens with camera autofocus reticles. Establishes a direct peer-to-peer `RTCDataChannel` over local network subnets with zero cloud dependencies.
3. **Tier 3: Android Native Integration:** Utilizes `WebViewAssetLoader` over secure local virtual origins (`https://appassets.androidplatform.net/assets/www/`), `WebChromeClient.onShowFileChooser` for native file picking, unified in-page WASM camera decoding with live HUD diagnostics, and `MediaStore.Downloads` saving.

---

## 4. Mathematical Foundation & Fountain Coding

### 4.1 The Simplex Erasure Channel Problem
In an optical screen-to-camera link, no reverse feedback channel exists. The receiver cannot transmit packet acknowledgments (ACK/NACK), and individual frames are frequently lost due to rolling shutter distortion, motion blur, and exposure latency. Sequential looping mechanisms suffer from the coupon collector's problem, resulting in unbounded transfer delays.

### 4.2 Luby Transform (LT) Coding
WaveDrop segments an input payload of $M$ bytes into $K$ source blocks of length $L$ bytes ($K = \lceil M / L \rceil$). The encoder constructs an infinite stream of encoded droplets $F_s$, where each droplet is the bitwise XOR sum of a pseudo-random block subset $S_s$:

$$F_s = \bigoplus_{i \in S_s} B_i$$

The subset size $d = |S_s|$ (the degree of the droplet) is sampled from a **Robust Soliton Distribution** $\mu(d)$.

### 4.3 Robust Soliton Distribution Formulation
The ideal soliton distribution $\rho(d)$ is formulated to yield an expected ripple size of 1 throughout peeling decoding:

$$\rho(1) = \frac{1}{K}$$
$$\rho(d) = \frac{1}{d(d-1)} \quad \text{for } d = 2, 3, \dots, K$$

To prevent premature termination of the decoding ripple due to stochastic variance, the robust adjustment $\tau(d)$ is introduced:

$$\tau(d) = \begin{cases} \frac{R}{d \cdot K} & \text{for } d = 1, 2, \dots, \frac{K}{R} - 1 \\ \frac{R \ln(R/\delta)}{K} & \text{for } d = \frac{K}{R} \\ 0 & \text{for } d > \frac{K}{R} \end{cases}$$

where $R = c \cdot \ln(K/\delta)\sqrt{K}$, with tuning parameters $c = 0.1$ and $\delta = 0.5$. The normalized cumulative probability distribution $\mu(d)$ is computed as:

$$\beta = \sum_{d=1}^K (\rho(d) + \tau(d)), \quad \mu(d) = \frac{\rho(d) + \tau(d)}{\beta}$$

### 4.4 Bit-Exact Cross-Platform Logarithm (`dlog`)
Standard JavaScript `Math.log` implementations diverge across V8, JavaScriptCore, and SpiderMonkey engines at the least significant bits due to host CPU architecture approximations. Because the PRNG subset selection relies on floating-point CDF thresholds, minor arithmetic variations cause complete sender/receiver desynchronization.

WaveDrop implements `dlog`, a bit-exact natural logarithm function conforming strictly to IEEE-754 binary64 arithmetic across all platforms.

---

## 5. Wire-Format & Container Specification

### 5.1 20-Byte Packet Header
Each optical frame payload is prefixed with a 20-byte Big-Endian binary header:

```text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                          Session ID                           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        Sequence Number                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Block Count          |          Block Length         |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         Total Length                          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         Payload Hash                          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                     Encoded Droplet Payload                   |
|                             ...                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

| Field | Type | Description |
|---|---|---|
| **Session ID** | `uint32` | Ephemeral transmission identifier; resets receiver state upon parameter reconfiguration. |
| **Sequence Number** | `uint32` | Monotonically incrementing index seeding the PRNG subset generator. |
| **Block Count ($K$)** | `uint16` | Total logical blocks composing the complete unencoded payload. |
| **Block Length ($L$)** | `uint16` | Byte length of individual payload blocks. |
| **Total Length** | `uint32` | Total byte size of the encapsulated container. |
| **Payload Hash** | `uint32` | Integrity checksum across container metadata. |

### 5.2 Payload Encapsulation & SHA-256 Validation
Reconstructed payloads adhere to the internal container structure:
1. `flags (uint8)`: Bitmask encoding compression status (`0x01` for GZIP/Deflate).
2. `filename_length (uint16)` and `filename (UTF-8)`.
3. `mime_type_length (uint16)` and `mime_type (UTF-8)`.
4. `sha256_digest (32 bytes)`: Cryptographic hash of the source file.
5. `payload_data`: The raw or compressed binary stream.

---

## 6. Serverless Optical WebRTC Handshake

For large payloads (up to 512 MB), WaveDrop implements a serverless optical signaling protocol that establishes peer-to-peer WebRTC connections without third-party signaling infrastructure:

```text
[ Sender Node ]                                      [ Receiver Node ]
       |                                                     |
       |  1. Construct RTCPeerConnection                     |
       |  2. Generate SDP Offer with host ICE                |
       |  3. Prune & Compress SDP (trimSdp + Deflate)        |
       |  4. Render Offer QR Matrix (Scale 8, Margin 4)      |
       |=================== Visual Optical Scan =============>|
       |                                                     |  5. Decode Offer QR (Autofocus)
       |                                                     |  6. Set Remote Description
       |                                                     |  7. Generate SDP Answer
       |                                                     |  8. Prune & Compress Answer
       |                                                     |  9. Render Answer QR Matrix
       |<================== Visual Optical Scan =============|
       |                                                     |
       |  10. Decode Answer QR & Set Remote Description      |
       |  11. Open Bidirectional RTCDataChannel              |
       |====================================================>|
       |  12. High-Throughput Binary Stream (10 - 50 MB/s)   |
```

### 6.1 SDP Pruning and Deflate Compression
Standard SDP tokens span 1.5–2.5 KB, exceeding instantaneous QR scan capacity. WaveDrop applies aggressive dictionary pruning (`shared/webrtc.ts`):
- Strips audio/video tracks, preserving only SCTP `m=application` DataChannels.
- Prunes server-reflexive (srflx) and relay (relay) ICE candidates, retaining exclusively local `host` candidates.
- Compresses the normalized string using raw Deflate algorithms and encodes it with a versioned URI identifier (`wd1:o:` for Offers, `wd1:a:` for Answers).

---

## 7. Native Android Subsystem & Hardware Integration

The native Android container (`android/`) bridges web technologies with hardware-accelerated mobile primitives:

```text
+----------------------------------------------------------------------+
|                     Android Native Container                         |
+----------------------------------------------------------------------+
|  +----------------------------------------------------------------+  |
|  |                 WebView (WebViewAssetLoader)                   |  |
|  |  Serves: https://appassets.androidplatform.net/assets/www/     |  |
|  +----------------------------------------------------------------+  |
|                                 |                                    |
|              JavascriptInterface ("AndroidNativeCamera")             |
|                                 |                                    |
|  +--------------------------+  +----------------------------------+  |
|  |   Native Bridge Services |  |        System Integrations       |  |
|  | - onShowFileChooser      |  | - MediaStore.Downloads Saving    |  |
|  | - onPermissionRequest    |  | - FileProvider ACTION_SEND Share |  |
|  | - In-Page Camera WASM    |  | - Android 14+ Target (API 34)    |  |
|  +--------------------------+  +----------------------------------+  |
+----------------------------------------------------------------------+
```

- **`WebViewAssetLoader` Architecture:** Replaced legacy `file:///` protocols with secure virtual origin domain handling (`https://appassets.androidplatform.net/assets/www/`), enabling ES module resolution, WebAssembly compilation, and internal routing.
- **Native File Picker (`WebChromeClient.onShowFileChooser`):** Handles single and multi-file selection through `ActivityResultContracts.StartActivityForResult`, allowing file selection across both optical and WebRTC modes.
- **Unified In-Page Camera:** Seamlessly grants `PermissionRequest.RESOURCE_VIDEO_CAPTURE` and `android.permission.CAMERA`, executing WebAssembly ZXing decoding directly inside the page viewport with full real-time metrics and HUD telemetry.
- **Direct Downloads & Sharing:** Saves received files directly into the Android `Downloads` directory via `MediaStore.Downloads` on API 29+ and provides native Android system share sheet forwarding via `FileProvider`.

---

## 8. WebAssembly Decoding & Parallel Worker Pool

In standard browser environments lacking native BarcodeDetector APIs (e.g., Safari WebKit), WaveDrop executes a high-performance WebAssembly decoding pipeline:

- **WASM Decoder Core:** Powered by `zxing-cpp` compiled to WebAssembly (`zxing-wasm`), embedded at ~940 KB.
- **Multi-Threaded Worker Pool (`shared/worker-pool.ts`):** Distributes incoming camera frames across parallel Web Workers. If all worker threads are occupied, incoming video frames are dropped at zero algorithmic cost—the Luby Transform absorbs dropped frames without degradation.
- **Pixel-Perfect Canvas Rasterizer:** Uses `shared/qr-raster.ts` to map boolean module matrices directly to RGBA `ImageData` buffers with nearest-neighbor integer scaling, maximizing visual contrast on OLED and LCD displays.

---

## 9. Technology Stack

- **Web Core:** HTML5, Modern Vanilla CSS, TypeScript.
- **Module Bundling & Build:** Vite 6, Rollup.
- **Decoders & Codecs:** `zxing-wasm` (WebAssembly C++ port), `node-qrcode`, Pako Deflate.
- **Animations:** GSAP (GreenSock Animation Platform) for responsive UI transitions.
- **Android Native Layer:** Kotlin, Android Jetpack, `WebViewAssetLoader`, `FileProvider`, `MediaStore`.
- **Testing & Quality Assurance:** Node.js native test runner (`node --test`), TypeScript Compiler (`tsc`).

---

## 10. Repository Structure

```text
WaveDrop/
├── android/                               # Native Android application container
│   ├── app/
│   │   ├── build.gradle.kts               # App-level build configuration & dependencies (Java 17)
│   │   └── src/main/
│   │       ├── AndroidManifest.xml        # Permissions: Camera, FileProvider, Internet
│   │       ├── assets/www/                # Offline web assets synced via build scripts
│   │       ├── res/xml/file_paths.xml     # FileProvider paths for cache & downloads sharing
│   │       └── java/com/wavedrop/app/
│   │           └── MainActivity.kt        # WebViewAssetLoader, file chooser, and native bridge
│   ├── build.gradle.kts                   # Project-level Gradle build configuration
│   └── settings.gradle.kts                # Gradle module settings
├── build/                                 # Vite and Rollup compilation plugins
│   ├── build-android-assets.js            # Syncs compiled dist/ assets to Android app
│   ├── html-tokens.ts                     # Build-time variable substitutions
│   ├── inline-zxing-wasm.ts               # Base64 inlining for standalone builds
│   ├── make-icons.ts                      # PWA icon generation script
│   └── root-pwa-head.ts                   # Service worker injection and validation
├── docs/                                  # Comprehensive technical and user manuals
│   ├── technical/                         # Architecture, protocol, quirks, build docs
│   ├── user/                              # Quick start, sending, receiving, privacy docs
│   └── README.md                          # Documentation index
├── home/                                  # Landing page entry point and controllers
│   └── main.ts                            # Portal routing, promo dialogs, PWA install
├── receive/                               # Receiver page application
│   ├── index.html                         # Receiver DOM layout & video viewport
│   ├── main.ts                            # Optical peeling decoder, WebRTC Answer logic
│   └── worker.ts                          # Web Worker WebAssembly decode thread
├── send/                                  # Sender page application
│   ├── index.html                         # Sender DOM layout & canvas stages
│   └── main.ts                            # LT encoder, QR stream generator, WebRTC Offer
├── shared/                                # Core protocol logic & cross-platform utilities
│   ├── app-promo.ts                       # Native app install prompt & reload/session state
│   ├── camera-focus.ts                    # MediaStreamTrack tap-to-focus controller
│   ├── display.ts                         # Viewport-aware responsive fitting
│   ├── format.ts                          # Byte and transfer rate formatting
│   ├── fountain.ts                        # Luby Transform encoder, decoder, dlog math
│   ├── platform.ts                        # Hardware capability and feature detection
│   ├── protocol.ts                        # 20-byte wire header, container verification
│   ├── qr-raster.ts                       # Raw QR module to RGBA bitmap rasterizer
│   ├── webrtc.ts                          # SDP compression, pruning, DataChannel stream
│   └── worker-pool.ts                     # Multi-threaded Web Worker pool manager
├── tests/                                 # Comprehensive unit and wire-format test suites
│   ├── app-promo.test.ts                  # App promo banner release path & semver tests
│   ├── fountain.test.ts                   # LT Soliton distribution & peeling decoder tests
│   ├── protocol.test.ts                   # Wire header serialization & SHA-256 validation
│   ├── webrtc.test.ts                     # SDP pruning & Deflate roundtrip verification
│   └── worker-pool.test.ts                # Concurrency and worker pool resize tests
├── index.html                             # Root web portal entry point
├── package.json                           # NPM dependencies, scripts, and metadata
├── tsconfig.json                          # TypeScript configuration for web core
└── README.md                              # Repository documentation master
```

---

## 11. Installation & Build Pipeline

### 11.1 Prerequisites
- **Node.js:** Version 20.x or higher
- **Package Manager:** `npm` Version 10.x or higher
- **Android Development (Optional):** Android Studio / Android SDK (API 34), JDK 17

### 11.2 Local Development Setup
```bash
# Clone the repository
git clone https://github.com/Ppratik765/Air-gapped-file-transfer-app.git
cd Air-gapped-file-transfer-app

# Install project dependencies
npm install

# Start local HTTPS development server
npm run dev
```

Open `https://localhost:5173/send/` on the transmitting machine and navigate to the printed network address (`https://<lan-ip>:5173/receive/`) on the receiving device.

### 11.3 Compilation Commands
```bash
npm test                  # Execute 80+ unit and wire-format validation tests
npm run build             # Compile production web application into dist/
npm run build:standalone  # Compile zero-dependency single-file HTML builds into dist-standalone/
npm run build:android     # Compile web assets and sync directly to Android assets
npm run build:all         # Compile both hosted site and standalone distributions
```

### 11.4 Android APK Compilation
```bash
# Compile and sync latest web assets
npm run build:android

# Build Debug or Release APK using Gradle
cd android
./gradlew assembleDebug      # Output: app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease    # Output: app/build/outputs/apk/release/app-release-unsigned.apk
```

---

## 12. Operational Guides & User Instructions

### 12.1 Optical Fountain Transfer (Air-Gapped Mode)
1. **Transmitter:** Navigate to **Send** $\rightarrow$ **File** (up to 64 MB) or **Text snippet**. Set screen brightness to 100%. Click the QR code to toggle Fullscreen mode for maximum scanning distance.
2. **Receiver:** Navigate to **Receive** $\rightarrow$ Tap **Start camera**. Align the camera with the sender's display.
3. **Completion:** The progress bar tracks verified unique frames. Once all $K$ blocks are resolved, the SHA-256 integrity check validates the payload and renders the download/preview UI.

### 12.2 WebRTC High-Speed Direct Transfer
1. **Transmitter:** On the **Send** page, click **WebRTC Mode** and select a file (up to 512 MB). The screen displays the compressed SDP Offer QR.
2. **Receiver:** On the **Receive** page, switch to **WebRTC Mode** and tap **Scan Sender Offer**. Align the camera with the Offer QR.
3. **Handshake:** The receiver renders an SDP Answer QR. Tap **Scan Receiver Answer** on the sender to complete the optical handshake.
4. **Transfer:** The binary stream completes over the direct peer-to-peer data channel at full hardware speed.

---

## 13. Security, Privacy & Cryptographic Integrity

- **Zero RF Broadcast in Optical Mode:** In pure optical mode, Bluetooth, Wi-Fi, and cellular radios remain idle. Data travels exclusively via photonic emission.
- **No Cloud Dependencies:** WaveDrop operates with zero external signaling servers, telemetry trackers, or cloud analytics.
- **Physical Channel Openness:** Optical streams are unencrypted by design: any sensor with direct visual line-of-sight can decode the stream. WaveDrop guarantees physical network isolation (air-gapping), not visual confidentiality.
- **Cryptographic Verification:** Every file container embeds a 32-byte SHA-256 hash. Corrupted or partially resolved payloads are rejected automatically.
- **Volatile Storage Lifecycle:** Text snippets reside exclusively in memory. Received media staged in the browser Cache API can be purged immediately via **Clear WaveDrop cache**.

---

## 14. Documentation Index

Detailed sub-specifications and technical deep-dives are available in the `docs/` directory:

- [System Architecture](docs/technical/architecture.md) — Module decoupling, DOM integration, and execution pipeline.
- [Protocol Specification](docs/technical/protocol.md) — Robust Soliton mathematics, 20-byte packet headers, and SDP compression.
- [Platform Quirks](docs/technical/platform-quirks.md) — Safari 26 liquid glass fixes, iOS frame rate workarounds, and CameraX lifecycle binding.
- [Build & Release](docs/technical/build-and-release.md) — Compilation plugins, standalone inlining, and CI workflows.
- [Quick Start Guide](docs/user/quick-start.md) — Operational instructions for rapid onboarding.
- [Sending Data](docs/user/sending.md) — Transmitter parameter tuning and density configuration.
- [Receiving Data](docs/user/receiving.md) — Camera alignment, live telemetry, and verification.
- [Installation & Offline](docs/user/install-and-offline.md) — PWA caching, APK installation, and standalone usage.
- [Troubleshooting](docs/user/troubleshooting.md) — Decode diagnostic trees and camera resolution guides.
- [Privacy & Security](docs/user/privacy.md) — Cryptographic posture, air-gap guarantees, and cache management.

---

## 15. Similar Projects & Related Work

The concepts implemented in WaveDrop draw inspiration from foundational research in erasure coding and visual data transmission:

- [mohankumarelec/airgapped-qr-code-transfer](https://github.com/mohankumarelec/airgapped-qr-code-transfer): Browser-based QR file transfer with compression and sequential chunking.
- [divan/txqr](https://github.com/divan/txqr): Animated QR transmission leveraging Luby Transform fountain codes in Go.
- [sz3/libcimbar](https://github.com/sz3/libcimbar): High-density visual data transmission utilizing custom color-coded modulation matrices.

---

## 16. License & Citation

Authored and engineered by [Priyanshu Pratik](https://github.com/Ppratik765).

This software is released under the [MIT License](LICENSE).
