package com.filmyfather.vidyutsewa

import java.io.ByteArrayOutputStream
import java.net.CookieManager
import java.net.CookiePolicy
import java.net.HttpCookie
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder

/** Small HTTP client: cookie jars per session name (the status/upload site uses an ASP.NET session cookie). */
object Net {
    const val UA = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
    private val jars = HashMap<String, CookieManager>()
    @Synchronized private fun jar(name: String) = jars.getOrPut(name) { CookieManager(null, CookiePolicy.ACCEPT_ALL) }

    class Resp(val status: Int, val body: ByteArray, val contentType: String) { val text get() = String(body, Charsets.UTF_8) }
    class FilePart(val field: String, val name: String, val mime: String, val bytes: ByteArray)

    fun request(url: String, method: String = "GET", headers: Map<String, String> = emptyMap(), session: String = "default",
                form: Map<String, String>? = null, files: List<FilePart>? = null, timeoutMs: Int = 30000): Resp {
        val cm = jar(session)
        var target = url; var redirects = 0; var m = method
        while (true) {
            val c = URL(target).openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = timeoutMs; c.readTimeout = timeoutMs
            c.requestMethod = m
            c.setRequestProperty("User-Agent", UA)
            headers.forEach { (k, v) -> c.setRequestProperty(k, v) }
            val uri = URI(target)
            val cookies = cm.cookieStore.get(uri)
            if (cookies.isNotEmpty()) c.setRequestProperty("Cookie", cookies.joinToString("; ") { "${it.name}=${it.value}" })
            if (m == "POST") {
                c.doOutput = true
                if (files != null) {
                    val boundary = "----VidyutSewa" + System.currentTimeMillis()
                    c.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
                    val out = ByteArrayOutputStream()
                    fun w(s: String) = out.write(s.toByteArray(Charsets.UTF_8))
                    form?.forEach { (k, v) -> w("--$boundary\r\nContent-Disposition: form-data; name=\"$k\"\r\n\r\n$v\r\n") }
                    files.forEach { f -> w("--$boundary\r\nContent-Disposition: form-data; name=\"${f.field}\"; filename=\"${f.name}\"\r\nContent-Type: ${f.mime}\r\n\r\n"); out.write(f.bytes); w("\r\n") }
                    w("--$boundary--\r\n")
                    c.outputStream.use { it.write(out.toByteArray()) }
                } else {
                    c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                    val body = (form ?: emptyMap()).entries.joinToString("&") { URLEncoder.encode(it.key, "UTF-8") + "=" + URLEncoder.encode(it.value, "UTF-8") }
                    c.outputStream.use { it.write(body.toByteArray()) }
                }
            }
            val code = c.responseCode
            c.headerFields["Set-Cookie"]?.forEach { h -> try { HttpCookie.parse(h).forEach { cm.cookieStore.add(uri, it) } } catch (_: Exception) {} }
            if (code in 300..399 && redirects < 6) {
                val loc = c.getHeaderField("Location"); c.disconnect()
                if (loc != null) { target = URL(URL(target), loc).toString(); redirects++; if (code != 307 && code != 308) m = "GET"; continue }
            }
            val stream = if (code >= 400) c.errorStream else c.inputStream
            val bytes = stream?.use { it.readBytes() } ?: ByteArray(0)
            val ct = c.contentType ?: ""
            c.disconnect()
            return Resp(code, bytes, ct)
        }
    }
    fun clearSessions() { synchronized(this) { jars.clear() } }
}
