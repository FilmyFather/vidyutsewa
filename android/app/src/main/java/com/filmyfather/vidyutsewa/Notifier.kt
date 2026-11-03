package com.filmyfather.vidyutsewa

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object Notifier {
    const val CH_SOUND = "status_sound"
    const val CH_SILENT = "status_silent"
    fun channels(c: Context) {
        if (Build.VERSION.SDK_INT >= 26) {
            val nm = c.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CH_SOUND, "Application Status", NotificationManager.IMPORTANCE_HIGH))
            nm.createNotificationChannel(NotificationChannel(CH_SILENT, "Application Status (Silent)", NotificationManager.IMPORTANCE_DEFAULT).apply { setSound(null, null); enableVibration(false) })
        }
    }
    fun show(c: Context, title: String, body: String, sound: Boolean = true, appId: String? = null) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val open = Intent(c, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP; if (appId != null) putExtra("openApp", appId) }
        val pi = PendingIntent.getActivity(c, (title.hashCode() and 0xffff), open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(c, if (sound) CH_SOUND else CH_SILENT)
            .setSmallIcon(R.drawable.ic_stat)
            .setContentTitle(title).setContentText(body).setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true).setContentIntent(pi)
            .setPriority(if (sound) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .apply { if (!sound) setSilent(true) }
            .build()
        try { NotificationManagerCompat.from(c).notify((System.currentTimeMillis() % 100000).toInt(), n) } catch (_: SecurityException) {}
    }
}
