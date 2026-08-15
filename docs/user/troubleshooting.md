# Troubleshooting and Diagnostics

---

## 1. "Nothing happening?" Toast or Zero Decode Throughput

If the camera is active but no frames are successfully decoding, perform the following adjustments on the **sender** device:

1. **Reduce Density (Bytes / Frame):** The default density of 2953 bytes (QR Version 40) is designed for close-range mobile-to-mobile transfers. On standard PC monitors or at greater distances, open **Transfer Settings** on the sender and reduce **Bytes / frame to 1465** (QR Version 27) or **857** (QR Version 18).
2. **Lower Transmission FPS:** If the sender's display refresh rate causes frame drops or rolling shutter interference with the camera, reduce **Transmission FPS to 24 or 30**.
3. **Maximize Screen Brightness:** Ensure the sending screen brightness is set to 100% to maximize black/white module contrast.
4. **Stabilize Camera View:** Hand tremor causing autofocus hunting is the most common cause of decode degradation. Stabilize the receiver against a surface and fill 80% of the camera viewfinder with the QR code.

---

## 2. Camera and Permission Errors

- **Permission Denied:** If camera access was blocked, update site permissions in your browser settings and tap **Start camera** again.
- **Insecure Context Error:** The camera API (`navigator.mediaDevices.getUserMedia`) is disabled by browsers on unencrypted `http://` origins (except `localhost`). When testing across a local area network, use the HTTPS development server (`npm run dev`) or access via the Progressive Web App.

---

## 3. WebRTC Direct Mode Connection Failures

- **Firewall Restrictions:** Ensure both devices are connected to the same local subnet without AP isolation enabled.
- **Signaling Desync:** Ensure both the Offer and Answer QR codes were scanned completely and in sequence.
- **Android Wi-Fi Direct Fallback:** If local router connectivity is unavailable, use the native Android app's **Discover Nearby Devices** feature to form an automatic peer-to-peer Wi-Fi mesh.
