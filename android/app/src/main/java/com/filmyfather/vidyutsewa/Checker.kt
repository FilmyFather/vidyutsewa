package com.filmyfather.vidyutsewa

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Background status tracking (port of web/js/core.js checkApp / reupload). Runs from WorkManager and from "Check Now". */
object Checker {
    data class Ev(val title: String, val body: String, val id: String)
    private const val DAY = 86400000L
    @Volatile var listener: (() -> Unit)? = null   // MainActivity refreshes the UI when data changes

    private fun log(d: JSONObject, type: String, text: String, id: String) {
        val act = d.optJSONArray("activity") ?: JSONArray()
        val n = JSONArray(); n.put(JSONObject().put("t", System.currentTimeMillis()).put("type", type).put("text", text).put("id", id).put("byChecker", "1"))
        for (i in 0 until minOf(act.length(), 199)) n.put(act.get(i))
        d.put("activity", n)
    }
    private fun hasDocs(c: Context, a: JSONObject): Boolean {
        val id = a.optString("id"); return Store.docFile(c, id, "agreement").exists() && Store.docFile(c, id, "formx").exists()
    }

    private fun apply(a: JSONObject, p: Parser.Status) {
        if (p.consumerNo.isNotEmpty()) a.put("consumerNo", p.consumerNo)
        if (p.newName.isNotEmpty()) a.put("newName", p.newName)
        if (p.oldName.isNotEmpty()) a.put("oldName", p.oldName)
        if (p.mobile.isNotEmpty() && a.optString("mobile").isEmpty()) a.put("mobile", p.mobile)
        if (p.applicationDate.isNotEmpty()) { a.put("applicationDate", p.applicationDate); Parser.parseDate(p.applicationDate)?.let { a.put("appliedAt", it) } }
        p.docsUploaded?.let { a.put("docsUploaded", it) }
        if (p.fee.isNotEmpty()) a.put("fee", p.fee)
        if (p.receiptNo.isNotEmpty()) { a.put("receiptNo", p.receiptNo); a.put("receiptDate", p.receiptDate) }
        if (p.reason.isNotEmpty()) a.put("reason", p.reason)
        if (p.subDivision.isNotEmpty()) a.put("subDivision", p.subDivision)
        if (p.certificateUrl.isNotEmpty()) a.put("certUrl", p.certificateUrl)
        a.put("rawStatus", p.rawStatus.ifEmpty { a.optString("rawStatus") })
    }

    fun fetch(id: String, session: String = "check"): Pair<Parser.Status, String> {
        val r = Net.request(Parser.statusUrl(id), session = session)
        if (r.status >= 400) throw Exception("Official Site Error ${r.status}")
        return Parser.parse(r.text) to r.text
    }

    private fun checkOne(c: Context, d: JSONObject, a: JSONObject, s: JSONObject): List<Ev> {
        val ev = mutableListOf<Ev>()
        val id = a.optString("id")
        val (p, _) = fetch(id)
        a.put("lastChecked", System.currentTimeMillis())
        if (!p.found) { a.put("lastError", "Not Found On Official Site"); return ev }
        a.put("lastError", "")
        val prev = a.optString("status", "pending")
        apply(a, p)
        val next = p.status
        if (next != prev) {
            a.put("status", next)
            val h = a.optJSONArray("history") ?: JSONArray(); h.put(JSONObject().put("t", System.currentTimeMillis()).put("text", p.rawStatus.ifEmpty { next })); a.put("history", h)
            if (next == "approved") {
                a.put("approvedAt", System.currentTimeMillis())
                log(d, "approved", "Application Approved - $id", id)
                ev.add(Ev("Application Approved - $id", a.optString("newName") + " \u2022 Name Change Approved", id))
                if (s.optBoolean("autoDelete", true)) {
                    Store.deleteDocs(c, id); a.put("docs", JSONObject()); a.put("docsDeleted", true)
                    log(d, "deleted", "Documents Deleted After Approval - $id", id)
                }
            } else if (next == "rejected") {
                log(d, "rejected", "Application Rejected - $id", id)
                ev.add(Ev("Application Rejected - $id", p.rawStatus.ifEmpty { "Please Check The Application" }, id))
            }
        }
        val needUpload = (a.optString("status") == "rejected" || p.docsUploaded == 0) && a.optString("status") != "approved"
        val recently = System.currentTimeMillis() - a.optLong("lastReuploadAt") < 6 * 3600000L
        if (needUpload && s.optBoolean("autoReupload", true) && hasDocs(c, a) && !recently) ev.addAll(reupload(c, d, a))
        // 3-day upload deadline reminder
        if (s.optBoolean("reminder", true) && a.optString("status") == "pending" && a.optInt("docsUploaded", 0) <= 0 && !a.optBoolean("reminded")) {
            val applied = a.optLong("appliedAt", a.optLong("addedAt"))
            val left = applied + 3 * DAY - System.currentTimeMillis()
            if (applied > 0 && left in 1 until DAY) { a.put("reminded", true); ev.add(Ev("Upload Deadline Today - $id", "Upload Documents Before The 3-Day Deadline Ends", id)) }
        }
        return ev
    }

    /** Best effort automatic re-upload via the public upload page (ASP.NET postback). Not verified on a real rejected application. */
    fun reupload(c: Context, d: JSONObject, a: JSONObject): List<Ev> {
        val id = a.optString("id")
        val ev = mutableListOf(Ev("Re-Uploading Document - $id", "Uploading Agreement And Form X Again", id))
        a.put("lastReuploadAt", System.currentTimeMillis())
        try {
            val page = Net.request(Parser.statusUrl(id), session = "upload-$id")
            val p = Parser.parse(page.text)
            if (!p.hasUploadForm) throw Exception("Upload Form Not Shown Without Login")
            val fields = Parser.aspFields(page.text)
            Parser.uploadButton(page.text)?.let { fields[it.first] = it.second }
            val ag = Store.readDoc(c, id, "agreement") ?: throw Exception("Saved Documents Missing")
            val fx = Store.readDoc(c, id, "formx") ?: throw Exception("Saved Documents Missing")
            val files = mutableListOf(Net.FilePart(p.fileInputs[0], Store.docName(id, "agreement"), "application/pdf", ag))
            if (p.fileInputs.size > 1) files.add(Net.FilePart(p.fileInputs[1], Store.docName(id, "formx"), "application/pdf", fx))
            val post = Net.request(Parser.statusUrl(id), "POST", session = "upload-$id", form = fields, files = files, timeoutMs = 60000)
            if (post.status >= 400) throw Exception("Upload Rejected By Site (${post.status})")
            var after = Parser.parse(post.text)
            val before = p.docsUploaded ?: 0
            if ((after.docsUploaded ?: 0) <= before) {
                after = fetch(id).first
                if ((after.docsUploaded ?: 0) <= before) throw Exception("Site Did Not Confirm The Upload")
            }
            apply(a, after)
            a.put("reuploadState", "done"); a.remove("reuploadError")
            log(d, "reupload", "Re-Upload Done - $id", id)
            ev.add(Ev("Re-Upload Done - $id", "Both Documents Uploaded Again", id))
        } catch (e: Exception) {
            a.put("reuploadState", "failed"); a.put("reuploadError", e.message ?: "Error")
            log(d, "reupload-failed", "Re-Upload Failed - $id: ${e.message}", id)
            ev.add(Ev("Re-Upload Failed - $id", (e.message ?: "Error") + ". Tap Re-Upload To Do It On The Official Page.", id))
        }
        return ev
    }

    /** Check all non-approved applications (or one). Network happens outside the data lock; results are merged per application. */
    @Synchronized
    fun run(c: Context, onlyId: String? = null, notify: Boolean = true, forceUploadId: String? = null): List<Ev> {
        val snapshot = Store.read(c)
        val s = snapshot.optJSONObject("settings") ?: JSONObject()
        val apps = snapshot.optJSONArray("apps") ?: JSONArray()
        val all = mutableListOf<Ev>()
        val updated = HashMap<String, JSONObject>()
        val scratch = JSONObject().put("activity", JSONArray())
        for (i in 0 until apps.length()) {
            val a = apps.optJSONObject(i) ?: continue
            val id = a.optString("id")
            if (onlyId != null && id != onlyId) continue
            if (forceUploadId != null) { if (id == forceUploadId) { all.addAll(reupload(c, scratch, a)); updated[id] = a }; continue }
            if (a.optString("status") == "approved" && onlyId == null) continue
            try { all.addAll(checkOne(c, scratch, a, s)) } catch (e: Exception) { a.put("lastError", e.message ?: "Network Error"); a.put("lastChecked", System.currentTimeMillis()) }
            updated[id] = a
        }
        Store.update(c) { d ->
            val cur = d.optJSONArray("apps") ?: JSONArray()
            for (i in 0 until cur.length()) {
                val a = cur.optJSONObject(i) ?: continue
                val u = updated[a.optString("id")] ?: continue
                for (k in Store.CHECKER_FIELDS) if (u.has(k)) a.put(k, u.get(k))
            }
            val newAct = scratch.optJSONArray("activity") ?: JSONArray()
            if (newAct.length() > 0) {
                val old = d.optJSONArray("activity") ?: JSONArray(); val n = JSONArray()
                for (i in 0 until newAct.length()) n.put(newAct.get(i))
                for (i in 0 until minOf(old.length(), 200 - newAct.length())) n.put(old.get(i))
                d.put("activity", n)
            }
            if (onlyId == null && forceUploadId == null) d.put("lastSync", System.currentTimeMillis())
        }
        if (notify && s.optBoolean("notify", true)) all.forEach { Notifier.show(c, it.title, it.body, s.optBoolean("sound", true), it.id) }
        listener?.invoke()
        return all
    }
}
