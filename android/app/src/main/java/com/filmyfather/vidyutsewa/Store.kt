package com.filmyfather.vidyutsewa

import android.content.Context
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** All app data lives in the app's private storage: data.json + vault/<applicationId>/<slot>.pdf. Nothing leaves the device. */
object Store {
    private val lock = Any()
    private fun dataFile(c: Context) = File(c.filesDir, "data.json")
    fun vaultDir(c: Context, id: String): File = File(c.filesDir, "vault/" + id.replace(Regex("[^A-Za-z0-9_-]"), ""))
    fun docFile(c: Context, id: String, slot: String) = File(vaultDir(c, id), (if (slot == "formx") "formx" else "agreement") + ".pdf")
    fun docName(id: String, slot: String) = (if (slot == "formx") "FormX_" else "Agreement_") + id + ".pdf"

    fun readRaw(c: Context): String = synchronized(lock) { dataFile(c).takeIf { it.exists() }?.readText() ?: "" }

    fun read(c: Context): JSONObject = synchronized(lock) {
        try { JSONObject(readRaw(c).ifBlank { "{}" }) } catch (e: Exception) { JSONObject() }
    }

    private fun writeAtomic(c: Context, text: String) {
        val f = dataFile(c); val tmp = File(f.parentFile, "data.json.tmp")
        tmp.writeText(text); if (!tmp.renameTo(f)) { f.writeText(text); tmp.delete() }
    }

    /** Save from the UI. Status fields written by the background checker are kept when they are newer than the UI copy. */
    fun saveFromUi(c: Context, json: String) = synchronized(lock) {
        val incoming = JSONObject(json)
        val disk = read(c)
        val diskApps = disk.optJSONArray("apps")
        val inApps = incoming.optJSONArray("apps")
        if (diskApps != null && inApps != null) {
            val byId = HashMap<String, JSONObject>()
            for (i in 0 until diskApps.length()) diskApps.optJSONObject(i)?.let { byId[it.optString("id")] = it }
            for (i in 0 until inApps.length()) {
                val a = inApps.optJSONObject(i) ?: continue
                val d = byId[a.optString("id")] ?: continue
                if (d.optLong("lastChecked") > a.optLong("lastChecked")) {
                    for (k in CHECKER_FIELDS) if (d.has(k)) a.put(k, d.get(k)) else a.remove(k)
                }
            }
            // activity written by the checker since the UI loaded
            val dAct = disk.optJSONArray("activity"); val iAct = incoming.optJSONArray("activity")
            if (dAct != null && iAct != null && dAct.length() > 0) {
                val newest = if (iAct.length() > 0) iAct.optJSONObject(0)?.optLong("t") ?: 0 else 0
                val merged = JSONArray()
                for (i in 0 until dAct.length()) { val x = dAct.optJSONObject(i) ?: continue; if (x.optLong("t") > newest && x.optString("byChecker") == "1") merged.put(x) }
                for (i in 0 until iAct.length()) merged.put(iAct.get(i))
                incoming.put("activity", merged)
            }
            if (disk.optLong("lastSync") > incoming.optLong("lastSync")) incoming.put("lastSync", disk.optLong("lastSync"))
        }
        writeAtomic(c, incoming.toString())
    }

    fun update(c: Context, fn: (JSONObject) -> Unit) = synchronized(lock) { val d = read(c); fn(d); writeAtomic(c, d.toString()) }

    val CHECKER_FIELDS = listOf("status", "rawStatus", "docsUploaded", "lastChecked", "lastError", "history", "approvedAt", "fee", "receiptNo",
        "receiptDate", "consumerNo", "newName", "oldName", "applicationDate", "appliedAt", "reason", "subDivision", "certUrl", "docs", "docsDeleted",
        "lastReuploadAt", "reuploadState", "reuploadError", "reminded")

    fun saveDoc(c: Context, id: String, slot: String, b64: String): Long {
        val f = docFile(c, id, slot); f.parentFile?.mkdirs()
        val bytes = Base64.decode(b64, Base64.DEFAULT); f.writeBytes(bytes); return bytes.size.toLong()
    }
    fun readDoc(c: Context, id: String, slot: String): ByteArray? = docFile(c, id, slot).takeIf { it.exists() }?.readBytes()
    fun deleteDocs(c: Context, id: String) { vaultDir(c, id).deleteRecursively() }
    fun dirSize(f: File): Long = if (!f.exists()) 0 else if (f.isFile) f.length() else (f.listFiles() ?: arrayOf()).sumOf { dirSize(it) }
}
