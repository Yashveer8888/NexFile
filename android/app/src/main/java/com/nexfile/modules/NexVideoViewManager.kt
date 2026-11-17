package com.nexfile.modules

import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class NexVideoViewManager : SimpleViewManager<NexVideoView>() {
    override fun getName(): String = "NexVideoView"

    override fun createViewInstance(reactContext: ThemedReactContext): NexVideoView {
        return NexVideoView(reactContext)
    }

    @ReactProp(name = "videoPath")
    fun setVideoPath(view: NexVideoView, path: String?) {
        view.setSource(path)
    }

    @ReactProp(name = "paused")
    fun setPaused(view: NexVideoView, paused: Boolean) {
        view.setPaused(paused)
    }

    @ReactProp(name = "seekTo")
    fun setSeekTo(view: NexVideoView, seconds: Double) {
        view.seekTo(seconds)
    }

    @ReactProp(name = "rate", defaultFloat = 1.0f)
    fun setRate(view: NexVideoView, rate: Float) {
        view.setSpeed(rate)
    }

    @ReactProp(name = "volume", defaultFloat = 1.0f)
    fun setVolume(view: NexVideoView, volume: Float) {
        view.setVolume(volume)
    }

    @ReactProp(name = "isLooping", defaultBoolean = false)
    fun setIsLooping(view: NexVideoView, looping: Boolean) {
        view.setLoop(looping)
    }

    @ReactProp(name = "resizeMode")
    fun setResizeMode(view: NexVideoView, mode: String?) {
        view.setResizeMode(mode ?: "contain")
    }

    @ReactProp(name = "selectedAudioTrack", defaultInt = -1)
    fun setSelectedAudioTrack(view: NexVideoView, index: Int) {
        if (index >= 0) {
            view.selectAudioTrack(index)
        }
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any>? {
        return MapBuilder.builder<String, Any>()
            .put("topVideoProgress", MapBuilder.of("registrationName", "onVideoProgress"))
            .put("topVideoLoad", MapBuilder.of("registrationName", "onVideoLoad"))
            .put("topVideoEnd", MapBuilder.of("registrationName", "onVideoEnd"))
            .put("topVideoError", MapBuilder.of("registrationName", "onVideoError"))
            .build()
    }

    override fun onDropViewInstance(view: NexVideoView) {
        super.onDropViewInstance(view)
        view.releasePlayer()
    }
}
