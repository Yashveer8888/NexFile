package com.nexfile.modules

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

class NexPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            NexFileManagerModule(reactContext),
            NexVaultModule(reactContext),
            NexPdfModule(reactContext),
            NexConverterModule(reactContext),
            NexArchiveModule(reactContext),
            NexAppManagerModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(NexVideoViewManager())
    }
}
