package com.nexfile

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.MediaStore
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.ViewGroup
import android.view.animation.AlphaAnimation
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraControl
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class DocumentScannerActivity : AppCompatActivity() {

    private lateinit var cameraExecutor: ExecutorService
    private var imageCapture: ImageCapture? = null
    private var cameraControl: CameraControl? = null
    private var camera: Camera? = null

    private lateinit var previewView: PreviewView
    private lateinit var overlayContainer: FrameLayout
    private lateinit var flashOverlay: View
    private lateinit var gridView: View
    private lateinit var frameGuideView: View
    private lateinit var instructionText: TextView
    private lateinit var counterBadgeText: TextView
    private lateinit var thumbnailImage: ImageView
    private lateinit var flashButtonText: TextView

    // Mode Selector
    private val modes = listOf(
        "doc" to "Document",
        "idcard" to "ID Card",
        "book" to "Book",
        "whiteboard" to "Whiteboard",
        "qrcode" to "QR Code"
    )
    private val modePills = mutableMapOf<String, TextView>()
    private var scanMode = "doc" // "doc", "idcard", "book", "whiteboard", "qrcode"

    // Session Scanned Paths - Starts 100% fresh for each scan session
    private val capturedPaths = ArrayList<String>()

    private var flashModeIndex = 0 // 0: Auto, 1: On, 2: Torch, 3: Off
    private var isGridVisible = false
    private var isCapturing = false

    companion object {
        private const val REQUEST_CAMERA_PERMISSION = 1001
        private const val REQUEST_GALLERY_PICK = 1002
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val passedMode = intent.getStringExtra("mode") ?: "doc"
        scanMode = if (passedMode == "batch" || passedMode == "document") "doc" else passedMode
        cameraExecutor = Executors.newSingleThreadExecutor()

        initUi()
        hideSystemBars()

        if (allPermissionsGranted()) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CAMERA),
                REQUEST_CAMERA_PERMISSION
            )
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemBars()
        }
    }

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        try {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } catch (_: Throwable) {
            try {
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                )
            } catch (_: Throwable) {}
        }
    }

    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    private fun initUi() {
        val root = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.BLACK)
        }

        // 1. Live Camera PreviewView
        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
        root.addView(previewView)

        // 2. 3x3 Grid Overlay
        gridView = createGridOverlay().apply {
            visibility = if (isGridVisible) View.VISIBLE else View.GONE
        }
        root.addView(gridView)

        // 3. Dynamic Frame Guide based on Mode (Doc, ID Card, Book, Whiteboard, QR)
        frameGuideView = createDocumentFrameGuide()
        root.addView(frameGuideView)

        // 4. Tap-To-Focus & Pinch-To-Zoom Gesture Handler
        setupGestures(previewView)

        // 5. White Screen Flash Overlay for capture feedback
        flashOverlay = View(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.WHITE)
            visibility = View.GONE
        }
        root.addView(flashOverlay)

        // 6. Overlays & Controls Container
        overlayContainer = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // Top Toolbar (Close, Title, Grid, Flash)
        val topToolbar = createTopToolbar()
        overlayContainer.addView(topToolbar)

        // Instruction Text (Center Top below toolbar)
        instructionText = TextView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER_HORIZONTAL or Gravity.TOP
            ).apply {
                topMargin = dpToPx(85)
            }
            text = getInstructionForMode()
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setPadding(dpToPx(16), dpToPx(7), dpToPx(16), dpToPx(7))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#99000000"))
                cornerRadius = dpToPx(18).toFloat()
            }
        }
        overlayContainer.addView(instructionText)

        // Bottom Controls Container (Modes bar + Capture row)
        val bottomSection = createBottomSection()
        overlayContainer.addView(bottomSection)

        root.addView(overlayContainer)
        setContentView(root)
    }

    private fun getInstructionForMode(): String {
        return when (scanMode) {
            "idcard" -> if (capturedPaths.isEmpty()) "Scan Front Side of ID Card" else "Now flip and scan Back Side"
            "book" -> "Align book across center divider"
            "whiteboard" -> "Position whiteboard / presentation screen"
            "qrcode" -> "Point camera at QR code or barcode"
            else -> if (capturedPaths.isEmpty()) "Position document within frame" else "${capturedPaths.size} pages captured. Tap to scan next."
        }
    }

    private fun createTopToolbar(): LinearLayout {
        return LinearLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(65),
                Gravity.TOP
            ).apply {
                topMargin = dpToPx(16)
            }
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpToPx(16), 0, dpToPx(16), 0)

            // Back / Close Button (Opens Resume or Discard dialog)
            val closeBtn = TextView(this@DocumentScannerActivity).apply {
                text = "✕"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                setPadding(dpToPx(14), dpToPx(8), dpToPx(14), dpToPx(8))
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#66000000"))
                    cornerRadius = dpToPx(20).toFloat()
                }
                setOnClickListener { handleExit() }
            }
            addView(closeBtn)

            // Title
            val titleText = TextView(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = dpToPx(12)
                }
                text = "Doc Scanner"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            }
            addView(titleText)

            // Grid Toggle Button
            val gridBtn = TextView(this@DocumentScannerActivity).apply {
                text = "▦"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
                setPadding(dpToPx(10), dpToPx(8), dpToPx(10), dpToPx(8))
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#66000000"))
                    cornerRadius = dpToPx(20).toFloat()
                }
                setOnClickListener {
                    isGridVisible = !isGridVisible
                    gridView.visibility = if (isGridVisible) View.VISIBLE else View.GONE
                    Toast.makeText(
                        this@DocumentScannerActivity,
                        if (isGridVisible) "Grid Enabled" else "Grid Disabled",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
            addView(gridBtn)

            // Flash Mode Button
            flashButtonText = TextView(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    marginStart = dpToPx(8)
                }
                text = "⚡ Auto"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                setPadding(dpToPx(10), dpToPx(8), dpToPx(10), dpToPx(8))
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#66000000"))
                    cornerRadius = dpToPx(20).toFloat()
                }
                setOnClickListener { cycleFlashMode() }
            }
            addView(flashButtonText)
        }
    }

    private fun createBottomSection(): LinearLayout {
        return LinearLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
            ).apply {
                bottomMargin = dpToPx(16)
            }
            orientation = LinearLayout.VERTICAL

            // 1. HORIZONTAL MODE SELECTOR: Document | ID Card | Book | Whiteboard | QR Code
            val modeBar = createModeSelectorBar()
            addView(modeBar)

            // 2. CAPTURE ROW: Gallery | Shutter Button | Thumbnail & Finish
            val captureRow = createCaptureRow()
            addView(captureRow)
        }
    }

    private fun createModeSelectorBar(): View {
        val scroll = HorizontalScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(44)
            ).apply {
                bottomMargin = dpToPx(12)
            }
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
        }

        val container = LinearLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpToPx(16), 0, dpToPx(16), 0)
        }

        for ((id, label) in modes) {
            val pill = TextView(this).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    dpToPx(34)
                ).apply {
                    marginEnd = dpToPx(8)
                }
                text = label
                gravity = Gravity.CENTER
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f)
                setPadding(dpToPx(16), 0, dpToPx(16), 0)

                setOnClickListener {
                    selectMode(id)
                }
            }
            modePills[id] = pill
            container.addView(pill)
        }

        updateModePillsUi()
        scroll.addView(container)
        return scroll
    }

    private fun selectMode(newMode: String) {
        if (scanMode == newMode) return
        scanMode = newMode
        updateModePillsUi()
        frameGuideView.invalidate()
        instructionText.text = getInstructionForMode()

        try {
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(30, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(30)
            }
        } catch (_: Exception) {}
    }

    private fun updateModePillsUi() {
        for ((id, pill) in modePills) {
            val isSelected = id == scanMode
            if (isSelected) {
                pill.setTextColor(Color.WHITE)
                pill.typeface = android.graphics.Typeface.DEFAULT_BOLD
                pill.background = GradientDrawable().apply {
                    setColor(Color.parseColor("#2563EB")) // Active Blue Pill
                    cornerRadius = dpToPx(17).toFloat()
                }
            } else {
                pill.setTextColor(Color.parseColor("#CCCCCC"))
                pill.typeface = android.graphics.Typeface.DEFAULT
                pill.background = GradientDrawable().apply {
                    setColor(Color.parseColor("#55000000"))
                    cornerRadius = dpToPx(17).toFloat()
                    setStroke(dpToPx(1), Color.parseColor("#33FFFFFF"))
                }
            }
        }
    }

    private fun createCaptureRow(): LinearLayout {
        return LinearLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(100)
            )
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpToPx(24), 0, dpToPx(24), 0)

            // 1. Gallery Import Button (Left)
            val galleryBtn = LinearLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(65), ViewGroup.LayoutParams.WRAP_CONTENT)
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setOnClickListener { pickFromGallery() }

                val icon = TextView(this@DocumentScannerActivity).apply {
                    text = "🖼"
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
                }
                val label = TextView(this@DocumentScannerActivity).apply {
                    text = "Gallery"
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                }
                addView(icon)
                addView(label)
            }
            addView(galleryBtn)

            // 2. Center Shutter Button
            val shutterContainer = FrameLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f)
            }

            val shutterOuterRing = FrameLayout(this@DocumentScannerActivity).apply {
                layoutParams = FrameLayout.LayoutParams(
                    dpToPx(76),
                    dpToPx(76),
                    Gravity.CENTER
                )
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.TRANSPARENT)
                    setStroke(dpToPx(4), Color.WHITE)
                }

                val shutterInnerBtn = View(this@DocumentScannerActivity).apply {
                    layoutParams = FrameLayout.LayoutParams(
                        dpToPx(60),
                        dpToPx(60),
                        Gravity.CENTER
                    )
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(Color.WHITE)
                    }
                }
                addView(shutterInnerBtn)

                setOnClickListener { takePhoto() }
            }
            shutterContainer.addView(shutterOuterRing)
            addView(shutterContainer)

            // 3. Right: Review / Finish Button with Live Thumbnail & Counter Badge
            val doneContainer = LinearLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(65), ViewGroup.LayoutParams.WRAP_CONTENT)
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setOnClickListener { finishWithResults() }

                val thumbFrame = FrameLayout(this@DocumentScannerActivity).apply {
                    layoutParams = LinearLayout.LayoutParams(dpToPx(46), dpToPx(46))
                }

                thumbnailImage = ImageView(this@DocumentScannerActivity).apply {
                    layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    scaleType = ImageView.ScaleType.CENTER_CROP
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#333333"))
                        cornerRadius = dpToPx(8).toFloat()
                        setStroke(dpToPx(1), Color.WHITE)
                    }
                }
                thumbFrame.addView(thumbnailImage)

                // Counter Badge (Top Right of thumbnail)
                counterBadgeText = TextView(this@DocumentScannerActivity).apply {
                    layoutParams = FrameLayout.LayoutParams(
                        dpToPx(20),
                        dpToPx(20),
                        Gravity.TOP or Gravity.END
                    )
                    gravity = Gravity.CENTER
                    text = "0"
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(Color.parseColor("#2563EB")) // Vibrant Blue
                    }
                    visibility = View.GONE
                }
                thumbFrame.addView(counterBadgeText)

                val doneLabel = TextView(this@DocumentScannerActivity).apply {
                    text = "Finish"
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                }

                addView(thumbFrame)
                addView(doneLabel)
            }
            addView(doneContainer)
        }
    }

    private fun createGridOverlay(): View {
        return object : View(this) {
            private val paint = android.graphics.Paint().apply {
                color = Color.parseColor("#44FFFFFF")
                strokeWidth = dpToPx(1).toFloat()
            }

            override fun onDraw(canvas: android.graphics.Canvas) {
                super.onDraw(canvas)
                val w = width.toFloat()
                val h = height.toFloat()

                // Horizontal lines (1/3 and 2/3)
                canvas.drawLine(0f, h / 3f, w, h / 3f, paint)
                canvas.drawLine(0f, 2f * h / 3f, w, 2f * h / 3f, paint)

                // Vertical lines (1/3 and 2/3)
                canvas.drawLine(w / 3f, 0f, w / 3f, h, paint)
                canvas.drawLine(2f * w / 3f, 0f, 2f * w / 3f, h, paint)
            }
        }.apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
    }

    private fun createDocumentFrameGuide(): View {
        return object : View(this) {
            private val borderPaint = android.graphics.Paint().apply {
                color = Color.parseColor("#803B82F6")
                style = android.graphics.Paint.Style.STROKE
                strokeWidth = dpToPx(2).toFloat()
            }

            private val cornerPaint = android.graphics.Paint().apply {
                color = Color.parseColor("#3B82F6")
                style = android.graphics.Paint.Style.STROKE
                strokeWidth = dpToPx(4).toFloat()
            }

            private val spinePaint = android.graphics.Paint().apply {
                color = Color.parseColor("#FFD54F")
                style = android.graphics.Paint.Style.STROKE
                strokeWidth = dpToPx(2).toFloat()
                pathEffect = DashPathEffect(floatArrayOf(15f, 15f), 0f)
            }

            override fun onDraw(canvas: android.graphics.Canvas) {
                super.onDraw(canvas)
                val w = width.toFloat()
                val h = height.toFloat()

                val targetW: Float
                val targetH: Float

                when (scanMode) {
                    "idcard" -> {
                        // Standard Card Ratio (85.6mm x 53.98mm ~ 1.586 : 1)
                        targetW = w - dpToPx(40).toFloat() * 2
                        targetH = targetW / 1.586f
                    }
                    "book" -> {
                        // Wide Open Book Box
                        targetW = w - dpToPx(20).toFloat() * 2
                        targetH = targetW * 0.72f
                    }
                    "whiteboard" -> {
                        // 16:9 Widescreen Box
                        targetW = w - dpToPx(24).toFloat() * 2
                        targetH = targetW * 9f / 16f
                    }
                    "qrcode" -> {
                        // 1:1 Centered Target Box
                        targetW = dpToPx(230).toFloat()
                        targetH = targetW
                    }
                    else -> {
                        // A4 Document (1 : 1.414)
                        val marginH = dpToPx(30).toFloat()
                        targetW = w - marginH * 2
                        targetH = targetW * 1.414f
                    }
                }

                val top = (h - targetH) / 2f
                val bottom = top + targetH
                val left = (w - targetW) / 2f
                val right = left + targetW

                // Draw bounding box
                canvas.drawRect(left, top, right, bottom, borderPaint)

                // Corner brackets (length 25dp)
                val cLen = dpToPx(24).toFloat()

                // Top-Left
                canvas.drawLine(left, top, left + cLen, top, cornerPaint)
                canvas.drawLine(left, top, left, top + cLen, cornerPaint)

                // Top-Right
                canvas.drawLine(right, top, right - cLen, top, cornerPaint)
                canvas.drawLine(right, top, right, top + cLen, cornerPaint)

                // Bottom-Left
                canvas.drawLine(left, bottom, left + cLen, bottom, cornerPaint)
                canvas.drawLine(left, bottom, left, bottom - cLen, cornerPaint)

                // Bottom-Right
                canvas.drawLine(right, bottom, right - cLen, bottom, cornerPaint)
                canvas.drawLine(right, bottom, right, bottom - cLen, cornerPaint)

                // If Book Mode: draw dashed spine divider down the center
                if (scanMode == "book") {
                    val centerX = w / 2f
                    canvas.drawLine(centerX, top, centerX, bottom, spinePaint)
                }
            }
        }.apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
    }

    private fun setupGestures(view: View) {
        val scaleDetector = ScaleGestureDetector(
            this,
            object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
                override fun onScale(detector: ScaleGestureDetector): Boolean {
                    val currentZoom = camera?.cameraInfo?.zoomState?.value?.zoomRatio ?: 1f
                    val delta = detector.scaleFactor
                    cameraControl?.setZoomRatio(currentZoom * delta)
                    return true
                }
            }
        )

        view.setOnTouchListener { _, event ->
            scaleDetector.onTouchEvent(event)
            if (event.action == MotionEvent.ACTION_UP && !scaleDetector.isInProgress) {
                // Tap to Focus
                val factory = previewView.meteringPointFactory
                val point = factory.createPoint(event.x, event.y)
                val action = FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF).build()
                cameraControl?.startFocusAndMetering(action)
            }
            true
        }
    }

    private fun cycleFlashMode() {
        flashModeIndex = (flashModeIndex + 1) % 4
        when (flashModeIndex) {
            0 -> {
                flashButtonText.text = "⚡ Auto"
                imageCapture?.flashMode = ImageCapture.FLASH_MODE_AUTO
                cameraControl?.enableTorch(false)
            }
            1 -> {
                flashButtonText.text = "⚡ On"
                imageCapture?.flashMode = ImageCapture.FLASH_MODE_ON
                cameraControl?.enableTorch(false)
            }
            2 -> {
                flashButtonText.text = "🔦 Torch"
                cameraControl?.enableTorch(true)
            }
            3 -> {
                flashButtonText.text = "⚡ Off"
                imageCapture?.flashMode = ImageCapture.FLASH_MODE_OFF
                cameraControl?.enableTorch(false)
            }
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()

                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

                imageCapture = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                    .setFlashMode(ImageCapture.FLASH_MODE_AUTO)
                    .build()

                val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(
                    this,
                    cameraSelector,
                    preview,
                    imageCapture
                )
                cameraControl = camera?.cameraControl

            } catch (e: Exception) {
                Toast.makeText(this, "Camera init failed: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun takePhoto() {
        val capture = imageCapture ?: return
        if (isCapturing) return
        isCapturing = true

        triggerCaptureFeedback()

        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(Date())
        val photoFile = File(cacheDir, "scan_${timeStamp}.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        capture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    isCapturing = false
                    val path = photoFile.absolutePath

                    runOnUiThread {
                        capturedPaths.add(path)
                        updateThumbnail(path)

                        val count = capturedPaths.size
                        counterBadgeText.text = count.toString()
                        counterBadgeText.visibility = View.VISIBLE

                        if (scanMode == "idcard") {
                            if (count == 1) {
                                instructionText.text = "Now flip ID card and scan Back Side"
                                Toast.makeText(this@DocumentScannerActivity, "Front Side Captured! Flip card for Back Side.", Toast.LENGTH_LONG).show()
                            } else {
                                Toast.makeText(this@DocumentScannerActivity, "Both Sides Captured! Proceeding to edit.", Toast.LENGTH_SHORT).show()
                                finishWithResults()
                            }
                        } else {
                            instructionText.text = "Page $count captured. Scan next or tap Finish."
                        }
                    }
                }

                override fun onError(exc: ImageCaptureException) {
                    isCapturing = false
                    runOnUiThread {
                        Toast.makeText(this@DocumentScannerActivity, "Capture failed: ${exc.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
    }

    private fun triggerCaptureFeedback() {
        // 1. Haptic Vibrate
        try {
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(50)
            }
        } catch (_: Exception) {}

        // 2. White Screen Flash Animation
        flashOverlay.visibility = View.VISIBLE
        val anim = AlphaAnimation(0.8f, 0f).apply {
            duration = 150
            setAnimationListener(object : android.view.animation.Animation.AnimationListener {
                override fun onAnimationStart(animation: android.view.animation.Animation?) {}
                override fun onAnimationEnd(animation: android.view.animation.Animation?) {
                    flashOverlay.visibility = View.GONE
                }
                override fun onAnimationRepeat(animation: android.view.animation.Animation?) {}
            })
        }
        flashOverlay.startAnimation(anim)
    }

    private fun updateThumbnail(imagePath: String) {
        try {
            val options = BitmapFactory.Options().apply {
                inSampleSize = 4 // downsample for memory efficiency
            }
            val bm = BitmapFactory.decodeFile(imagePath, options)
            thumbnailImage.setImageBitmap(bm)
        } catch (_: Exception) {}
    }

    private fun pickFromGallery() {
        val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI).apply {
            type = "image/*"
        }
        startActivityForResult(intent, REQUEST_GALLERY_PICK)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_GALLERY_PICK && resultCode == Activity.RESULT_OK && data?.data != null) {
            val uri: Uri = data.data!!
            try {
                val file = File(cacheDir, "gallery_scan_${System.currentTimeMillis()}.jpg")
                contentResolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(file).use { output ->
                        input.copyTo(output)
                    }
                }
                val path = file.absolutePath
                capturedPaths.add(path)
                updateThumbnail(path)

                val count = capturedPaths.size
                counterBadgeText.text = count.toString()
                counterBadgeText.visibility = View.VISIBLE
                instructionText.text = "Added from gallery ($count pages total)"
                Toast.makeText(this, "Photo added to document", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this, "Failed to import photo: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun finishWithResults() {
        if (capturedPaths.isEmpty()) {
            Toast.makeText(this, "Please scan at least 1 document page", Toast.LENGTH_SHORT).show()
            return
        }

        val resultIntent = Intent().apply {
            putStringArrayListExtra("scanned_images", capturedPaths)
            putExtra("scan_mode", scanMode)
        }
        setResult(Activity.RESULT_OK, resultIntent)
        finish()
    }

    // USER REQUIREMENT 3: If back pressed, show Resume or Discard options
    private fun handleExit() {
        val builder = AlertDialog.Builder(this)
            .setTitle("Exit Scanner?")
            .setMessage("Do you want to continue scanning or discard?")
            .setPositiveButton("Resume") { dialog, _ ->
                dialog.dismiss()
            }
            .setNegativeButton("Discard") { dialog, _ ->
                dialog.dismiss()
                // Clean up session photos
                for (p in capturedPaths) {
                    try { File(p).delete() } catch (_: Exception) {}
                }
                setResult(Activity.RESULT_CANCELED)
                finish()
            }

        if (capturedPaths.isNotEmpty()) {
            builder.setNeutralButton("Save (${capturedPaths.size})") { dialog, _ ->
                dialog.dismiss()
                finishWithResults()
            }
        }

        builder.show()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        handleExit()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CAMERA_PERMISSION) {
            if (allPermissionsGranted()) {
                startCamera()
            } else {
                Toast.makeText(this, "Camera permission is required to scan documents", Toast.LENGTH_LONG).show()
                finish()
            }
        }
    }

    private fun allPermissionsGranted(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
