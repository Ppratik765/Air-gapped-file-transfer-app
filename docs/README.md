# WaveDrop Technical Documentation

Comprehensive documentation index covering architecture, protocol design, platform optimizations, and user manuals.

---

## 1. Technical Architecture and Protocol

- [System Architecture](technical/architecture.md) — Multi-tier application structure, shared protocol core, Web Workers, and native Android subsystems.
- [Protocol Specification](technical/protocol.md) — Luby Transform (LT) fountain coding, Robust Soliton distribution, 20-byte wire header, and WebRTC optical signaling.
- [Platform Quirks and Workarounds](technical/platform-quirks.md) — Low-level iOS WebKit frame rate fixes, Android CameraX/ML-Kit backpressure handling, Safari 26 UI styling, and Cache API range requests.
- [Build and Release Pipeline](technical/build-and-release.md) — NPM scripts, PWA packaging, standalone single-file inlining, and Android Gradle APK compilation.

---

## 2. User Guides and Operations

- [Quick Start Guide](user/quick-start.md) — Rapid onboarding for Optical and WebRTC transfer modes.
- [Sending Data](user/sending.md) — Configuring file transmissions, text snippets, and display parameters.
- [Receiving Data](user/receiving.md) — Camera alignment, live transfer diagnostics, and SHA-256 verification.
- [Installation and Offline Usage](user/install-and-offline.md) — Progressive Web App installation, native Android APK setup, and standalone HTML files.
- [Troubleshooting](user/troubleshooting.md) — Diagnostic checklists for optical decoding, camera issues, and network constraints.
- [Privacy and Security Model](user/privacy.md) — Air-gap isolation, cryptographic hashing, and local storage policies.
