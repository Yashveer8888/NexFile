package com.nexfile.modules

import android.content.Context
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.graphics.Typeface
import android.media.audiofx.LoudnessEnhancer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.common.text.CueGroup
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.SubtitleView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.io.File
import java.util.Locale

@OptIn(UnstableApi::class)
class NexVideoView(context: Context) : FrameLayout(context), TextureView.SurfaceTextureListener {
    private val textureView: TextureView = TextureView(context)
    private var subtitleView: SubtitleView? = null
    private var exoPlayer: ExoPlayer? = null
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

    private data class TrackRef(
        val group: Tracks.Group,
        val formatIndex: Int,
        val languageLabel: String
    )

    private val audioTrackRefs = mutableListOf<TrackRef>()
    private val textTrackRefs = mutableListOf<TrackRef>()
    private var targetAudioTrackIndex = -1
    @Volatile private var targetSubtitleTrackIndex = -1
    @Volatile private var isSubtitlesEnabled = false

    private val progressRunnable = object : Runnable {
        override fun run() {
            try {
                val player = exoPlayer
                if (player != null && isPrepared && player.isPlaying && !isSeeking) {
                    val currentPos = player.currentPosition
                    val dur = player.duration
                    if (dur > 0) {
                        val event = Arguments.createMap().apply {
                            putDouble("currentTime", currentPos.toDouble() / 1000.0)
                            putDouble("duration", dur.toDouble() / 1000.0)
                        }
                        (context as? ReactContext)
                            ?.getJSModule(RCTEventEmitter::class.java)
                            ?.receiveEvent(id, "topVideoProgress", event)
                    }
                }
            } catch (_: Exception) {}
            handler.postDelayed(this, 100)
        }
    }

    init {
        textureView.surfaceTextureListener = this
        val lp = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        addView(textureView, lp)

        subtitleView = SubtitleView(context).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            setApplyEmbeddedStyles(false)
            setApplyEmbeddedFontSizes(false)
            setFixedTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f)
            val style = CaptionStyleCompat(
                Color.WHITE,
                Color.parseColor("#99000000"),
                Color.TRANSPARENT,
                CaptionStyleCompat.EDGE_TYPE_OUTLINE,
                Color.BLACK,
                Typeface.DEFAULT_BOLD
            )
            setStyle(style)
            setPadding(dpToPx(24), dpToPx(16), dpToPx(24), dpToPx(56))
            visibility = View.GONE
        }
        addView(subtitleView)
    }

    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            context.resources.displayMetrics
        ).toInt()
    }

    override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        surface = Surface(surfaceTexture)
        exoPlayer?.setVideoSurface(surface)
        if (exoPlayer == null && videoPath != null) {
            setupPlayer()
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
            exoPlayer?.setVideoSurface(null)
        } catch (_: Exception) {}
        return true
    }

    override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) {}

    fun setSource(path: String?) {
        if (path == videoPath && exoPlayer != null) return
        videoPath = path
        releasePlayer()
        if (surface != null && videoPath != null) {
            setupPlayer()
        }
    }

    private fun setupPlayer() {
        try {
            val path = videoPath ?: return
            val cleanPath = if (path.startsWith("file://")) path.substring(7) else path
            val uri = if (cleanPath.startsWith("content://") || cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
                Uri.parse(cleanPath)
            } else {
                Uri.fromFile(File(cleanPath))
            }

            val player = ExoPlayer.Builder(context).build()
            val initialTrackParams = player.trackSelectionParameters.buildUpon()
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                .setIgnoredTextSelectionFlags(C.SELECTION_FLAG_DEFAULT or C.SELECTION_FLAG_FORCED)
                .setPreferredTextLanguage(null)
                .build()
            player.trackSelectionParameters = initialTrackParams
            exoPlayer = player
            player.setVideoSurface(surface)
            player.repeatMode = if (isLoop) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
            player.playWhenReady = !isPaused
            player.playbackParameters = PlaybackParameters(playbackSpeed)

            player.addListener(object : Player.Listener {
                override fun onVideoSizeChanged(videoSize: VideoSize) {
                    videoWidth = videoSize.width
                    videoHeight = videoSize.height
                    adjustAspectRatio()
                }

                override fun onCues(cueGroup: CueGroup) {
                    if (!isSubtitlesEnabled || targetSubtitleTrackIndex < 0) {
                        post {
                            subtitleView?.setCues(emptyList())
                            subtitleView?.visibility = View.GONE
                        }
                        return
                    }
                    val rawCues = cueGroup.cues
                    post {
                        if (isSubtitlesEnabled && targetSubtitleTrackIndex >= 0 && rawCues.isNotEmpty()) {
                            val cleanCues = rawCues.distinctBy { it.text?.toString()?.trim() }
                            val singleCueList = if (cleanCues.size > 1) listOf(cleanCues.first()) else cleanCues
                            subtitleView?.visibility = View.VISIBLE
                            subtitleView?.bringToFront()
                            subtitleView?.setCues(singleCueList)
                        } else {
                            subtitleView?.setCues(emptyList())
                            subtitleView?.visibility = View.GONE
                        }
                    }
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    when (playbackState) {
                        Player.STATE_READY -> {
                            if (!isPrepared) {
                                isPrepared = true
                                val durationMs = player.duration
                                val event = Arguments.createMap().apply {
                                    putDouble("duration", if (durationMs > 0) durationMs.toDouble() / 1000.0 else 0.0)
                                    putInt("width", videoWidth)
                                    putInt("height", videoHeight)
                                }

                                // Populate audio and subtitle tracks
                                enumerateTracks(player.currentTracks, event)

                                (context as? ReactContext)
                                    ?.getJSModule(RCTEventEmitter::class.java)
                                    ?.receiveEvent(id, "topVideoLoad", event)

                                // Setup LoudnessEnhancer for boost
                                setupLoudnessEnhancer(player.audioSessionId)
                                applyVolume()

                                if (pendingSeek != null && pendingSeek!! > 0) {
                                    val targetSec = pendingSeek!!
                                    pendingSeek = null
                                    seekTo(targetSec)
                                }

                                handler.post(progressRunnable)
                            }
                        }
                        Player.STATE_ENDED -> {
                            val event = Arguments.createMap()
                            (context as? ReactContext)
                                ?.getJSModule(RCTEventEmitter::class.java)
                                ?.receiveEvent(id, "topVideoEnd", event)
                        }
                        else -> {}
                    }
                }

                override fun onTracksChanged(tracks: Tracks) {
                    if (isPrepared) {
                        enumerateTracks(tracks, null)
                    }
                }

                override fun onPlayerError(error: PlaybackException) {
                    val event = Arguments.createMap().apply {
                        putString("error", error.message ?: "Playback error: ${error.errorCodeName}")
                    }
                    (context as? ReactContext)
                        ?.getJSModule(RCTEventEmitter::class.java)
                        ?.receiveEvent(id, "topVideoError", event)
                }
            })

            // Auto-detect sidecar subtitle files (.srt, .vtt, .ass, .ssa) in same directory
            val subtitleConfigs = mutableListOf<MediaItem.SubtitleConfiguration>()
            try {
                val videoFile = File(cleanPath)
                if (videoFile.exists() && videoFile.parentFile != null) {
                    val parent = videoFile.parentFile
                    val baseName = videoFile.nameWithoutExtension
                    parent?.listFiles()?.forEach { file ->
                        val name = file.name
                        val ext = file.extension.lowercase(Locale.ROOT)
                        if ((ext == "srt" || ext == "vtt" || ext == "ass" || ext == "ssa") &&
                            (name.startsWith(baseName, ignoreCase = true) || name.contains("sub", ignoreCase = true))
                        ) {
                            val mime = when (ext) {
                                "vtt" -> MimeTypes.TEXT_VTT
                                "ass", "ssa" -> MimeTypes.TEXT_SSA
                                else -> MimeTypes.APPLICATION_SUBRIP
                            }
                            val subLabel = if (name.equals("$baseName.$ext", ignoreCase = true)) {
                                "External (${ext.uppercase(Locale.ROOT)})"
                            } else {
                                val extra = name.removePrefix(baseName).removeSuffix(".$ext").trim('.', '-', '_', ' ')
                                if (extra.isNotEmpty()) "External ($extra)" else "External (${ext.uppercase(Locale.ROOT)})"
                            }
                            val subConfig = MediaItem.SubtitleConfiguration.Builder(Uri.fromFile(file))
                                .setMimeType(mime)
                                .setLanguage(subLabel)
                                .setLabel(subLabel)
                                .setSelectionFlags(0)
                                .build()
                            subtitleConfigs.add(subConfig)
                        }
                    }
                }
            } catch (_: Exception) {}

            val mediaItemBuilder = MediaItem.Builder().setUri(uri)
            if (subtitleConfigs.isNotEmpty()) {
                mediaItemBuilder.setSubtitleConfigurations(subtitleConfigs)
            }
            val mediaItem = mediaItemBuilder.build()

            player.setMediaItem(mediaItem)
            player.prepare()
        } catch (e: Exception) {
            val event = Arguments.createMap().apply {
                putString("error", e.message ?: "Failed to open video")
            }
            (context as? ReactContext)
                ?.getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(id, "topVideoError", event)
        }
    }

    private fun enumerateTracks(tracks: Tracks, event: com.facebook.react.bridge.WritableMap? = null) {
        audioTrackRefs.clear()
        textTrackRefs.clear()

        val audioTracks = Arguments.createArray()
        val subtitleTracks = Arguments.createArray()
        var audioIdx = 0
        var subIdx = 0

        for (group in tracks.groups) {
            if (group.type == C.TRACK_TYPE_AUDIO) {
                for (i in 0 until group.length) {
                    val format = group.getTrackFormat(i)
                    val rawLang = format.language?.takeIf { it.isNotEmpty() && it != "und" }
                    val resolvedLang = rawLang?.let { code ->
                        try {
                            val loc = Locale(code)
                            val display = loc.getDisplayLanguage(Locale.getDefault())
                            if (display.isNotEmpty()) display else code
                        } catch (_: Exception) {
                            code
                        }
                    }

                    var label = format.label?.takeIf { it.isNotEmpty() }
                        ?: resolvedLang
                        ?: "Audio Track ${audioIdx + 1}"

                    if (format.channelCount > 0) {
                        val ch = when (format.channelCount) {
                            1 -> "Mono"
                            2 -> "Stereo"
                            6 -> "5.1 Surround"
                            8 -> "7.1 Surround"
                            else -> "${format.channelCount}ch"
                        }
                        if (!label.contains(ch, ignoreCase = true)) {
                            label = "$label ($ch)"
                        }
                    }

                    audioTrackRefs.add(TrackRef(group, i, label))

                    val map = Arguments.createMap()
                    map.putInt("index", audioIdx)
                    map.putString("language", label)
                    audioTracks.pushMap(map)
                    audioIdx++
                }
            } else if (group.type == C.TRACK_TYPE_TEXT) {
                for (i in 0 until group.length) {
                    val format = group.getTrackFormat(i)
                    val rawLang = format.language?.takeIf { it.isNotEmpty() && it != "und" }
                    val resolvedLang = rawLang?.let { code ->
                        try {
                            val loc = Locale(code)
                            val display = loc.getDisplayLanguage(Locale.getDefault())
                            if (display.isNotEmpty()) display else code
                        } catch (_: Exception) {
                            code
                        }
                    }

                    val label = format.label?.takeIf { it.isNotEmpty() }
                        ?: resolvedLang
                        ?: "Subtitle ${subIdx + 1}"

                    textTrackRefs.add(TrackRef(group, i, label))

                    val map = Arguments.createMap()
                    map.putInt("index", subIdx)
                    map.putString("language", label)
                    subtitleTracks.pushMap(map)
                    subIdx++
                }
            }
        }

        event?.putArray("audioTracks", audioTracks)
        event?.putArray("subtitleTracks", subtitleTracks)
        event?.putBoolean("hasSubtitles", subtitleTracks.size() > 0)

        // Automatically apply targeted tracks
        if (targetAudioTrackIndex >= 0) {
            selectAudioTrack(targetAudioTrackIndex)
        }
        if (isSubtitlesEnabled && targetSubtitleTrackIndex >= 0) {
            selectSubtitleTrack(targetSubtitleTrackIndex)
        } else {
            selectSubtitleTrack(-1)
        }
    }

    private fun setupLoudnessEnhancer(audioSessionId: Int) {
        try {
            if (audioSessionId != C.AUDIO_SESSION_ID_UNSET) {
                loudnessEnhancer?.release()
                loudnessEnhancer = LoudnessEnhancer(audioSessionId)
            }
        } catch (_: Exception) {}
    }

    fun setPaused(paused: Boolean) {
        isPaused = paused
        exoPlayer?.playWhenReady = !paused
    }

    private var lastSeekMs: Long = -1L

    fun seekTo(seconds: Double) {
        if (seconds < 0) return
        val ms = (seconds * 1000).toLong()
        if (ms == lastSeekMs && isSeeking) return
        lastSeekMs = ms
        val player = exoPlayer
        if (player != null && isPrepared) {
            isSeeking = true
            player.seekTo(ms)
            val dur = player.duration
            val event = Arguments.createMap().apply {
                putDouble("currentTime", seconds)
                putDouble("duration", if (dur > 0) dur.toDouble() / 1000.0 else 0.0)
            }
            (context as? ReactContext)
                ?.getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(id, "topVideoProgress", event)
            isSeeking = false
        } else {
            pendingSeek = seconds
        }
    }

    fun setSpeed(speed: Float) {
        playbackSpeed = speed
        exoPlayer?.playbackParameters = PlaybackParameters(speed)
    }

    fun setVolume(vol: Float) {
        volumeLevel = vol
        applyVolume()
    }

    private fun applyVolume() {
        val player = exoPlayer ?: return
        try {
            if (volumeLevel <= 1.0f) {
                player.volume = volumeLevel.coerceIn(0f, 1f)
                loudnessEnhancer?.enabled = false
            } else {
                player.volume = 1.0f
                loudnessEnhancer?.apply {
                    val gainMb = ((volumeLevel - 1.0f) * 2000).toInt()
                    setTargetGain(gainMb)
                    enabled = true
                }
            }
        } catch (_: Exception) {}
    }

    fun setLoop(loop: Boolean) {
        isLoop = loop
        exoPlayer?.repeatMode = if (loop) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
    }

    fun setResizeMode(mode: String) {
        resizeMode = mode
        adjustAspectRatio()
    }

    fun selectAudioTrack(index: Int) {
        targetAudioTrackIndex = index
        val player = exoPlayer ?: return
        try {
            if (index in 0 until audioTrackRefs.size) {
                val ref = audioTrackRefs[index]
                val builder = player.trackSelectionParameters.buildUpon()
                builder.clearOverridesOfType(C.TRACK_TYPE_AUDIO)
                builder.setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
                builder.setOverrideForType(
                    TrackSelectionOverride(ref.group.mediaTrackGroup, listOf(ref.formatIndex))
                )
                ref.group.getTrackFormat(ref.formatIndex).language?.let {
                    builder.setPreferredAudioLanguage(it)
                }
                player.trackSelectionParameters = builder.build()
            }
        } catch (e: Exception) {
            android.util.Log.e("NexVideoView", "Failed to switch audio track to $index", e)
        }
    }

    fun selectSubtitleTrack(index: Int) {
        val player = exoPlayer
        if (index < 0 || textTrackRefs.isEmpty() || index >= textTrackRefs.size) {
            isSubtitlesEnabled = false
            targetSubtitleTrackIndex = -1
            post {
                subtitleView?.setCues(emptyList())
                subtitleView?.visibility = View.GONE
            }
            if (player != null) {
                try {
                    val builder = player.trackSelectionParameters.buildUpon()
                    builder.clearOverridesOfType(C.TRACK_TYPE_TEXT)
                    builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                    builder.setPreferredTextLanguage(null)
                    builder.setIgnoredTextSelectionFlags(C.SELECTION_FLAG_DEFAULT or C.SELECTION_FLAG_FORCED)
                    player.trackSelectionParameters = builder.build()
                } catch (e: Exception) {
                    android.util.Log.e("NexVideoView", "Failed to disable subtitle track", e)
                }
            }
            return
        }

        isSubtitlesEnabled = true
        targetSubtitleTrackIndex = index
        if (player != null) {
            try {
                val ref = textTrackRefs[index]
                val builder = player.trackSelectionParameters.buildUpon()
                builder.clearOverridesOfType(C.TRACK_TYPE_TEXT)
                builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                builder.setIgnoredTextSelectionFlags(C.SELECTION_FLAG_DEFAULT or C.SELECTION_FLAG_FORCED)
                builder.setOverrideForType(
                    TrackSelectionOverride(ref.group.mediaTrackGroup, listOf(ref.formatIndex))
                )
                ref.group.getTrackFormat(ref.formatIndex).language?.let {
                    builder.setPreferredTextLanguage(it)
                }
                player.trackSelectionParameters = builder.build()
                post {
                    subtitleView?.visibility = View.VISIBLE
                    subtitleView?.bringToFront()
                }
            } catch (e: Exception) {
                android.util.Log.e("NexVideoView", "Failed to switch subtitle track to $index", e)
            }
        }
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
        isSubtitlesEnabled = false
        targetSubtitleTrackIndex = -1
        subtitleView?.setCues(emptyList())
        subtitleView?.visibility = View.GONE
        audioTrackRefs.clear()
        textTrackRefs.clear()
        try {
            loudnessEnhancer?.release()
            loudnessEnhancer = null
        } catch (_: Exception) {}
        try {
            exoPlayer?.stop()
            exoPlayer?.release()
            exoPlayer = null
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
