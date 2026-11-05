package com.filmyfather.vidyutsewa

import android.content.Context
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** All app data lives in the app's private storage: data.json + vault/<applicationId>/<slot>.pdf. Nothing leaves the device. */
object Store {
    const val UPLOAD_LIMIT = 1048576
    /** Gentle JPEG shrink for a picture over 1 MB: highest resolution and quality that still end just under 1 MB. */
    fun shrinkImage(bytes: ByteArray): ByteArray? {
        val src = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
        var scale = minOf(1.0, 3200.0 / maxOf(src.width, src.height))
        repeat(12) {
            val bmp = if (scale < 1.0) android.graphics.Bitmap.createScaledBitmap(src, (src.width * scale).toInt().coerceAtLeast(1), (src.height * scale).toInt().coerceAtLeast(1), true) else src
            var q = 95
            while (q >= 50) {
                val bo = java.io.ByteArrayOutputStream(); bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, q, bo)
                if (bo.size() <= 1000000) { if (q >= 72) return bo.toByteArray() else if (scale <= 0.4) return bo.toByteArray(); break }
                q -= 5
            }
            scale *= 0.88
        }
        return null
    }
    private val lock = Any()
    private fun dataFile(c: Context) = File(c.filesDir, "data.json")
    fun vaultDir(c: Context, id: String): File = File(c.filesDir, "vault/" + id.replace(Regex("[^A-Za-z0-9_-]"), ""))
    fun slotFile(slot: String) = when (slot) { "formx" -> "formx.pdf"; "single" -> "single.pdf"; "receiptimg" -> "receipt_img.jpg"; "receiptpdf" -> "receipt_pdf.pdf"; else -> "agreement.pdf" }
    fun docFile(c: Context, id: String, slot: String) = File(vaultDir(c, id), slotFile(slot))
    /** Upload-safe name: letters, digits, _ and - only (the official page rejects spaces and special characters). */
    fun safeName(name: String, fallbackBase: String = "Document", fallbackExt: String = "pdf"): String {
        val dot = name.lastIndexOf('.')
        val hasExt = dot > 0 && dot < name.length - 1 && name.length - dot <= 6
        val ext = (if (hasExt) name.substring(dot + 1) else fallbackExt).replace(Regex("[^A-Za-z0-9]"), "").lowercase().ifEmpty { fallbackExt }
        var base = (if (hasExt) name.substring(0, dot) else name).replace(Regex("[^A-Za-z0-9_-]+"), "_").replace(Regex("_{2,}"), "_").trim('_', '-').take(60)
        if (base.isEmpty()) base = fallbackBase
        return "$base.$ext"
    }
    fun docName(id: String, slot: String) = safeName((when (slot) { "formx" -> "FormX_"; "single" -> "SpellingCorrection_"; "receiptimg" -> "Receipt_"; "receiptpdf" -> "Receipt_"; else -> "Agreement_" }) + id + (if (slot == "receiptimg") ".jpg" else ".pdf"))
    /** Slots an application needs: spelling correction = one PDF, normal = Agreement + Form X. */
    fun slotsFor(a: JSONObject) = if (a.optString("docMode") == "spell") listOf("single") else listOf("agreement", "formx")

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
    /** Deletes the application PDFs; the paid receipt (image + PDF) is the customer's proof and stays. */
    fun deleteDocs(c: Context, id: String) { val d = vaultDir(c, id); d.listFiles()?.forEach { if (!it.name.startsWith("receipt_")) it.delete() }; if (d.listFiles().isNullOrEmpty()) d.deleteRecursively() }
    fun dirSize(f: File): Long = if (!f.exists()) 0 else if (f.isFile) f.length() else (f.listFiles() ?: arrayOf()).sumOf { dirSize(it) }
}
