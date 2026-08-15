# WaveDrop: Optical & Air-Gapped High-Speed Data Transmission Engine

WaveDrop is a multi-modal, zero-network data transfer engine engineered to transmit arbitrary binary files and encrypted payloads across physically isolated environments. Operating primarily over optical wavelengths (screen-to-camera) via deterministic rateless erasure codes (Luby Transform), WaveDrop eliminates reliance on radio frequencies, local network routing, external internet connectivity, or intermediary servers.

For high-throughput environments, WaveDrop incorporates an optical-signaled WebRTC direct data channel and a native Kotlin Android subsystem with hardware-accelerated CameraX scanning and peer-to-peer Wi-Fi Direct mesh formation.

---

## Table of Contents
1. [Executive Overview](#1-executive-overview)
2. [Multi-Modal Transmission Architecture](#2-multi-modal-transmission-architecture)
3. [Mathematical Foundation & Fountain Coding](#3-mathematical-foundation--fountain-coding)
4. [Wire-Format & Container Specification](#4-wire-format--container-specification)
5. [Serverless Optical WebRTC Handshake](#5-serverless-optical-webrtc-handshake)
6. [Native Android Subsystem & Hardware Integration](#6-native-android-subsystem--hardware-integration)
7. [WebAssembly Decoding & Parallel Worker Pool](#7-webassembly-decoding--parallel-worker-pool)
8. [Technology Stack](#8-technology-stack)
9. [Repository Structure](#9-repository-structure)
10. [Installation & Build Pipeline](#10-installation--build-pipeline)
11. [Operational Guides & User Instructions](#11-operational-guides--user-instructions)
12. [Security, Privacy & Cryptographic Integrity](#12-security-privacy--cryptographic-integrity)
13. [Documentation Index](#13-documentation-index)
14. [Similar Projects & Related Work](#14-similar-projects--related-work)
15. [License & Citation](#15-license--citation)

---

## 1. Executive Overview

Modern file transfer mechanisms (AirDrop, Quick Share, Bluetooth, Local Wi-Fi) introduce substantial attack surfaces through radio-frequency broadcast protocols, IP stack discovery, and operating system pairing handshakes. WaveDrop re-evaluates physical data transfer by establishing visual light communication channels between modern display hardware and digital optical sensors.

Key engineering capabilities include:
- **Physical Air-Gap Isolation:** Payloads are serialized entirely into structured photonic pulses (animated high-density QR matrices), requiring no RF transceiver activation.
- **Rateless Fountain Code Resilience:** Luby Transform erasure coding guarantees complete file reconstruction from any arbitrary subset of $(1 + \epsilon) \cdot K$ droplets, mitigating frame dropping, blur, and frame rate desynchronization without a reverse acknowledgment channel.
- **Serverless Optical Signaling:** High-capacity transfers transition seamlessly to peer-to-peer WebRTC DataChannels by exchanging compressed Session Description Protocol (SDP) tokens optically, bypassing STUN/TURN and signaling servers.
- **Zero-Dependency Portable Footprint:** Pure TypeScript web implementation compiled with WebAssembly (`zxing-wasm`) and distributed as a Progressive Web App, single-file zero-dependency HTML bundles, or a native Kotlin Android application with Google ML-Kit.
- **Cryptographic Verification:** End-to-end payload validation utilizing embedded SHA-256 cryptographic digests before presentation to the filesystem.

---

## 2. Multi-Modal Transmission Architecture

WaveDrop operates across three primary transmission tiers, balancing physical security, channel isolation, and bandwidth:

```text
+-----------------------------------------------------------------------------------+
|                               WaveDrop Core Engine                                |
+-----------------------------------------------------------------------------------+
         |                                  |                                  |
         v                                  v                                  v
+------------------+              +-------------------+              +------------------+
|  Tier 1: Optical |              |  Tier 2: Optical  |              | Tier 3: Android  |
|  Fountain Stream |              |  WebRTC Direct    |              | Wi-Fi Direct P2P |
+------------------+              +-------------------+              +------------------+
| - 100% Air-Gapped|              | - Optical Handshake|             | - Zero-Router P2P|
| - Simplex Light  |              | - Direct P2P RTC  |              | - Hardware Mesh  |
| - Luby Transform |              | - Zero Signaling  |              | - CameraX/MLKit  |
| - Up to 64 MB    |              | - Up to 512 MB    |              | - Native JVM/C++ |
| - 128 KB/s Rate  |              | - 10-50 MB/s Rate |              | - Background P2P |
+------------------+              +-------------------+              +------------------+
```

1. **Tier 1: Pure Optical Fountain Stream:** Transmits data unidirectionally as light. Suitable for high-security environments, air-gapped terminals, and foreign device transfers without network pairing.
2. **Tier 2: Optically-Signaled WebRTC:** Uses single-frame QR visual scans to exchange pruned, Deflate-compressed SDP Offer/Answer tokens. Establishes a direct peer-to-peer `RTCDataChannel` over local network subnets with zero cloud dependencies.
3. **Tier 3: Android Wi-Fi Direct Mesh:** Employs Android's `WifiP2pManager` to form autonomous Wi-Fi P2P groups when no local network infrastructure exists, bridging WebRTC high-speed transfers without external routers.

---

## 3. Mathematical Foundation & Fountain Coding

### 3.1 The Simplex Erasure Channel Problem
In an optical screen-to-camera link, no reverse feedback channel exists. The receiver cannot transmit packet acknowledgments (ACK/NACK), and individual frames are frequently lost due to rolling shutter distortion, motion blur, and exposure latency. Sequential looping mechanisms suffer from the coupon collector's problem, resulting in unbounded transfer delays.

### 3.2 Luby Transform (LT) Coding
WaveDrop segments an input payload of $M$ bytes into $K$ source blocks of length $L$ bytes ($K = \lceil M / L \rceil$). The encoder constructs an infinite stream of encoded droplets $F_s$, where each droplet is the bitwise XOR sum of a pseudo-random block subset $S_s$:

$$F_s = \bigoplus_{i \in S_s} B_i$$

The subset size $d = |S_s|$ (the degree of the droplet) is sampled from a **Robust Soliton Distribution** $\mu(d)$.

### 3.3 Robust Soliton Distribution Formulation
The ideal soliton distribution $\rho(d)$ is formulated to yield an expected ripple size of 1 throughout peeling decoding:

$$\rho(1) = \frac{1}{K}$$
$$\rho(d) = \frac{1}{d(d-1)} \quad \text{for } d = 2, 3, \dots, K$$

To prevent premature termination of the decoding ripple due to stochastic variance, the robust adjustment $\tau(d)$ is introduced:

$$\tau(d) = \begin{cases} \frac{R}{d \cdot K} & \text{for } d = 1, 2, \dots, \frac{K}{R} - 1 \\ \frac{R \ln(R/\delta)}{K} & \text{for } d = \frac{K}{R} \\ 0 & \text{for } d > \frac{K}{R} \end{cases}$$

where $R = c \cdot \ln(K/\delta)\sqrt{K}$, with tuning parameters $c = 0.1$ and $\delta = 0.5$. The normalized cumulative probability distribution $\mu(d)$ is computed as:

$$\beta = \sum_{d=1}^K (\rho(d) + \tau(d)), \quad \mu(d) = \frac{\rho(d) + \tau(d)}{\beta}$$

### 3.4 Bit-Exact Cross-Platform Logarithm (`dlog`)
Standard JavaScript `Math.log` implementations diverge across V8, JavaScriptCore, and SpiderMonkey engines at the least significant bits due to host CPU architecture approximations. Because the PRNG subset selection relies on floating-point CDF thresholds, minor arithmetic variations cause complete sender/receiver desynchronization.

WaveDrop implements `dlog`, a bit-exact natural logarithm function conforming strictly to IEEE-754 binary64 arithmetic across all platforms.

---

## 4. Wire-Format & Container Specification

### 4.1 20-Byte Packet Header
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

### 4.2 Payload Encapsulation & SHA-256 Validation
Reconstructed payloads adhere to the internal container structure:
1. `flags (uint8)`: Bitmask encoding compression status (`0x01` for GZIP/Deflate).
2. `filename_length (uint16)` and `filename (UTF-8)`.
3. `mime_type_length (uint16)` and `mime_type (UTF-8)`.
4. `sha256_digest (32 bytes)`: Cryptographic hash of the source file.
5. `payload_data`: The raw or compressed binary stream.

---

## 5. Serverless Optical WebRTC Handshake

For large payloads (up to 512 MB), WaveDrop implements a serverless optical signaling protocol that establishes peer-to-peer WebRTC connections without third-party signaling infrastructure:

```text
[ Sender Node ]                                      [ Receiver Node ]
       |                                                     |
       |  1. Construct RTCPeerConnection                     |
       |  2. Generate SDP Offer with host ICE                |
       |  3. Prune & Compress SDP (trimSdp + Deflate)        |
       |  4. Render Offer QR Matrix                          |
       |=================== Visual Optical Scan =============>|
       |                                                     |  5. Decode Offer QR
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

### 5.1 SDP Pruning and Deflate Compression
Standard SDP tokens span 1.5–2.5 KB, exceeding instantaneous QR scan capacity. WaveDrop applies aggressive dictionary pruning (`shared/webrtc.ts`):
- Strips audio/video tracks, preserving only SCTP `m=application` DataChannels.
- Prunes server-reflexive (srflx) and relay (relay) ICE candidates, retaining exclusively local `host` candidates.
- Compresses the normalized string using raw Deflate algorithms and encodes it with a versioned URI identifier (`wd1:o:` for Offers, `wd1:a:` for Answers).

---

## 6. Native Android Subsystem & Hardware Integration

The native Android wrapper (`android/`) bridges Web technologies with hardware-accelerated mobile primitives:

```text
+----------------------------------------------------------------------+
|                     Android Native Container                         |
+----------------------------------------------------------------------+
|  +----------------------------------------------------------------+  |
|  |                 WebView (Offline Asset Engine)                 |  |
|  |  Loads: file:///android_asset/www/index.html (Zero Network)    |  |
|  +----------------------------------------------------------------+  |
|                                 |                                    |
|              JavascriptInterface ("AndroidNativeCamera")             |
|                                 |                                    |
|  +--------------------------+  +----------------------------------+  |
|  |     CameraX Pipeline     |  |       Wi-Fi Direct Engine        |  |
|  | - ProcessCameraProvider  |  | - WifiP2pManager / Channel       |  |
|  | - ImageAnalysis Executor |  | - Autonomous Group Formation     |  |
|  | - ML-Kit Barcode Scanner |  | - Broadcast Receiver Lifecycle   |  |
|  +--------------------------+  +----------------------------------+  |
+----------------------------------------------------------------------+
```

- **Offline Asset Pipeline:** Web assets compiled via `npm run build:android` are packaged directly into `src/main/assets/www/` for local execution without HTTP server dependencies.
- **CameraX & ML-Kit Vision:** Android camera frames are captured using CameraX `ImageAnalysis` with `STRATEGY_KEEP_ONLY_LATEST` backpressure. Frames are processed via Google ML-Kit Barcode Scanning in native C++/NNAPI runtimes, streaming decoded bytes directly into JavaScript.
- **Autonomous Wi-Fi Direct Mesh:** When no local router exists, `MainActivity.kt` uses `WifiP2pManager` to discover nearby devices and form high-speed P2P Wi-Fi connections programmatically.

---

## 7. WebAssembly Decoding & Parallel Worker Pool

In standard browser environments lacking native BarcodeDetector APIs (e.g., Safari WebKit), WaveDrop executes a high-performance WebAssembly decoding pipeline:

- **WASM Decoder Core:** Powered by `zxing-cpp` compiled to WebAssembly (`zxing-wasm`), embedded at ~940 KB.
- **Multi-Threaded Worker Pool (`shared/worker-pool.ts`):** Distributes incoming camera frames across parallel Web Workers. If all worker threads are occupied, incoming video frames are dropped at zero algorithmic cost—the Luby Transform absorbs dropped frames without degradation.
- **Pixel-Perfect Canvas Rasterizer:** Uses `shared/qr-raster.ts` to map boolean module matrices directly to RGBA `ImageData` buffers with nearest-neighbor integer scaling, maximizing visual contrast on OLED and LCD displays.

---

## 8. Technology Stack

- **Web Core:** HTML5, Modern Vanilla CSS, TypeScript.
- **Module Bundling & Build:** Vite 6, Rollup.
- **Decoders & Codecs:** `zxing-wasm` (WebAssembly C++ port), `node-qrcode`, Pako Deflate.
- **Animations:** GSAP (GreenSock Animation Platform) for responsive UI transitions.
- **Android Native Layer:** Kotlin, Android Jetpack, CameraX, Google ML-Kit Vision API, Android `WifiP2pManager`.
- **Testing & Quality Assurance:** Node.js native test runner (`node --test`), TypeScript Compiler (`tsc`).

---

## 9. Repository Structure

```text
WaveDrop/
├── android/                               # Native Android application container
│   ├── app/
│   │   ├── build.gradle.kts               # App-level build configuration & dependencies
│   │   └── src/main/
│   │       ├── AndroidManifest.xml        # Permissions: Camera, Wi-Fi Direct, Nearby Devices
│   │       ├── assets/www/                # Offline web assets synced via build scripts
│   │       └── java/com/wavedrop/app/
│   │           └── MainActivity.kt        # CameraX, ML-Kit, WebView, and Wi-Fi P2P logic
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
│   ├── app-promo.ts                       # Native app and PWA install prompt state
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

## 10. Installation & Build Pipeline

### 10.1 Prerequisites
- **Node.js:** Version 20.x or higher
- **Package Manager:** `npm` Version 10.x or higher
- **Android Development (Optional):** Android Studio / Android SDK (API 34), JDK 17

### 10.2 Local Development Setup
```bash
# Clone the repository
git clone https://github.com/Ppratik765/Offline-file-transfer-app.git
cd Offline-file-transfer-app

# Install project dependencies
npm install

# Start local HTTPS development server
npm run dev
```

Open `https://localhost:5173/send/` on the transmitting machine and navigate to the printed network address (`https://<lan-ip>:5173/receive/`) on the receiving device.

### 10.3 Compilation Commands
```bash
npm test                  # Execute 78+ unit and wire-format validation tests
npm run build             # Compile production web application into dist/
npm run build:standalone  # Compile zero-dependency single-file HTML builds into dist-standalone/
npm run build:android     # Compile web assets and sync directly to Android assets
npm run build:all         # Compile both hosted site and standalone distributions
```

### 10.4 Android APK Compilation
```bash
# Compile and sync latest web assets
npm run build:android

# Build Debug or Release APK using Gradle
cd android
./gradlew assembleDebug      # Output: app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease    # Output: app/build/outputs/apk/release/app-release-unsigned.apk
```

---

## 11. Operational Guides & User Instructions

### 11.1 Optical Fountain Transfer (Air-Gapped Mode)
1. **Transmitter:** Navigate to **Send** $\rightarrow$ **File** (up to 64 MB) or **Text snippet**. Set screen brightness to 100%. Click the QR code to toggle Fullscreen mode for maximum scanning distance.
2. **Receiver:** Navigate to **Receive** $\rightarrow$ Tap **Start camera**. Align the camera with the sender's display.
3. **Completion:** The progress bar tracks verified unique frames. Once all $K$ blocks are resolved, the SHA-256 integrity check validates the payload and renders the download/preview UI.

### 11.2 WebRTC High-Speed Direct Transfer
1. **Transmitter:** On the **Send** page, click **WebRTC Mode** and select a file (up to 512 MB). The screen displays the compressed SDP Offer QR.
2. **Receiver:** On the **Receive** page, switch to **WebRTC Mode** and tap **Scan Sender Offer**. Align the camera with the Offer QR.
3. **Handshake:** The receiver renders an SDP Answer QR. Tap **Scan Receiver Answer** on the sender to complete the optical handshake.
4. **Transfer:** The binary stream completes over the direct peer-to-peer data channel at full hardware speed.

---

## 12. Security, Privacy & Cryptographic Integrity

- **Zero RF Broadcast in Optical Mode:** In pure optical mode, Bluetooth, Wi-Fi, and cellular radios remain idle. Data travels exclusively via photonic emission.
- **No Cloud Dependencies:** WaveDrop operates with zero external signaling servers, telemetry trackers, or cloud analytics.
- **Physical Channel Openness:** Optical streams are unencrypted by design: any sensor with direct visual line-of-sight can decode the stream. WaveDrop guarantees physical network isolation (air-gapping), not visual confidentiality.
- **Cryptographic Verification:** Every file container embeds a 32-byte SHA-256 hash. Corrupted or partially resolved payloads are rejected automatically.
- **Volatile Storage Lifecycle:** Text snippets reside exclusively in memory. Received media staged in the browser Cache API can be purged immediately via **Clear WaveDrop cache**.

---

## 13. Documentation Index

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

## 14. Similar Projects & Related Work

The concepts implemented in WaveDrop draw inspiration from foundational research in erasure coding and visual data transmission:

- [mohankumarelec/airgapped-qr-code-transfer](https://github.com/mohankumarelec/airgapped-qr-code-transfer): Browser-based QR file transfer with compression and sequential chunking.
- [divan/txqr](https://github.com/divan/txqr): Animated QR transmission leveraging Luby Transform fountain codes in Go.
- [sz3/libcimbar](https://github.com/sz3/libcimbar): High-density visual data transmission utilizing custom color-coded modulation matrices.

---

## 15. License & Citation

Authored and engineered by [Priyanshu Pratik](https://github.com/Ppratik765).

This software is released under the [MIT License](LICENSE).
