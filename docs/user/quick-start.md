# Quick Start Guide

WaveDrop enables fast, serverless file and text transfers across physically isolated devices. You can choose between two modes depending on your requirements:

1. **Optical Stream Mode (Air-Gapped, 100% Light-Based)**
2. **WebRTC Direct Mode (High-Speed Local Transfer via Optical Handshake)**

---

## 1. Optical Stream Transfer (Air-Gapped)

This mode operates with **zero network communication** between devices. Data travels entirely as animated light patterns.

### Step 1: Open WaveDrop on the Sender
1. Open the [WaveDrop Web Application](https://wavedrop.vercel.app) or launch the native Android app.
2. Select **Send** from the home portal.
3. Choose **File** (select any file up to 64 MB) or switch to **Text snippet** and paste your text.
4. Set your sending screen brightness to maximum. The animated QR fountain stream will begin immediately.
5. *(Optional)* Click the QR display to expand it to fullscreen for greater scanning distance.

### Step 2: Receive the Stream on the Receiver
1. Open WaveDrop on the receiving device and select **Receive**.
2. Tap **Start camera** and grant camera permissions if prompted.
3. Align the camera viewfinder with the sender's animated QR code.
4. As droplets are captured, the progress indicator will fill.
5. Once all blocks are resolved, the file integrity is validated via SHA-256, and a preview/download button will appear.

---

## 2. WebRTC High-Speed Direct Transfer

For large payloads (up to 512 MB on native Android), WaveDrop allows two devices to establish a direct local peer-to-peer data channel using a bidirectional optical handshake without intermediate signaling servers.

### Step 1: Initialize WebRTC on Sender
1. On the **Send** page, click the **WebRTC Mode** button.
2. Select your file (up to 64 MB in browser, up to 512 MB in Android app).
3. The sender generates an SDP Offer and displays it as a single QR code.

### Step 2: Scan Offer and Generate Answer
1. On the **Receive** page, switch to **WebRTC Mode** and tap **Scan Sender Offer**.
2. Point your camera at the sender's Offer QR code.
3. Once scanned, the receiver generates an SDP Answer and displays it as a QR code.

### Step 3: Scan Answer and Transfer
1. On the sender, tap **Scan Receiver Answer** and point the camera at the receiver's screen.
2. The WebRTC `RTCDataChannel` connects directly over your local network or Wi-Fi Direct interface.
3. The file streams at full hardware speed (10–50 MB/s).

---

## 3. Running Locally

To host WaveDrop on your local development machine:

```bash
npm install
npm run dev
```

Open `https://localhost:5173/send/` on your host machine and load `https://<your-local-ip>:5173/receive/` on your mobile device. (Accept the self-signed SSL certificate warning once to enable camera access).
