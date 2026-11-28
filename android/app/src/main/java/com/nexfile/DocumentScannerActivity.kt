package com.nexfile

import android.Manifest
import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.*
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
import android.view.animation.Animation
import android.view.animation.LinearInterpolator
import android.view.animation.TranslateAnimation
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
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
import java.util.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class DocumentScannerActivity : AppCompatActivity() {

    private lateinit var cameraExecutor: ExecutorService
    private var imageCapture: ImageCapture? = null
    private var cameraControl: CameraControl? = null
    private var camera: androidx.camera.core.Camera? = null

    private lateinit var previewView: PreviewView
    private lateinit var overlayContainer: FrameLayout
    private lateinit var flashOverlay: View
    private lateinit var gridView: View
    private lateinit var frameGuideView: View

    // Top Bar Actions
    private lateinit var flashButtonText: TextView
    private lateinit var bookSplitBtn: TextView
    private lateinit var hdBadge: TextView
    private lateinit var filterBtn: TextView
    private lateinit var gridBtn: TextView
    private lateinit var settingsBtn: TextView

    // Center Guides & Overlays
    private lateinit var searchingDocPill: TextView
    private lateinit var bookInstructionText: TextView
    private lateinit var idCardIntroCard: LinearLayout
    private lateinit var qrTorchButton: LinearLayout
    private lateinit var qrTorchLabel: TextView
    private var isTorchOn = false
    private var qrLaserAnimator: ValueAnimator? = null

    // ID Card Sub Mode Views
    private lateinit var singleSideBox: FrameLayout
    private lateinit var idCardBox: FrameLayout
    private lateinit var passportBox: FrameLayout
    private lateinit var singleSideLabel: TextView
    private lateinit var idCardLabel: TextView
    private lateinit var passportLabel: TextView

    // Bottom Controls
    private lateinit var captureRow: LinearLayout
    private lateinit var leftActionButton: FrameLayout
    private lateinit var shutterContainer: FrameLayout
    private lateinit var shutterOuterRing: FrameLayout
    private lateinit var rightActionButton: LinearLayout
    private lateinit var thumbnailImage: ImageView
    private lateinit var counterBadgeText: TextView

    // Mode Selector: Book | To Text | Docs | ID Card | QR Code
    private val modes = listOf(
        "book" to "Book",
        "totext" to "To Text",
        "doc" to "Docs",
        "idcard" to "ID Card",
        "qrcode" to "QR Code"
    )
    private val modePills = mutableMapOf<String, TextView>()
    private var scanMode = "doc" // "book", "totext", "doc", "idcard", "qrcode"

    // ID Card sub-modes: Single Side | ID Card | Passport
    private var idCardSubMode = "idcard" // "single", "idcard", "passport"
    private var isIdCardLiveScanning = false

    // Session Captured Paths
    private val capturedPaths = ArrayList<String>()

    private var flashModeIndex = 0 // 0: Auto, 1: On, 2: Torch, 3: Off
    private var isGridVisible = false
    private var isCapturing = false

    companion object {
        private const val REQUEST_CAMERA_PERMISSION = 1001
        private const val REQUEST_GALLERY_PICK = 1002
        private const val REQUEST_FILES_PICK = 1003
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val passedMode = intent.getStringExtra("mode") ?: "doc"
        scanMode = when (passedMode) {
            "batch", "document" -> "doc"
            "idcard" -> "idcard"
            "book" -> "book"
            "qrcode" -> "qrcode"
            "totext" -> "totext"
            else -> "doc"
        }

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

        // 1. Live Camera Preview
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

        // 3. Dynamic Frame Guide View
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

        // Top Bar (Flash, Book Split, HD, Color, Grid, Settings)
        val topBar = createTopBar()
        overlayContainer.addView(topBar)

        // Center Elements:
        // A) "Searching doc..." pill for Docs mode (Image 2)
        searchingDocPill = TextView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
            text = "Searching doc..."
            setTextColor(Color.parseColor("#1E293B"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dpToPx(28), dpToPx(12), dpToPx(28), dpToPx(12))
            background = GradientDrawable().apply {
                setColor(Color.WHITE)
                cornerRadius = dpToPx(24).toFloat()
            }
            visibility = if (scanMode == "doc" && capturedPaths.isEmpty()) View.VISIBLE else View.GONE
        }
        overlayContainer.addView(searchingDocPill)

        // B) Book mode rotated guidance text (Image 1)
        bookInstructionText = TextView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                dpToPx(300),
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER_VERTICAL or Gravity.START
            ).apply {
                marginStart = -dpToPx(75)
            }
            rotation = -90f
            text = "Please hold the device horizontally and keep it parallel to the book, match the green line with the book's binding line"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            setPadding(dpToPx(14), dpToPx(8), dpToPx(14), dpToPx(8))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#99000000"))
                cornerRadius = dpToPx(8).toFloat()
            }
            gravity = Gravity.CENTER
            visibility = if (scanMode == "book") View.VISIBLE else View.GONE
        }
        overlayContainer.addView(bookInstructionText)

        // C) QR Code Turn Light On button (Image 4)
        qrTorchButton = createQrTorchButton()
        overlayContainer.addView(qrTorchButton)

        // D) ID Card Intro Card (Example on A4 paper + submodes) (Image 5)
        idCardIntroCard = createIdCardIntroCard()
        overlayContainer.addView(idCardIntroCard)

        // Bottom Section: Modes Selector + Capture Row
        val bottomSection = createBottomSection()
        overlayContainer.addView(bottomSection)

        root.addView(overlayContainer)
        setContentView(root)
        updateTopBarUi()
    }

    // Top Bar Matching Image 1, 2, 3, 5
    private fun createTopBar(): LinearLayout {
        return LinearLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(56),
                Gravity.TOP
            ).apply {
                topMargin = dpToPx(12)
            }
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpToPx(16), 0, dpToPx(16), 0)

            // 1. Flash Toggle
            flashButtonText = TextView(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(40), dpToPx(40))
                gravity = Gravity.CENTER
                text = "⚡A"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
                setOnClickListener { cycleFlashMode() }
            }
            addView(flashButtonText)

            // 2. Book Split Mode Toggle (Image 1: A⋮B)
            bookSplitBtn = TextView(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(44), dpToPx(38)).apply {
                    marginStart = dpToPx(8)
                }
                gravity = Gravity.CENTER
                text = "A⋮B"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                typeface = Typeface.DEFAULT_BOLD
                setOnClickListener {
                    Toast.makeText(this@DocumentScannerActivity, "Two-Page Book Mode Active", Toast.LENGTH_SHORT).show()
                }
                visibility = if (scanMode == "book") View.VISIBLE else View.GONE
            }
            addView(bookSplitBtn)

            // Spacer
            addView(View(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(0, 1, 1f)
            })

            // 3. HD Quality Indicator
            hdBadge = TextView(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(34), dpToPx(22)).apply {
                    marginEnd = dpToPx(16)
                }
                gravity = Gravity.CENTER
                text = "HD"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                typeface = Typeface.DEFAULT_BOLD
                background = GradientDrawable().apply {
                    setColor(Color.TRANSPARENT)
                    setStroke(dpToPx(1), Color.WHITE)
                    cornerRadius = dpToPx(4).toFloat()
                }
            }
            addView(hdBadge)

            // 4. Color / Filter Icon (3 overlapping circles symbol - Image 2)
            filterBtn = TextView(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(38), dpToPx(38)).apply {
                    marginEnd = dpToPx(12)
                }
                gravity = Gravity.CENTER
                text = "☵"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                setOnClickListener {
                    Toast.makeText(this@DocumentScannerActivity, "Color enhancement auto-applied", Toast.LENGTH_SHORT).show()
                }
            }
            addView(filterBtn)

            // 5. Grid Icon
            gridBtn = TextView(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(38), dpToPx(38)).apply {
                    marginEnd = dpToPx(12)
                }
                gravity = Gravity.CENTER
                text = "▦"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                setOnClickListener {
                    isGridVisible = !isGridVisible
                    gridView.visibility = if (isGridVisible) View.VISIBLE else View.GONE
                }
            }
            addView(gridBtn)

            // 6. Settings Gear
            settingsBtn = TextView(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(38), dpToPx(38))
                gravity = Gravity.CENTER
                text = "⚙"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                setOnClickListener {
                    Toast.makeText(this@DocumentScannerActivity, "OKEN Camera Settings", Toast.LENGTH_SHORT).show()
                }
            }
            addView(settingsBtn)
        }
    }

    private fun updateTopBarUi() {
        bookSplitBtn.visibility = if (scanMode == "book") View.VISIBLE else View.GONE
        hdBadge.visibility = if (scanMode == "qrcode") View.GONE else View.VISIBLE
        filterBtn.visibility = if (scanMode == "doc" || scanMode == "totext") View.VISIBLE else View.GONE
        gridBtn.visibility = if (scanMode == "qrcode") View.GONE else View.VISIBLE
        settingsBtn.visibility = if (scanMode == "doc" || scanMode == "totext") View.VISIBLE else View.GONE
    }

    // QR Mode Torch Button (Image 4)
    private fun createQrTorchButton(): LinearLayout {
        return LinearLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                dpToPx(40),
                Gravity.CENTER_HORIZONTAL
            ).apply {
                topMargin = dpToPx(470)
            }
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dpToPx(20), 0, dpToPx(20), 0)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#77333333"))
                cornerRadius = dpToPx(20).toFloat()
            }
            visibility = if (scanMode == "qrcode") View.VISIBLE else View.GONE

            val icon = TextView(this@DocumentScannerActivity).apply {
                text = "🔦"
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                setPadding(0, 0, dpToPx(6), 0)
            }
            qrTorchLabel = TextView(this@DocumentScannerActivity).apply {
                text = "Turn light on"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            }
            addView(icon)
            addView(qrTorchLabel)

            setOnClickListener {
                isTorchOn = !isTorchOn
                cameraControl?.enableTorch(isTorchOn)
                qrTorchLabel.text = if (isTorchOn) "Turn light off" else "Turn light on"
            }
        }
    }

    // ID Card Intro Graphic Card (Image 5)
    private fun createIdCardIntroCard(): LinearLayout {
        return LinearLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                dpToPx(320),
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER_HORIZONTAL
            ).apply {
                topMargin = dpToPx(70)
            }
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            visibility = if (scanMode == "idcard" && !isIdCardLiveScanning && capturedPaths.isEmpty()) View.VISIBLE else View.GONE

            // A4 Paper Graphic with ID Front & Back
            val paperFrame = LinearLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    dpToPx(310)
                )
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setPadding(dpToPx(18), dpToPx(14), dpToPx(18), dpToPx(14))
                background = GradientDrawable().apply {
                    setColor(Color.WHITE)
                    cornerRadius = dpToPx(12).toFloat()
                }

                // Header tag: A4 paper example
                val tag = TextView(this@DocumentScannerActivity).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply {
                        gravity = Gravity.END
                        bottomMargin = dpToPx(6)
                    }
                    text = "A4 paper example"
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
                    setPadding(dpToPx(8), dpToPx(2), dpToPx(8), dpToPx(2))
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#666666"))
                        cornerRadius = dpToPx(10).toFloat()
                    }
                }
                addView(tag)

                // ID Card Front Mockup
                val frontCard = LinearLayout(this@DocumentScannerActivity).apply {
                    layoutParams = LinearLayout.LayoutParams(dpToPx(200), dpToPx(88)).apply {
                        bottomMargin = dpToPx(12)
                    }
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#B2DFDB"))
                        cornerRadius = dpToPx(8).toFloat()
                    }
                    val t = TextView(this@DocumentScannerActivity).apply {
                        text = "🪪 ID CARD (FRONT)"
                        setTextColor(Color.parseColor("#004D40"))
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                        typeface = Typeface.DEFAULT_BOLD
                    }
                    addView(t)
                }
                addView(frontCard)

                // ID Card Back Mockup
                val backCard = LinearLayout(this@DocumentScannerActivity).apply {
                    layoutParams = LinearLayout.LayoutParams(dpToPx(200), dpToPx(88)).apply {
                        bottomMargin = dpToPx(10)
                    }
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#CFD8DC"))
                        cornerRadius = dpToPx(8).toFloat()
                    }
                    val t = TextView(this@DocumentScannerActivity).apply {
                        text = "💳 ID CARD (BACK)"
                        setTextColor(Color.parseColor("#37474F"))
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                        typeface = Typeface.DEFAULT_BOLD
                    }
                    addView(t)
                }
                addView(backCard)

                // Description text
                val desc = TextView(this@DocumentScannerActivity).apply {
                    text = "A must-have feature! You can make a 2-sided e-copy of an ID card in 1 min. 100% ready for printing. Watermark protection is also available. Store only, the content will not be automatically recognized"
                    setTextColor(Color.parseColor("#666666"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
                    gravity = Gravity.CENTER
                }
                addView(desc)
            }
            addView(paperFrame)

            // Green "Make it now" Button
            val makeBtn = TextView(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    dpToPx(44)
                ).apply {
                    topMargin = dpToPx(14)
                }
                gravity = Gravity.CENTER
                text = "Make it now"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
                typeface = Typeface.DEFAULT_BOLD
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#00C853")) // OKEN Green
                    cornerRadius = dpToPx(8).toFloat()
                }
                setOnClickListener {
                    isIdCardLiveScanning = true
                    idCardIntroCard.visibility = View.GONE
                    frameGuideView.invalidate()
                    val msg = when (idCardSubMode) {
                        "single" -> "Position ID Card"
                        "passport" -> "Position Passport Page"
                        else -> "Position Front Side of ID Card"
                    }
                    Toast.makeText(this@DocumentScannerActivity, msg, Toast.LENGTH_SHORT).show()
                }
            }
            addView(makeBtn)

            // Sub-mode tabs row matching Image 5: Single Side | ID Card | Passport
            val subModesRow = LinearLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = dpToPx(14)
                }
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_HORIZONTAL
            }

            // 1. Single Side
            val singleItem = LinearLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(76), ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    marginEnd = dpToPx(16)
                }
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                setOnClickListener {
                    idCardSubMode = "single"
                    updateIdCardSubModesUi()
                }
            }
            singleSideBox = FrameLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(56), dpToPx(40))
                val icon = TextView(this@DocumentScannerActivity).apply {
                    layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
                    gravity = Gravity.CENTER
                    text = "🪪"
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                }
                addView(icon)
            }
            singleSideLabel = TextView(this@DocumentScannerActivity).apply {
                text = "Single Side"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
                gravity = Gravity.CENTER
            }
            singleItem.addView(singleSideBox)
            singleItem.addView(singleSideLabel)
            subModesRow.addView(singleItem)

            // 2. ID Card
            val idCardItem = LinearLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(76), ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    marginEnd = dpToPx(16)
                }
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                setOnClickListener {
                    idCardSubMode = "idcard"
                    updateIdCardSubModesUi()
                }
            }
            idCardBox = FrameLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(56), dpToPx(40))
                val icon = TextView(this@DocumentScannerActivity).apply {
                    layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
                    gravity = Gravity.CENTER
                    text = "📑"
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                }
                addView(icon)
            }
            idCardLabel = TextView(this@DocumentScannerActivity).apply {
                text = "ID Card"
                setTextColor(Color.parseColor("#00C853"))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
            }
            idCardItem.addView(idCardBox)
            idCardItem.addView(idCardLabel)
            subModesRow.addView(idCardItem)

            // 3. Passport
            val passportItem = LinearLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(76), ViewGroup.LayoutParams.WRAP_CONTENT)
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                setOnClickListener {
                    idCardSubMode = "passport"
                    updateIdCardSubModesUi()
                }
            }
            passportBox = FrameLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(56), dpToPx(40))
                val icon = TextView(this@DocumentScannerActivity).apply {
                    layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
                    gravity = Gravity.CENTER
                    text = "📘"
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                }
                addView(icon)
            }
            passportLabel = TextView(this@DocumentScannerActivity).apply {
                text = "Passport"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
                gravity = Gravity.CENTER
            }
            passportItem.addView(passportBox)
            passportItem.addView(passportLabel)
            subModesRow.addView(passportItem)

            addView(subModesRow)
            updateIdCardSubModesUi()
        }
    }

    private fun updateIdCardSubModesUi() {
        val greenColor = Color.parseColor("#00C853")
        val normalBg = GradientDrawable().apply {
            setColor(Color.parseColor("#2A2C32"))
            cornerRadius = dpToPx(4).toFloat()
            setStroke(dpToPx(1), Color.parseColor("#444444"))
        }
        val activeBg = GradientDrawable().apply {
            setColor(Color.parseColor("#2A2C32"))
            cornerRadius = dpToPx(4).toFloat()
            setStroke(dpToPx(2), greenColor)
        }

        singleSideBox.background = if (idCardSubMode == "single") activeBg else normalBg
        singleSideLabel.setTextColor(if (idCardSubMode == "single") greenColor else Color.WHITE)
        singleSideLabel.typeface = if (idCardSubMode == "single") Typeface.DEFAULT_BOLD else Typeface.DEFAULT

        idCardBox.background = if (idCardSubMode == "idcard") activeBg else normalBg
        idCardLabel.setTextColor(if (idCardSubMode == "idcard") greenColor else Color.WHITE)
        idCardLabel.typeface = if (idCardSubMode == "idcard") Typeface.DEFAULT_BOLD else Typeface.DEFAULT

        passportBox.background = if (idCardSubMode == "passport") activeBg else normalBg
        passportLabel.setTextColor(if (idCardSubMode == "passport") greenColor else Color.WHITE)
        passportLabel.typeface = if (idCardSubMode == "passport") Typeface.DEFAULT_BOLD else Typeface.DEFAULT
    }

    private fun createBottomSection(): LinearLayout {
        return LinearLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
            ).apply {
                bottomMargin = dpToPx(20)
            }
            orientation = LinearLayout.VERTICAL

            // 1. HORIZONTAL MODE SELECTOR
            val modeBar = createModeSelectorBar()
            addView(modeBar)

            // 2. CAPTURE ROW
            captureRow = createCaptureRow()
            addView(captureRow)
        }
    }

    private fun createModeSelectorBar(): View {
        val scroll = HorizontalScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(42)
            ).apply {
                bottomMargin = dpToPx(8)
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
            setPadding(dpToPx(24), 0, dpToPx(24), 0)
        }

        for ((id, label) in modes) {
            val pill = TextView(this).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    marginStart = dpToPx(14)
                    marginEnd = dpToPx(14)
                }
                text = label
                gravity = Gravity.CENTER
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)

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
        updateTopBarUi()

        // Update Overlays
        searchingDocPill.visibility = if (scanMode == "doc" && capturedPaths.isEmpty()) View.VISIBLE else View.GONE
        bookInstructionText.visibility = if (scanMode == "book") View.VISIBLE else View.GONE
        qrTorchButton.visibility = if (scanMode == "qrcode") View.VISIBLE else View.GONE
        idCardIntroCard.visibility = if (scanMode == "idcard" && !isIdCardLiveScanning && capturedPaths.isEmpty()) View.VISIBLE else View.GONE

        frameGuideView.invalidate()
        updateCaptureRowUi()

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

    // Exact OKEN styling: active mode is vibrant green text (#00C853), inactive is #CCCCCC
    private fun updateModePillsUi() {
        for ((id, pill) in modePills) {
            val isSelected = id == scanMode
            if (isSelected) {
                pill.setTextColor(Color.parseColor("#00C853")) // OKEN Green
                pill.typeface = Typeface.DEFAULT_BOLD
            } else {
                pill.setTextColor(Color.parseColor("#CCCCCC"))
                pill.typeface = Typeface.DEFAULT
            }
            pill.background = null
        }
    }

    private fun createCaptureRow(): LinearLayout {
        return LinearLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(90)
            )
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpToPx(24), 0, dpToPx(24), 0)

            // Left Action Button: ✕ when 0 photos, ↶ when 1+ photos
            leftActionButton = FrameLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(60), dpToPx(60))
            }
            addView(leftActionButton)

            // Center Shutter Button
            shutterContainer = FrameLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f)
            }

            shutterOuterRing = FrameLayout(this@DocumentScannerActivity).apply {
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
                        dpToPx(62),
                        dpToPx(62),
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

            // Right Action: Import/Import Files when 0 photos, Thumbnail + Count + Arrow when 1+ photos
            rightActionButton = LinearLayout(this@DocumentScannerActivity).apply {
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            addView(rightActionButton)

            updateCaptureRowUi()
        }
    }

    private fun updateCaptureRowUi() {
        leftActionButton.removeAllViews()
        rightActionButton.removeAllViews()

        if (scanMode == "qrcode") {
            shutterContainer.visibility = View.INVISIBLE
            rightActionButton.visibility = View.INVISIBLE
        } else {
            shutterContainer.visibility = View.VISIBLE
            rightActionButton.visibility = View.VISIBLE
        }

        if (capturedPaths.isEmpty()) {
            // LEFT: Close ✕ (Image 2)
            val closeBtn = TextView(this).apply {
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                gravity = Gravity.CENTER
                text = "✕"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f)
                setOnClickListener { handleExit() }
            }
            leftActionButton.addView(closeBtn)

            // RIGHT: Import & Import Files buttons (Image 2)
            val importBtn = LinearLayout(this).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(55), ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    marginEnd = dpToPx(10)
                }
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setOnClickListener { pickFromGallery() }

                val icon = TextView(this@DocumentScannerActivity).apply {
                    text = "🖼"
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
                }
                val label = TextView(this@DocumentScannerActivity).apply {
                    text = "Import"
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
                }
                addView(icon)
                addView(label)
            }
            rightActionButton.addView(importBtn)

            val importFilesBtn = LinearLayout(this).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(60), ViewGroup.LayoutParams.WRAP_CONTENT)
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setOnClickListener { pickFromGallery() }

                val icon = TextView(this@DocumentScannerActivity).apply {
                    text = "📄↩"
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                }
                val label = TextView(this@DocumentScannerActivity).apply {
                    text = "Import Files"
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 9f)
                }
                addView(icon)
                addView(label)
            }
            rightActionButton.addView(importFilesBtn)
        } else {
            // LEFT: Undo / Retake ↶ (Image 3)
            val undoBtn = TextView(this).apply {
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                gravity = Gravity.CENTER
                text = "↶"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 30f)
                setOnClickListener {
                    if (capturedPaths.isNotEmpty()) {
                        val last = capturedPaths.removeAt(capturedPaths.size - 1)
                        try { File(last).delete() } catch (_: Exception) {}
                        Toast.makeText(this@DocumentScannerActivity, "Removed last capture", Toast.LENGTH_SHORT).show()
                        updateCaptureRowUi()
                        frameGuideView.invalidate()
                    }
                }
            }
            leftActionButton.addView(undoBtn)

            // RIGHT: Thumbnail + Green Count Badge + Arrow > (Image 3)
            val thumbContainer = FrameLayout(this).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(48), dpToPx(48))
                setOnClickListener { finishWithResults() }
            }

            thumbnailImage = ImageView(this).apply {
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                scaleType = ImageView.ScaleType.CENTER_CROP
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#333333"))
                    cornerRadius = dpToPx(6).toFloat()
                    setStroke(dpToPx(1), Color.WHITE)
                }
            }
            thumbContainer.addView(thumbnailImage)

            // Circular Green Badge showing Count
            counterBadgeText = TextView(this).apply {
                layoutParams = FrameLayout.LayoutParams(
                    dpToPx(20),
                    dpToPx(20),
                    Gravity.TOP or Gravity.END
                )
                gravity = Gravity.CENTER
                text = "${capturedPaths.size}"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
                typeface = Typeface.DEFAULT_BOLD
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#00C853")) // OKEN Green
                }
            }
            thumbContainer.addView(counterBadgeText)

            rightActionButton.addView(thumbContainer)

            // Arrow > to proceed to editor
            val arrowNext = TextView(this).apply {
                layoutParams = LinearLayout.LayoutParams(
                    dpToPx(26),
                    ViewGroup.LayoutParams.MATCH_PARENT
                ).apply {
                    marginStart = dpToPx(6)
                }
                gravity = Gravity.CENTER
                text = "›"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
                setOnClickListener { finishWithResults() }
            }
            rightActionButton.addView(arrowNext)

            // Load last thumbnail image
            if (capturedPaths.isNotEmpty()) {
                val lastPath = capturedPaths.last()
                try {
                    val bmp = BitmapFactory.decodeFile(lastPath)
                    thumbnailImage.setImageBitmap(bmp)
                } catch (_: Exception) {}
            }
        }
    }

    // Viewfinder Overlays
    private fun createDocumentFrameGuide(): View {
        return object : View(this) {
            private var laserYRatio = 0.1f

            init {
                qrLaserAnimator = ValueAnimator.ofFloat(0.08f, 0.92f).apply {
                    duration = 1800
                    repeatCount = ValueAnimator.INFINITE
                    repeatMode = ValueAnimator.REVERSE
                    interpolator = LinearInterpolator()
                    addUpdateListener {
                        laserYRatio = it.animatedValue as Float
                        if (scanMode == "qrcode") {
                            invalidate()
                        }
                    }
                    start()
                }
            }

            private val greenFramePaint = Paint().apply {
                color = Color.parseColor("#00C853") // OKEN Green
                style = Paint.Style.STROKE
                strokeWidth = dpToPx(2).toFloat()
            }

            private val greenDashedPaint = Paint().apply {
                color = Color.parseColor("#00C853")
                style = Paint.Style.STROKE
                strokeWidth = dpToPx(3).toFloat()
                pathEffect = DashPathEffect(floatArrayOf(30f, 20f), 0f)
            }

            private val cornerPaint = Paint().apply {
                color = Color.WHITE
                style = Paint.Style.STROKE
                strokeWidth = dpToPx(4).toFloat()
            }

            private val qrLaserPaint = Paint().apply {
                color = Color.parseColor("#00C853")
                style = Paint.Style.STROKE
                strokeWidth = dpToPx(3).toFloat()
                maskFilter = BlurMaskFilter(4f, BlurMaskFilter.Blur.NORMAL)
            }

            override fun onDraw(canvas: Canvas) {
                super.onDraw(canvas)
                val w = width.toFloat()
                val h = height.toFloat()

                when (scanMode) {
                    "book" -> {
                        // Horizontal dashed green line across the center (Image 1)
                        val centerY = h / 2f
                        canvas.drawLine(0f, centerY, w, centerY, greenDashedPaint)
                    }
                    "qrcode" -> {
                        // Square target box with 4 white corner brackets (Image 4)
                        val size = dpToPx(240).toFloat()
                        val left = (w - size) / 2f
                        val right = left + size
                        val top = (h - size) / 2f - dpToPx(30)
                        val bottom = top + size
                        val cLen = dpToPx(30).toFloat()

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

                        // Center green laser line sweeping up and down
                        val laserY = top + size * laserYRatio
                        canvas.drawLine(left + dpToPx(8), laserY, right - dpToPx(8), laserY, qrLaserPaint)
                    }
                    "idcard" -> {
                        if (isIdCardLiveScanning) {
                            // Standard ID Card Frame
                            val cardW = w - dpToPx(36).toFloat() * 2
                            val cardH = cardW / 1.586f
                            val top = (h - cardH) / 2f - dpToPx(20)
                            val bottom = top + cardH
                            val left = (w - cardW) / 2f
                            val right = left + cardW
                            canvas.drawRect(left, top, right, bottom, greenFramePaint)
                        }
                    }
                    else -> {
                        // Docs / To Text Mode: Clean green document boundary (Image 3)
                        val marginH = dpToPx(22).toFloat()
                        val docW = w - marginH * 2
                        val docH = docW * 1.414f
                        val top = (h - docH) / 2f - dpToPx(20)
                        val bottom = top + docH
                        val left = marginH
                        val right = left + docW

                        if (capturedPaths.isNotEmpty()) {
                            canvas.drawRect(left, top, right, bottom, greenFramePaint)
                        }
                    }
                }
            }
        }.apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
    }

    private fun createGridOverlay(): View {
        return object : View(this) {
            private val gridPaint = Paint().apply {
                color = Color.parseColor("#44FFFFFF")
                style = Paint.Style.STROKE
                strokeWidth = dpToPx(1).toFloat()
            }

            override fun onDraw(canvas: Canvas) {
                super.onDraw(canvas)
                val w = width.toFloat()
                val h = height.toFloat()
                canvas.drawLine(w / 3f, 0f, w / 3f, h, gridPaint)
                canvas.drawLine(2f * w / 3f, 0f, 2f * w / 3f, h, gridPaint)
                canvas.drawLine(0f, h / 3f, w, h / 3f, gridPaint)
                canvas.drawLine(0f, 2f * h / 3f, w, 2f * h / 3f, gridPaint)
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
                val factory = previewView.meteringPointFactory
                val point = factory.createPoint(event.x, event.y)
                val action = FocusMeteringAction.Builder(point).build()
                cameraControl?.startFocusAndMetering(action)
            }
            true
        }
    }

    private fun cycleFlashMode() {
        val capture = imageCapture ?: return
        flashModeIndex = (flashModeIndex + 1) % 4
        when (flashModeIndex) {
            0 -> {
                capture.flashMode = ImageCapture.FLASH_MODE_AUTO
                cameraControl?.enableTorch(false)
                flashButtonText.text = "⚡A"
            }
            1 -> {
                capture.flashMode = ImageCapture.FLASH_MODE_ON
                cameraControl?.enableTorch(false)
                flashButtonText.text = "⚡"
            }
            2 -> {
                capture.flashMode = ImageCapture.FLASH_MODE_OFF
                cameraControl?.enableTorch(true)
                flashButtonText.text = "⚡ Torch"
            }
            3 -> {
                capture.flashMode = ImageCapture.FLASH_MODE_OFF
                cameraControl?.enableTorch(false)
                flashButtonText.text = "⚡ Off"
            }
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .setFlashMode(ImageCapture.FLASH_MODE_AUTO)
                .build()

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(
                    this,
                    cameraSelector,
                    preview,
                    imageCapture
                )
                cameraControl = camera?.cameraControl
            } catch (exc: Exception) {
                Toast.makeText(this, "Failed to start camera: ${exc.message}", Toast.LENGTH_SHORT).show()
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
                    runOnUiThread {
                        isCapturing = false
                        capturedPaths.add(photoFile.absolutePath)
                        searchingDocPill.visibility = View.GONE
                        updateCaptureRowUi()
                        frameGuideView.invalidate()

                        if (scanMode == "idcard") {
                            if (idCardSubMode == "single" || idCardSubMode == "passport") {
                                finishWithResults()
                            } else {
                                if (capturedPaths.size == 1) {
                                    Toast.makeText(this@DocumentScannerActivity, "Front saved! Now scan Back Side", Toast.LENGTH_SHORT).show()
                                } else if (capturedPaths.size >= 2) {
                                    finishWithResults()
                                }
                            }
                        }
                    }
                }

                override fun onError(exc: ImageCaptureException) {
                    runOnUiThread {
                        isCapturing = false
                        Toast.makeText(this@DocumentScannerActivity, "Photo capture failed: ${exc.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
    }

    private fun triggerCaptureFeedback() {
        flashOverlay.visibility = View.VISIBLE
        val anim = AlphaAnimation(1f, 0f).apply {
            duration = 180
            setAnimationListener(object : Animation.AnimationListener {
                override fun onAnimationStart(animation: Animation?) {}
                override fun onAnimationEnd(animation: Animation?) {
                    flashOverlay.visibility = View.GONE
                }
                override fun onAnimationRepeat(animation: Animation?) {}
            })
        }
        flashOverlay.startAnimation(anim)

        try {
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(50)
            }
        } catch (_: Exception) {}
    }

    private fun pickFromGallery() {
        val pickIntent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI).apply {
            type = "image/*"
        }
        startActivityForResult(pickIntent, REQUEST_GALLERY_PICK)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_GALLERY_PICK && resultCode == Activity.RESULT_OK && data != null) {
            val selectedUri: Uri? = data.data
            if (selectedUri != null) {
                val copiedPath = copyUriToCache(selectedUri)
                if (copiedPath != null) {
                    capturedPaths.add(copiedPath)
                    updateCaptureRowUi()
                    frameGuideView.invalidate()
                    finishWithResults()
                }
            }
        }
    }

    private fun copyUriToCache(uri: Uri): String? {
        return try {
            val inputStream = contentResolver.openInputStream(uri) ?: return null
            val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val tempFile = File(cacheDir, "imported_${timeStamp}.jpg")
            val outputStream = FileOutputStream(tempFile)
            inputStream.copyTo(outputStream)
            inputStream.close()
            outputStream.close()
            tempFile.absolutePath
        } catch (_: Exception) {
            null
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

    private fun handleExit() {
        val builder = AlertDialog.Builder(this)
            .setTitle("Exit Scanner?")
            .setMessage("Do you want to resume scanning or discard?")
            .setPositiveButton("Resume") { dialog, _ ->
                dialog.dismiss()
            }
            .setNegativeButton("Discard") { dialog, _ ->
                dialog.dismiss()
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

    private fun allPermissionsGranted() = ContextCompat.checkSelfPermission(
        baseContext, Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED

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

    override fun onDestroy() {
        super.onDestroy()
        qrLaserAnimator?.cancel()
        cameraExecutor.shutdown()
    }
}
