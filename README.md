# WaveDrop: Optical File Transfer Protocol

Send a file between two devices using nothing but a **screen and a camera**. One page displays the file as an endless stream of animated QR codes; another device points its camera at it and reconstructs the file. **No network path between the devices, no app, no pairing, no permissions beyond the camera.** The payload travels entirely as light.

This application demonstrates high-throughput optical data transmission, bridging theoretical fountain coding mathematics with modern mobile software and WebAssembly architecture.

---

## Table of Contents
1. [Overview](#1-overview)
2. [Mathematical Foundation](#2-mathematical-foundation)
3. [Core Features](#3-core-features)
4. [Technology Stack](#4-technology-stack)
5. [Repository Structure](#5-repository-structure)
6. [Installation and Configuration](#6-installation-and-configuration)
7. [Documentation](#7-documentation)
8. [Similar Projects](#8-similar-projects)
9. [License and Citation](#9-license-and-citation)

---

## 1. Overview

WaveDrop allows you to transfer files up to 64 MB (or a pasted text snippet) instantly. The filename and media type are preserved, gzip is applied when it helps, and the payload is SHA-256 verified before anything is offered to the user. Received video files play right within the page. 

It works entirely offline after the first visit and installs as a Progressive Web App (PWA) on both iOS and Android. A standalone Android native wrapper also exists to leverage hardware features like Wi-Fi Direct and native ML-Kit scanning. Extracted from a larger experiment, this protocol has reached **128 KB/s phone-to-phone**.

*Note: Neither mode is encrypted: whatever is on the sending screen is readable by any camera pointed at it. The property this gives you is physical network isolation, not confidentiality — see [privacy](docs/user/privacy.md).*

---

## 2. Mathematical Foundation

The short version of the protocol: a screen-to-camera link has no back-channel, meaning the sender has no idea which frames were successfully received. 

To solve this, the sender streams fountain-coded frames (specifically, the [Luby transform](https://en.wikipedia.org/wiki/Luby_transform_code)). Instead of looping the same chunks sequentially, the receiver collects *any* ~K·1.15 distinct mathematical frames in any order and solves the system of equations to peel the file out. Dropped frames cost time, never correctness.

---

## 3. Core Features

- **True Air-Gapped Transfer:** Bypasses Bluetooth, Wi-Fi, and cellular networks entirely.
- **Fountain Coding:** Ensures robust error correction and file reconstruction regardless of dropped frames.
- **Native Android Wrapper:** Provides deeper hardware integrations (CameraX, ML-Kit, Wi-Fi P2P fallback) while serving the offline web app.
- **PWA Ready:** Caches entirely for offline browser usage.
- **Dynamic Worker Pool:** Parallelizes WebAssembly QR decoding based on hardware capabilities.

---

## 4. Technology Stack

- **Core Web:** HTML5, Vanilla CSS, TypeScript.
- **Bundling & Build:** Vite.
- **Decoding Engine:** WebAssembly via `zxing-wasm`.
- **QR Generation:** `node-qrcode`.
- **Native Android Wrapper:** Kotlin, CameraX, Google ML-Kit Vision, Android `WifiP2pManager`.

---

## 5. Repository Structure

The project is cleanly organized into independent functional modules for the sender, receiver, and shared protocol logic.

```text
WaveDrop/
├── android/          # Native Android Wrapper & P2P Engine
│   └── app/          # Kotlin Source, ML-Kit, CameraX, Web Assets
├── build/            # Vite Configuration & Build Scripts
├── docs/             # Technical and User Documentation
├── receive/          # Web Receiver Application (Camera & WASM decode)
├── send/             # Web Sender Application (File chunking & QR stream)
├── shared/           # Common Protocol Logic & Fountain Encoder
├── tests/            # Unit Tests & Golden Wire-Format Vectors
└── README.md         # Documentation Entry Point
```

---

## 6. Installation and Configuration

To run the web application locally with hot-module replacement (HMR):

```bash
npm install
npm run dev               # https dev server with HMR
```

Open `https://localhost:5173/send/` on the sending device and the printed `Network` URL on the receiving phone (accept the self-signed certificate once). 

### Additional Build Commands
```bash
npm run serve             # build, then serve the production bundle
npm run demo              # demo mode: only the bundled payloads can be sent
npm test                  # golden wire-format vectors and unit tests
npm run build             # the hosted site → dist/
npm run build:standalone  # both self-contained pages → dist-standalone/
npm run build:android     # builds web assets and syncs to android/ assets
npm run build:all         # everything
```

---

## 7. Documentation

**Using it**
- [Quick Start](docs/user/quick-start.md)
- [Sending](docs/user/sending.md)
- [Receiving](docs/user/receiving.md)
- [Troubleshooting](docs/user/troubleshooting.md)
- [Install & Offline](docs/user/install-and-offline.md)
- [Privacy](docs/user/privacy.md)

**How it's built**
- [Architecture](docs/technical/architecture.md)
- [Protocol](docs/technical/protocol.md)
- [Platform Quirks](docs/technical/platform-quirks.md)
- [Build & Release](docs/technical/build-and-release.md)

---

## 8. Similar Projects

The concept here was arrived at independently. It turns out several people have had similar ideas, and their takes are all worth a look:

- [mohankumarelec/airgapped-qr-code-transfer](https://github.com/mohankumarelec/airgapped-qr-code-transfer): Browser-based QR file transfer with compression and sequential chunking.
- [divan/txqr](https://github.com/divan/txqr) (2018): Animated QR plus fountain codes in Go.
- [sz3/libcimbar](https://github.com/sz3/libcimbar): Goes past QR entirely with a custom high-density color code purpose-built for this channel.

---

## 9. License and Citation

Built by [Priyanshu Pratik](https://github.com/Ppratik765).

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
