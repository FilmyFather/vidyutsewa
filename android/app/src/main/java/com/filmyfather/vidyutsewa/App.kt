package com.filmyfather.vidyutsewa

import android.app.Application

class App : Application() {
    override fun onCreate() { super.onCreate(); Notifier.channels(this) }
}
