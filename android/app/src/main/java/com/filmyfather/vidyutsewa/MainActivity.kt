package com.filmyfather.vidyutsewa

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.View
import android.webkit.*
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var web: WebView
    private val io = Executors.newFixedThreadPool(3)
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null
    private var officialCbId: String? = null
    private val ASSET_HOST = "appassets.androidplatform.net"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        web.setBackgroundColor(Color.parseColor("#050A24"))
        with(web.settings) {
            javaScriptEnabled = true; domStorageEnabled = true; allowFileAccess = false; allowContentAccess = true
            mediaPlaybackRequiresUserGesture = true; mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            textZoom = 100
        }
        web.addJavascriptInterface(Bridge(), "VSAndroid")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? {
                val u = req.url
                if (u.host != ASSET_HOST) return null
                val path = "web" + (u.path ?: "/index.html").let { if (it == "/" ) "/index.html" else it }
                return try {
                    val mime = when (path.substringAfterLast('.').lowercase()) {
                        "html" -> "text/html"; "js", "mjs" -> "application/javascript"; "css" -> "text/css"; "png" -> "image/png"
                        "jpg", "jpeg" -> "image/jpeg"; "svg" -> "image/svg+xml"; "ttf" -> "font/ttf"; "json" -> "application/json"; else -> "application/octet-stream"
                    }
                    WebResourceResponse(mime, if (mime.startsWith("text") || mime.contains("javascript")) "utf-8" else null, assets.open(path))
                } catch (e: Exception) { WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null) }
            }
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                if (req.url.host == ASSET_HOST) return false
                openExternal(req.url.toString()); return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                fileCb?.onReceiveValue(null); fileCb = cb
                val accept = p.acceptTypes.joinToString(",").lowercase()
                val multiple = p.mode == FileChooserParams.MODE_OPEN_MULTIPLE
                try {
                    if (p.isCaptureEnabled) {
                        val dir = File(cacheDir, "camera").apply { mkdirs() }
                        val f = File(dir, "Camera_${System.currentTimeMillis()}.jpg")
                        cameraUri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", f)
                        val i = Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, cameraUri)
                            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        startActivityForResult(i, REQ_CAMERA)
                    } else if (accept.contains("image") && !accept.contains("pdf")) {
                        val i = Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
                        startActivityForResult(Intent.createChooser(i, "Gallery"), REQ_FILE)
                    } else {
                        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                            .putExtra(Intent.EXTRA_MIME_TYPES, if (accept.isBlank() || accept.contains("*/*")) arrayOf("*/*") else arrayOf("application/pdf", "image/jpeg", "image/png", "application/octet-stream"))
                            .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
                        startActivityForResult(i, REQ_FILE)
                    }
                } catch (e: ActivityNotFoundException) { fileCb?.onReceiveValue(null); fileCb = null; return false }
                return true
            }
        }
        Checker.listener = { runOnUiThread { event("dataChanged", "{}") } }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 9)
        web.loadUrl("https://$ASSET_HOST/index.html")
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); handleIntent(intent) }
    private fun handleIntent(i: Intent?) {
        val id = i?.getStringExtra("openApp") ?: return
        web.postDelayed({ event("openApp", JSONObject().put("id", id).toString()) }, 2200)
    }
    override fun onPause() { super.onPause(); event("pause", "{}") }
    override fun onResume() { super.onResume(); event("resume", "{}") }
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { event("back", "{}") }
    override fun onDestroy() { Checker.listener = null; super.onDestroy() }

    private fun event(name: String, json: String) {
        if (!::web.isInitialized) return
        web.post { web.evaluateJavascript("window.__vsEvent && window.__vsEvent(${JSONObject.quote(name)}, ${JSONObject.quote(json)})", null) }
    }
    private fun reply(cbId: String, result: Any?, error: String? = null) {
        val o = JSONObject(); if (error != null) o.put("error", error) else o.put("result", result ?: JSONObject.NULL)
        web.post { web.evaluateJavascript("window.__vsCb(${JSONObject.quote(cbId)}, ${JSONObject.quote(o.toString())})", null) }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(req: Int, res: Int, data: Intent?) {
        super.onActivityResult(req, res, data)
        when (req) {
            REQ_CAMERA -> { fileCb?.onReceiveValue(if (res == RESULT_OK && cameraUri != null) arrayOf(cameraUri!!) else null); fileCb = null }
            REQ_FILE -> {
                var uris: Array<Uri>? = null
                if (res == RESULT_OK && data != null) {
                    val clip = data.clipData
                    uris = if (clip != null) Array(clip.itemCount) { clip.getItemAt(it).uri } else data.data?.let { arrayOf(it) }
                }
                fileCb?.onReceiveValue(uris); fileCb = null
            }
            REQ_OFFICIAL -> {
                val id = data?.getStringExtra("applicationId") ?: OfficialActivity.lastCapturedId
                OfficialActivity.lastCapturedId = null
                officialCbId?.let { reply(it, JSONObject().put("applicationId", id ?: "")) }; officialCbId = null
            }
        }
    }

    private fun openExternal(url: String) {
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: Exception) {}
    }
    private fun whatsappPkg(): String? = listOf("com.whatsapp", "com.whatsapp.w4b").firstOrNull {
        try { packageManager.getPackageInfo(it, 0); true } catch (e: Exception) { false }
    }

    inner class Bridge {
        @JavascriptInterface
        fun call(method: String, argsJson: String, cbId: String) {
            val args = try { JSONObject(argsJson) } catch (e: Exception) { JSONObject() }
            if (method in UI_METHODS) { runOnUiThread { try { ui(method, args, cbId) } catch (e: Exception) { reply(cbId, null, e.message ?: "Error") } }; return }
            io.execute {
                try { reply(cbId, bg(method, args)) } catch (e: Throwable) { reply(cbId, null, e.message ?: e.javaClass.simpleName) }
            }
        }
    }

    private fun bg(method: String, a: JSONObject): Any? = when (method) {
        "loadData" -> Store.readRaw(this)
        "saveData" -> { Store.saveFromUi(this, a.getString("json")); true }
        "http" -> {
            val headers = HashMap<String, String>()
            a.optJSONObject("headers")?.let { h -> h.keys().forEach { k -> if (!k.equals("User-Agent", true)) headers[k] = h.getString(k) } }
            val mp = a.optJSONObject("multipart")
            val r = if (mp != null) {
                val fields = LinkedHashMap<String, String>(); mp.optJSONObject("fields")?.let { f -> f.keys().forEach { fields[it] = f.getString(it) } }
                val files = mutableListOf<Net.FilePart>(); val fa = mp.optJSONArray("files") ?: JSONArray()
                for (i in 0 until fa.length()) { val f = fa.getJSONObject(i); files.add(Net.FilePart(f.getString("field"), f.getString("name"), f.optString("mime", "application/pdf"), Base64.decode(f.getString("b64"), Base64.DEFAULT))) }
                Net.request(a.getString("url"), "POST", headers, a.optString("session", "ui"), fields, files, 60000)
            } else Net.request(a.getString("url"), a.optString("method", "GET"), headers, a.optString("session", "ui"))
            JSONObject().put("status", r.status).put("contentType", r.contentType)
                .put("body", if (a.optString("responseType") == "base64") Base64.encodeToString(r.body, Base64.NO_WRAP) else r.text)
        }
        "saveDoc" -> { val n = Store.saveDoc(this, a.getString("id"), a.getString("slot"), a.getString("b64")); JSONObject().put("size", n) }
        "readDoc" -> Store.readDoc(this, a.getString("id"), a.getString("slot"))?.let { JSONObject().put("name", Store.docName(a.getString("id"), a.getString("slot"))).put("b64", Base64.encodeToString(it, Base64.NO_WRAP)) }
        "deleteDocs" -> { Store.deleteDocs(this, a.getString("id")); true }
        "syncNow" -> { val ev = Checker.run(this, a.optString("id").ifEmpty { null }); JSONObject().put("events", evJson(ev)) }
        "reuploadNow" -> { val ev = Checker.run(this, null, true, a.getString("id")); JSONObject().put("events", evJson(ev)) }
        "schedule" -> { StatusWorker.schedule(this, a.optBoolean("enabled", true), a.optLong("interval", 30)); true }
        "notify" -> { val s = Store.read(this).optJSONObject("settings"); Notifier.show(this, a.optString("title"), a.optString("body"), s?.optBoolean("sound", true) ?: true); true }
        "saveDownload" -> saveDownload(a.getString("name"), Base64.decode(a.getString("b64"), Base64.DEFAULT), a.optString("mime", "application/octet-stream"))
        "storageInfo" -> JSONObject().put("docs", Store.dirSize(File(filesDir, "vault"))).put("cache", Store.dirSize(cacheDir))
        "clearCache" -> { cacheDir.listFiles()?.forEach { it.deleteRecursively() }; runOnUiThread { web.clearCache(true) }; true }
        "appInfo" -> JSONObject().put("version", "1.0.0").put("platform", "android")
        else -> throw Exception("Unknown Action $method")
    }
    private fun evJson(ev: List<Checker.Ev>) = JSONArray().apply { ev.forEach { put(JSONObject().put("title", it.title).put("body", it.body)) } }

    private fun ui(method: String, a: JSONObject, cbId: String) {
        when (method) {
            "exit" -> { reply(cbId, true); finish() }
            "openExternal" -> { openExternal(a.getString("url")); reply(cbId, true) }
            "theme" -> {
                val dark = a.optBoolean("dark", true)
                val col = try { Color.parseColor(a.optString("color").ifBlank { if (dark) "#050A24" else "#F5F9FF" }) } catch (e: Exception) { Color.BLACK }
                window.statusBarColor = col; window.navigationBarColor = col; web.setBackgroundColor(col)
                var flags = window.decorView.systemUiVisibility
                flags = if (!dark) flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR else flags and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
                if (Build.VERSION.SDK_INT >= 26) flags = if (!dark) flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR else flags and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
                window.decorView.systemUiVisibility = flags
                reply(cbId, true)
            }
            "openOfficial" -> {
                officialCbId = cbId
                val i = Intent(this, OfficialActivity::class.java).putExtra("url", a.getString("url")).putExtra("appId", a.optString("appId")).putExtra("mode", a.optString("mode"))
                startActivityForResult(i, REQ_OFFICIAL)
            }
            "clearWebSession" -> {
                CookieManager.getInstance().removeAllCookies(null); CookieManager.getInstance().flush()
                WebStorage.getInstance().deleteAllData(); Net.clearSessions(); reply(cbId, true)
            }
            "share" -> { share(a); reply(cbId, true) }
            "openFile" -> {
                val uri = a.optString("uri").takeIf { it.isNotBlank() }?.let { Uri.parse(it) }
                    ?: a.optString("path").takeIf { it.isNotBlank() }?.let { FileProvider.getUriForFile(this, "$packageName.files", File(it)) }
                if (uri != null) try { startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, a.optString("mime", "application/pdf")).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)) } catch (_: Exception) {}
                reply(cbId, true)
            }
            "biometric" -> biometric(a, cbId)
            else -> reply(cbId, null, "Unknown Action $method")
        }
    }

    private fun share(a: JSONObject) {
        val text = a.optString("text"); val wa = a.optBoolean("whatsapp"); val files = a.optJSONArray("files")
        val pkg = if (wa) whatsappPkg() else null
        if (files == null || files.length() == 0) {
            val phone = a.optString("phone").filter { it.isDigit() }
            if (wa && phone.length == 10) { openExternal("https://wa.me/91$phone?text=" + Uri.encode(text)); return }
            val i = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
            if (pkg != null) { i.setPackage(pkg); try { startActivity(i); return } catch (_: Exception) {} }
            startActivity(Intent.createChooser(i.setPackage(null), "Share")); return
        }
        val dir = File(cacheDir, "share").apply { mkdirs() }
        val uris = ArrayList<Uri>()
        for (k in 0 until files.length()) {
            val f = files.getJSONObject(k); val out = File(dir, f.getString("name").replace(Regex("[^A-Za-z0-9._-]"), "_"))
            out.writeBytes(Base64.decode(f.getString("b64"), Base64.DEFAULT)); uris.add(FileProvider.getUriForFile(this, "$packageName.files", out))
        }
        val i = if (uris.size == 1) Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0]) else Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
        i.type = "application/pdf"; i.putExtra(Intent.EXTRA_TEXT, text); i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        if (pkg != null) { i.setPackage(pkg); try { startActivity(i); return } catch (_: Exception) { i.setPackage(null) } }
        startActivity(Intent.createChooser(i, "Share"))
    }

    private fun saveDownload(name: String, bytes: ByteArray, mime: String): JSONObject {
        if (Build.VERSION.SDK_INT >= 29) {
            val cv = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, name); put(MediaStore.MediaColumns.MIME_TYPE, mime)
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/VidyutSewa")
            }
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv) ?: throw Exception("Could Not Save File")
            contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
            return JSONObject().put("where", "Downloads/VidyutSewa/$name").put("uri", uri.toString())
        }
        if (checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            runOnUiThread { requestPermissions(arrayOf(android.Manifest.permission.WRITE_EXTERNAL_STORAGE), 10) }
            throw Exception("Allow Storage Permission And Tap Again")
        }
        @Suppress("DEPRECATION")
        val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "VidyutSewa").apply { mkdirs() }
        val f = File(dir, name); f.writeBytes(bytes)
        return JSONObject().put("where", "Downloads/VidyutSewa/$name").put("path", f.absolutePath)
    }

    private fun biometric(a: JSONObject, cbId: String) {
        if (Build.VERSION.SDK_INT < 28) { reply(cbId, JSONObject().put("ok", false)); return }
        if (a.optBoolean("check")) {
            val ok = if (Build.VERSION.SDK_INT >= 29) getSystemService(android.hardware.biometrics.BiometricManager::class.java).canAuthenticate() == android.hardware.biometrics.BiometricManager.BIOMETRIC_SUCCESS
                     else packageManager.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)
            reply(cbId, JSONObject().put("ok", ok)); return
        }
        val prompt = android.hardware.biometrics.BiometricPrompt.Builder(this).setTitle("VidyutSewa").setSubtitle("Unlock With Fingerprint")
            .setNegativeButton("Use PIN", mainExecutor) { _, _ -> reply(cbId, JSONObject().put("ok", false)) }.build()
        prompt.authenticate(CancellationSignal(), mainExecutor, object : android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: android.hardware.biometrics.BiometricPrompt.AuthenticationResult?) { reply(cbId, JSONObject().put("ok", true)) }
            override fun onAuthenticationError(code: Int, msg: CharSequence?) { reply(cbId, JSONObject().put("ok", false)) }
        })
    }

    companion object {
        const val REQ_FILE = 11; const val REQ_CAMERA = 12; const val REQ_OFFICIAL = 13
        val UI_METHODS = setOf("exit", "openExternal", "theme", "openOfficial", "clearWebSession", "share", "openFile", "biometric")
    }
}
