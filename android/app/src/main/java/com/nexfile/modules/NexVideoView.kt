package com.nexfile.modules

import android.content.Context
import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.media.MediaPlayer
import android.media.PlaybackParams
import android.media.audiofx.LoudnessEnhancer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.Surface
import android.view.TextureView
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter

class NexVideoView(context: Context) : FrameLayout(context), TextureView.SurfaceTextureListener {
    private val textureView: TextureView = TextureView(context)
    private var mediaPlayer: MediaPlayer? = null
    private var surface: Surface? = null
    private var videoPath: String? = null
    private var isPrepared = false
    private var isPaused = false
    private var pendingSeek: Double? = null
    private var playbackSpeed = 1.0f
    private var volumeLevel = 1.0f
    private var isLoop = false
    private var resizeMode = "contain"
    private var videoWidth = 0
    private var videoHeight = 0
    private var loudnessEnhancer: LoudnessEnhancer? = null
    private var isSeeking = false
    private val handler = Handler(Looper.getMainLooper())

    private val progressRunnable = object : Runnable {
        override fun run() {
            try {
                if (mediaPlayer != null && isPrepared && mediaPlayer!!.isPlaying && !isSeeking) {
                    val currentPos = mediaPlayer!!.currentPosition
                    val duration = mediaPlayer!!.duration
                    val event = Arguments.createMap().apply {
                        putDouble("currentTime", currentPos.toDouble() / 1000.0)
                        putDouble("duration", duration.toDouble() / 1000.0)
                    }
                    (context as? ReactContext)
                        ?.getJSModule(RCTEventEmitter::class.java)
                        ?.receiveEvent(id, "topVideoProgress", event)
                }
            } catch (_: Exception) {}
            handler.postDelayed(this, 100)
        }
    }

    init {
        textureView.surfaceTextureListener = this
        val lp = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        addView(textureView, lp)
    }

    override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        surface = Surface(surfaceTexture)
        mediaPlayer?.setSurface(surface)
        if (mediaPlayer == null && videoPath != null) {
            setupMediaPlayer()
        } else {
            adjustAspectRatio()
        }
    }

    override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        adjustAspectRatio()
    }

    override fun onSurfaceTextureDestroyed(surfaceTexture: SurfaceTexture): Boolean {
        surface?.release()
        surface = null
        try {
            mediaPlayer?.setSurface(null)
        } catch (_: Exception) {}
        return true
    }

    override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) {}

    fun setSource(path: String?) {
        if (path == videoPath && mediaPlayer != null) return
        videoPath = path
        releasePlayer()
        if (surface != null && videoPath != null) {
            setupMediaPlayer()
        }
    }

    private fun setupMediaPlayer() {
        try {
            val path = videoPath ?: return
            val cleanPath = if (path.startsWith("file://")) path.substring(7) else path
            val mp = MediaPlayer()
            mediaPlayer = mp
            mp.setDataSource(context, Uri.parse(cleanPath))
            mp.setSurface(surface)
            mp.isLooping = isLoop

            mp.setOnVideoSizeChangedListener { _, w, h ->
                videoWidth = w
                videoHeight = h
                adjustAspectRatio()
            }

            mp.setOnPreparedListener {
                isPrepared = true
                videoWidth = mp.videoWidth
                videoHeight = mp.videoHeight
                adjustAspectRatio()

                val duration = mp.duration
                val event = Arguments.createMap().apply {
                    putDouble("duration", duration.toDouble() / 1000.0)
                    putInt("width", videoWidth)
                    putInt("height", videoHeight)
                }

                // Audio & Subtitle track enumeration
                try {
                    val tracks = mp.trackInfo
                    val audioTracks = Arguments.createArray()
                    val subtitleTracks = Arguments.createArray()
                    tracks.forEachIndexed { i, t ->
                        if (t.trackType == MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO) {
                            val map = Arguments.createMap()
                            map.putInt("index", i)
                            val lang = if (!t.language.isNullOrEmpty() && t.language != "und") t.language else "Track ${i + 1}"
                            map.putString("language", lang)
                            audioTracks.pushMap(map)
                        } else if (t.trackType == MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_TIMEDTEXT ||
                                   t.trackType == MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_SUBTITLE) {
                            val map = Arguments.createMap()
                            map.putInt("index", i)
                            val lang = if (!t.language.isNullOrEmpty() && t.language != "und") t.language else "Sub ${i + 1}"
                            map.putString("language", lang)
                            subtitleTracks.pushMap(map)
                        }
                    }
                    event.putArray("audioTracks", audioTracks)
                    event.putArray("subtitleTracks", subtitleTracks)
                    event.putBoolean("hasSubtitles", subtitleTracks.size() > 0)
                } catch (_: Exception) {}

                (context as? ReactContext)
                    ?.getJSModule(RCTEventEmitter::class.java)
                    ?.receiveEvent(id, "topVideoLoad", event)

                // Initialize LoudnessEnhancer for audio boost
                try {
                    loudnessEnhancer = LoudnessEnhancer(mp.audioSessionId)
                    applyVolumeBoost()
                } catch (_: Exception) {}

                applyPlaybackSpeed()

                if (pendingSeek != null && pendingSeek!! > 0) {
                    val targetSec = pendingSeek!!
                    pendingSeek = null
                    seekTo(targetSec)
                }

                if (!isPaused) {
                    mp.start()
                }
                handler.post(progressRunnable)
            }

            mp.setOnSeekCompleteListener {
                isSeeking = false
                try {
                    if (mediaPlayer != null && isPrepared) {
                        val currentPos = mediaPlayer!!.currentPosition
                        val duration = mediaPlayer!!.duration
                        val event = Arguments.createMap().apply {
                            putDouble("currentTime", currentPos.toDouble() / 1000.0)
                            putDouble("duration", duration.toDouble() / 1000.0)
                        }
                        (context as? ReactContext)
                            ?.getJSModule(RCTEventEmitter::class.java)
                            ?.receiveEvent(id, "topVideoProgress", event)
                    }
                } catch (_: Exception) {}
            }

            mp.setOnCompletionListener {
                val event = Arguments.createMap()
                (context as? ReactContext)
                    ?.getJSModule(RCTEventEmitter::class.java)
                    ?.receiveEvent(id, "topVideoEnd", event)
            }

            mp.setOnErrorListener { _, what, extra ->
                val event = Arguments.createMap().apply {
                    putString("error", "Playback error code: $what, extra: $extra")
                }
                (context as? ReactContext)
                    ?.getJSModule(RCTEventEmitter::class.java)
                    ?.receiveEvent(id, "topVideoError", event)
                true
            }

            mp.prepareAsync()
        } catch (e: Exception) {
            val event = Arguments.createMap().apply {
                putString("error", e.message ?: "Failed to open video")
            }
            (context as? ReactContext)
                ?.getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(id, "topVideoError", event)
        }
    }

    fun setPaused(paused: Boolean) {
        isPaused = paused
        try {
            if (mediaPlayer != null && isPrepared) {
                if (paused && mediaPlayer!!.isPlaying) {
                    mediaPlayer!!.pause()
                } else if (!paused && !mediaPlayer!!.isPlaying) {
                    mediaPlayer!!.start()
                }
            }
        } catch (_: Exception) {}
    }

    private var lastSeekMs: Long = -1L

    fun seekTo(seconds: Double) {
        if (seconds < 0) return
        val ms = (seconds * 1000).toLong()
        if (ms == lastSeekMs && isSeeking) return
        lastSeekMs = ms
        try {
            if (mediaPlayer != null && isPrepared) {
                isSeeking = true
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    mediaPlayer!!.seekTo(ms, MediaPlayer.SEEK_CLOSEST_SYNC)
                } else {
                    mediaPlayer!!.seekTo(ms.toInt())
                }
            } else {
                pendingSeek = seconds
            }
        } catch (_: Exception) {
            isSeeking = false
        }
    }

    fun setSpeed(speed: Float) {
        playbackSpeed = speed
        applyPlaybackSpeed()
    }

    private fun applyPlaybackSpeed() {
        try {
            if (mediaPlayer != null && isPrepared) {
                val params = mediaPlayer!!.playbackParams ?: PlaybackParams()
                params.speed = playbackSpeed
                mediaPlayer!!.playbackParams = params
            }
        } catch (_: Exception) {}
    }

    fun setVolume(vol: Float) {
        volumeLevel = vol
        applyVolumeBoost()
    }

    private fun applyVolumeBoost() {
        try {
            if (mediaPlayer != null) {
                if (volumeLevel <= 1.0f) {
                    mediaPlayer!!.setVolume(volumeLevel, volumeLevel)
                    loudnessEnhancer?.enabled = false
                } else {
                    mediaPlayer!!.setVolume(1.0f, 1.0f)
                    // Up to +2000 mB (+20 dB) for 200% volume
                    loudnessEnhancer?.apply {
                        val gainMb = ((volumeLevel - 1.0f) * 2000).toInt()
                        setTargetGain(gainMb)
                        enabled = true
                    }
                }
            }
        } catch (_: Exception) {}
    }

    fun setLoop(loop: Boolean) {
        isLoop = loop
        try {
            mediaPlayer?.isLooping = loop
        } catch (_: Exception) {}
    }

    fun setResizeMode(mode: String) {
        resizeMode = mode
        adjustAspectRatio()
    }

    fun selectAudioTrack(index: Int) {
        try {
            mediaPlayer?.selectTrack(index)
        } catch (_: Exception) {}
    }

    private fun adjustAspectRatio() {
        if (videoWidth == 0 || videoHeight == 0) return
        val viewWidth = width
        val viewHeight = height
        if (viewWidth == 0 || viewHeight == 0) return

        val viewAspect = viewWidth.toFloat() / viewHeight.toFloat()
        val videoAspect = videoWidth.toFloat() / videoHeight.toFloat()

        var scaleX = 1.0f
        var scaleY = 1.0f

        when (resizeMode) {
            "cover" -> {
                if (videoAspect > viewAspect) {
                    scaleX = videoAspect / viewAspect
                } else {
                    scaleY = viewAspect / videoAspect
                }
            }
            "stretch" -> {
                scaleX = 1.0f
                scaleY = 1.0f
            }
            "zoom" -> {
                scaleX = 1.35f
                scaleY = 1.35f
            }
            else -> { // "contain"
                if (videoAspect > viewAspect) {
                    scaleY = viewAspect / videoAspect
                } else {
                    scaleX = videoAspect / viewAspect
                }
            }
        }

        val matrix = Matrix()
        matrix.setScale(scaleX, scaleY, viewWidth / 2f, viewHeight / 2f)
        textureView.setTransform(matrix)
    }

    fun releasePlayer() {
        handler.removeCallbacks(progressRunnable)
        try {
            loudnessEnhancer?.release()
            loudnessEnhancer = null
        } catch (_: Exception) {}
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (_: Exception) {}
        isPrepared = false
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        releasePlayer()
        surface?.release()
        surface = null
    }
}
