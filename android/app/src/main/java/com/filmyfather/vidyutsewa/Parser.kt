package com.filmyfather.vidyutsewa

/** Port of web/js/parsers.js parseStatusPage / classifyStatus / aspFormFields (keep both in sync). */
object Parser {
    const val STATUS_URL = "https://css.mahadiscom.in/UI/CHANGENAME/ChangeNameUploadDoc.aspx"
    fun statusUrl(id: String) = "$STATUS_URL?applicationno=${id.trim()}"

    data class Status(
        var found: Boolean = false, var applicationId: String = "", var applicationDate: String = "", var consumerNo: String = "",
        var oldName: String = "", var newName: String = "", var mobile: String = "", var reason: String = "", var subDivision: String = "",
        var docsUploaded: Int? = null, var rawStatus: String = "", var status: String = "pending", var fee: String = "",
        var receiptNo: String = "", var receiptDate: String = "", var fileInputs: MutableList<String> = mutableListOf(), var certificateUrl: String = ""
    ) { val hasUploadForm get() = fileInputs.isNotEmpty() }

    private val IC = setOf(RegexOption.IGNORE_CASE)
    private val ICDOT = setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)

    fun decode(s: String): String = s.replace(Regex("&nbsp;", IC), " ").replace(Regex("&amp;", IC), "&").replace(Regex("&lt;", IC), "<")
        .replace(Regex("&gt;", IC), ">").replace(Regex("&quot;", IC), "\"").replace(Regex("&#39;|&apos;", IC), "'")
        .replace(Regex("&#(\\d+);")) { it.groupValues[1].toInt().toChar().toString() }
        .replace(Regex("&#x([0-9a-fA-F]+);")) { it.groupValues[1].toInt(16).toChar().toString() }

    fun clean(html: String): String = decode(
        html.replace(Regex("<script.*?</script>", ICDOT), " ").replace(Regex("<style.*?</style>", ICDOT), " ")
            .replace(Regex("<br\\s*/?>", IC), " ").replace(Regex("<[^>]+>"), " ")
    ).replace(Regex("\\s+"), " ").trim()

    fun classify(raw: String?): String {
        val s = (raw ?: "").lowercase()
        if (s.isBlank()) return "pending"
        if (Regex("(reject|return(ed)? to|cancel|deficien|incomplete|not approved|disapprov|re-?upload|resubmit|declin|invalid doc)").containsMatchIn(s)) return "rejected"
        if (Regex("(approv|sanction|complet|name chang(ed|e done)|certificate (issued|generated)|provisional certificate|closed|success)").containsMatchIn(s)) return "approved"
        return "pending"
    }

    private fun rows(table: String): List<List<String>> {
        val out = mutableListOf<List<String>>()
        Regex("<tr[^>]*>(.*?)</tr>", ICDOT).findAll(table).forEach { tr ->
            val cells = Regex("<t[dh][^>]*>(.*?)</t[dh]>", ICDOT).findAll(tr.groupValues[1]).map { clean(it.groupValues[1]) }.toList()
            if (cells.isNotEmpty()) out.add(cells)
        }
        return out
    }
    private fun tableById(html: String, id: String): String {
        val m = Regex("<table[^>]*id=\"$id\"", IC).find(html) ?: return ""
        val end = html.indexOf("</table>", m.range.first)
        return if (end < 0) html.substring(m.range.first) else html.substring(m.range.first, end + 8)
    }
    private fun key(k: String) = k.lowercase().replace(Regex("[^a-z0-9]+"), " ").trim()

    fun parse(html: String?): Status {
        val h = html ?: ""
        val o = Status()
        if (!Regex("<html|<form|<table", IC).containsMatchIn(h)) return o
        var rs = rows(tableById(h, "DVConsumerInfo"))
        if (rs.isEmpty()) rs = rows(h).filter { it.size == 2 && Regex("application id|consumer no|consumer name|application status", IC).containsMatchIn(it[0]) }
        for (r in rs) {
            if (r.size < 2) continue
            val k = key(r[0]); val v = r[1]
            when {
                k.startsWith("application id") -> o.applicationId = Regex("\\d{6,}").find(v)?.value ?: v
                k.startsWith("application date") -> o.applicationDate = v
                k.startsWith("consumer no") -> o.consumerNo = Regex("\\d{9,}").find(v)?.value ?: v
                k.startsWith("old consumer name") -> o.oldName = v
                k.startsWith("new consumer name") -> o.newName = v
                k.startsWith("mobile") -> o.mobile = v
                k.contains("reason") -> o.reason = v
                k.startsWith("bu") || k.contains("sub division") -> o.subDivision = v
                k.contains("documents") -> o.docsUploaded = Regex("\\d+").find(v)?.value?.toInt()
                k.contains("application status") || k.startsWith("status") -> o.rawStatus = v
            }
        }
        Regex("id=\"[^\"]*lblApplicationStatus\"[^>]*>(.*?)</span>", ICDOT).find(h)?.let { val c = clean(it.groupValues[1]); if (c.isNotEmpty()) o.rawStatus = c }
        o.found = o.applicationId.isNotEmpty() || o.consumerNo.isNotEmpty() || o.rawStatus.isNotEmpty()
        o.status = classify(o.rawStatus)
        Regex("id=\"GrvEstDet_lblTotal\"[^>]*>(.*?)</span>", ICDOT).find(h)?.let { o.fee = Regex("[\\d,.]+").find(clean(it.groupValues[1]))?.value?.replace(",", "") ?: "" }
        rows(tableById(h, "GrvRecDet")).firstOrNull { it.size >= 4 && Regex("\\d{6,}").containsMatchIn(it[1]) }?.let { o.receiptNo = it[1]; o.receiptDate = it[2] }
        Regex("<input[^>]*type=[\"']?file[\"']?[^>]*>", IC).findAll(h).forEach { m ->
            Regex("name=[\"']([^\"']+)[\"']", IC).find(m.value)?.let { o.fileInputs.add(it.groupValues[1]) }
        }
        Regex("<a[^>]*href=[\"']([^\"']+)[\"'][^>]*>(?:(?!</a>).)*?(certificate|प्रमाणपत्र)", ICDOT).find(h)?.let {
            val u = decode(it.groupValues[1])
            o.certificateUrl = when { u.startsWith("http") -> u; u.startsWith("javascript", true) -> ""; u.startsWith("/") -> "https://css.mahadiscom.in$u"; else -> "https://css.mahadiscom.in/UI/CHANGENAME/$u" }
        }
        return o
    }

    fun aspFields(html: String): LinkedHashMap<String, String> {
        val f = LinkedHashMap<String, String>()
        Regex("<input([^>]*)>", IC).findAll(html).forEach { m ->
            val a = m.groupValues[1]
            val type = (Regex("type=[\"']?([a-z]+)", IC).find(a)?.groupValues?.get(1) ?: "text").lowercase()
            val name = Regex("name=[\"']([^\"']+)[\"']", IC).find(a)?.groupValues?.get(1) ?: return@forEach
            val v = decode(Regex("value=[\"']([^\"']*)[\"']", IC).find(a)?.groupValues?.get(1) ?: "")
            when {
                type == "hidden" -> f[name] = v
                (type == "checkbox" || type == "radio") && a.contains("checked", true) -> f[name] = v.ifEmpty { "on" }
                type == "text" || type == "tel" || type == "number" -> f[name] = v
            }
        }
        Regex("<select[^>]*name=[\"']([^\"']+)[\"'][^>]*>(.*?)</select>", ICDOT).findAll(html).forEach { s ->
            val sel = Regex("<option[^>]*selected[^>]*value=[\"']([^\"']*)[\"']", IC).find(s.groupValues[2]) ?: Regex("<option[^>]*value=[\"']([^\"']*)[\"']", IC).find(s.groupValues[2])
            f[s.groupValues[1]] = sel?.let { decode(it.groupValues[1]) } ?: ""
        }
        return f
    }

    fun uploadButton(html: String): Pair<String, String>? {
        Regex("<input([^>]*type=[\"']?(?:submit|button|image)[\"']?[^>]*)>", IC).findAll(html).forEach { m ->
            val name = Regex("name=[\"']([^\"']+)[\"']", IC).find(m.groupValues[1])?.groupValues?.get(1)
            val v = decode(Regex("value=[\"']([^\"']*)[\"']", IC).find(m.groupValues[1])?.groupValues?.get(1) ?: "")
            if (name != null && Regex("upload", IC).containsMatchIn("$name $v")) return name to v
        }
        return null
    }

    fun findApplicationId(text: String): String {
        val s = clean(text)
        val pats = listOf(Regex("application\\s*(?:id|no\\.?|number)\\s*(?:is|:|-)?\\s*[:\\-]?\\s*(\\d{8})\\b", IC), Regex("applicationno=(\\d{8})", IC))
        for (p in pats) p.find(s)?.let { return it.groupValues[1] }
        return ""
    }

    private val MONS = listOf("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")
    fun parseDate(s: String): Long? {
        val m = Regex("^(\\d{1,2})-([A-Za-z]{3})[a-z]*-(\\d{2,4})$").find(s.trim()) ?: return null
        val mo = MONS.indexOf(m.groupValues[2].lowercase()); if (mo < 0) return null
        var y = m.groupValues[3].toInt(); if (y < 100) y += 2000
        val c = java.util.Calendar.getInstance(); c.clear(); c.set(y, mo, m.groupValues[1].toInt()); return c.timeInMillis
    }
}
