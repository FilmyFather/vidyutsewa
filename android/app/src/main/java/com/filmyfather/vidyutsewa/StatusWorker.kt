package com.filmyfather.vidyutsewa

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class StatusWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        return try {
            val d = Store.read(applicationContext)
            if (d.optJSONObject("settings")?.optBoolean("notify", true) == false) return Result.success()
            Checker.run(applicationContext)
            Result.success()
        } catch (e: Exception) { Result.retry() }
    }

    companion object {
        private const val NAME = "vidyutsewa-status"
        fun schedule(c: Context, enabled: Boolean, minutes: Long) {
            val wm = WorkManager.getInstance(c)
            if (!enabled) { wm.cancelUniqueWork(NAME); return }
            val req = PeriodicWorkRequest.Builder(StatusWorker::class.java, maxOf(15L, minutes), TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .addTag("interval-$minutes")
                .build()
            wm.enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, req)
        }
    }
}
