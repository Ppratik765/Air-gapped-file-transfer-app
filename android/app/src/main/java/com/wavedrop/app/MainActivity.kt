package com.wavedrop.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var cameraContainer: FrameLayout
    private lateinit var previewView: PreviewView
    private lateinit var cameraExecutor: ExecutorService
    private var isCameraActive = false

    private lateinit var wifiP2pManager: android.net.wifi.p2p.WifiP2pManager
    private lateinit var wifiChannel: android.net.wifi.p2p.WifiP2pManager.Channel
    private var wifiReceiver: android.content.BroadcastReceiver? = null
    private val intentFilter = android.content.IntentFilter().apply {
        addAction(android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
        addAction(android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
        addAction(android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
        addAction(android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
    }

    private val requestPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted: Boolean ->
            if (isGranted) {
                startCamera()
            } else {
                Toast.makeText(this, "Camera permission is required.", Toast.LENGTH_SHORT).show()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize WifiP2pManager
        wifiP2pManager = getSystemService(android.content.Context.WIFI_P2P_SERVICE) as android.net.wifi.p2p.WifiP2pManager
        wifiChannel = wifiP2pManager.initialize(this, mainLooper, null)
        
        // Root layout
        val rootLayout = FrameLayout(this)
        setContentView(rootLayout)

        // Initialize WebView
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                cacheMode = WebSettings.LOAD_DEFAULT
            }
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            addJavascriptInterface(WebAppInterface(), "AndroidNativeCamera")
        }
        rootLayout.addView(webView)

        // Initialize Camera Container (hidden initially)
        cameraContainer = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            visibility = View.GONE
            // Set background color to black
            setBackgroundColor(0xFF000000.toInt())
        }
        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            scaleType = PreviewView.ScaleType.FIT_CENTER
        }
        cameraContainer.addView(previewView)
        
        // Add a close button for the camera
        val closeButton = android.widget.Button(this).apply {
            text = "Close Camera"
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = android.view.Gravity.TOP or android.view.Gravity.END
                setMargins(16, 16, 16, 16)
            }
            setOnClickListener {
                stopCamera()
                webView.evaluateJavascript("if (window.onNativeCameraStopped) { window.onNativeCameraStopped(); }", null)
            }
        }
        cameraContainer.addView(closeButton)
        
        rootLayout.addView(cameraContainer)

        cameraExecutor = Executors.newSingleThreadExecutor()

        // Load the web app
        webView.loadUrl("file:///android_asset/www/index.html")
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            val options = BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .build()
            val scanner = BarcodeScanning.getClient(options)

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor) { imageProxy ->
                        processImageProxy(scanner, imageProxy)
                    }
                }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this, cameraSelector, preview, imageAnalyzer
                )
                runOnUiThread {
                    cameraContainer.visibility = View.VISIBLE
                    isCameraActive = true
                }
            } catch (e: Exception) {
                Log.e("MainActivity", "Use case binding failed", e)
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun stopCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            cameraProvider.unbindAll()
            runOnUiThread {
                cameraContainer.visibility = View.GONE
                isCameraActive = false
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
    private fun processImageProxy(barcodeScanner: BarcodeScanner, imageProxy: androidx.camera.core.ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage != null) {
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            barcodeScanner.process(image)
                .addOnSuccessListener { barcodes ->
                    for (barcode in barcodes) {
                        barcode.rawBytes?.let { bytes ->
                            val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                            runOnUiThread {
                                webView.evaluateJavascript("if (window.onNativeQrChunkScanned) { window.onNativeQrChunkScanned('$base64'); }", null)
                            }
                        }
                    }
                }
                .addOnFailureListener {
                    // Log error
                }
                .addOnCompleteListener {
                    imageProxy.close()
                }
        } else {
            imageProxy.close()
        }
    }

    override fun onResume() {
        super.onResume()
        wifiReceiver = object : android.content.BroadcastReceiver() {
            override fun onReceive(context: android.content.Context, intent: android.content.Intent) {
                val action: String? = intent.action
                when (action) {
                    android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                        // Check to see if Wi-Fi is enabled
                    }
                    android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                        // Request peers
                        if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                            wifiP2pManager.requestPeers(wifiChannel) { peers ->
                                val jsonList = peers.deviceList.map { device ->
                                    "{\"name\":\"${device.deviceName}\", \"address\":\"${device.deviceAddress}\"}"
                                }
                                val jsonString = "[${jsonList.joinToString(",")}]"
                                val escapedJson = jsonString.replace("\\", "\\\\").replace("\"", "\\\"")
                                runOnUiThread {
                                    webView.evaluateJavascript("if (window.onWifiPeersDiscovered) { window.onWifiPeersDiscovered(\"$escapedJson\"); }", null)
                                }
                            }
                        }
                    }
                    android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                        // Respond to new connection or disconnections
                    }
                    android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION -> {
                        // Respond to this device's wifi state changing
                    }
                }
            }
        }
        registerReceiver(wifiReceiver, intentFilter)
    }

    override fun onPause() {
        super.onPause()
        wifiReceiver?.let { unregisterReceiver(it) }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }

    override fun onBackPressed() {
        if (isCameraActive) {
            stopCamera()
            runOnUiThread {
                webView.evaluateJavascript("if (window.onNativeCameraStopped) { window.onNativeCameraStopped(); }", null)
            }
        } else if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    inner class WebAppInterface {
        @JavascriptInterface
        fun startNativeCamera() {
            runOnUiThread {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    startCamera()
                } else {
                    requestPermissionLauncher.launch(Manifest.permission.CAMERA)
                }
            }
        }

        @JavascriptInterface
        fun stopNativeCamera() {
            runOnUiThread {
                stopCamera()
            }
        }
        
        @JavascriptInterface
        fun startWifiDirectDiscovery() {
            runOnUiThread {
                val permissions = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION)
                if (android.os.Build.VERSION.SDK_INT >= 33) {
                    permissions.add(Manifest.permission.NEARBY_WIFI_DEVICES)
                }
                val ungranted = permissions.filter { ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED }
                if (ungranted.isEmpty()) {
                    if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                        wifiP2pManager.discoverPeers(wifiChannel, object : android.net.wifi.p2p.WifiP2pManager.ActionListener {
                            override fun onSuccess() {}
                            override fun onFailure(reasonCode: Int) {}
                        })
                    }
                } else {
                    requestPermissions(ungranted.toTypedArray(), 101)
                }
            }
        }

        @JavascriptInterface
        fun connectToWifiPeer(deviceAddress: String) {
            runOnUiThread {
                val config = android.net.wifi.p2p.WifiP2pConfig().apply {
                    this.deviceAddress = deviceAddress
                }
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    wifiP2pManager.connect(wifiChannel, config, object : android.net.wifi.p2p.WifiP2pManager.ActionListener {
                        override fun onSuccess() {}
                        override fun onFailure(reasonCode: Int) {}
                    })
                }
            }
        }

        @JavascriptInterface
        fun isNative(): Boolean {
            return true
        }
    }
}
