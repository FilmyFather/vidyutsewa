package com.filmyfather.vidyutsewa

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.app.Dialog
import android.app.DownloadManager
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.*
import android.widget.*
import androidx.core.content.FileProvider
import java.io.File
import org.json.JSONObject

/** The official MSEDCL websites inside the app. The user types login, captcha and OTP and pays on the official page; the app never submits anything itself. */
class OfficialActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var progress: ProgressBar
    private lateinit var banner: TextView
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private var appId = ""
    private var captured: String? = null
    private var mobileView = true

    companion object { @Volatile var lastCapturedId: String? = null; const val REQ_PICK = 21 }

    private val CSS = """
      input[type=text],input[type=password],input[type=tel],input[type=email],input[type=number],select,textarea{font-size:16px!important;min-height:36px!important;padding:4px 6px!important;box-sizing:border-box!important;max-width:100%!important}
      input[type=submit],input[type=button],button,.btn{font-size:16px!important;min-height:40px!important;padding:6px 12px!important}
      img{max-width:100%!important;height:auto!important}
      body{-webkit-text-size-adjust:100%!important}
    """.trimIndent().replace("\n", " ")
    private val CSS_MOBILE = """
      body,form,#wrap,#container,#content,.container,div,table{min-width:0!important;max-width:100vw!important}
      table{width:100%!important;table-layout:auto!important} td{word-break:break-word!important}
      #wrap,#container,#content,.container,form{width:auto!important}
    """.trimIndent().replace("\n", " ")

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        appId = intent.getStringExtra("appId") ?: ""
        val bg = Color.parseColor("#0B1744")
        window.statusBarColor = bg
        val rootL = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.WHITE) }
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setBackgroundColor(bg); gravity = Gravity.CENTER_VERTICAL; setPadding(dp(4), dp(4), dp(4), dp(4)) }
        fun btn(label: String, onClick: () -> Unit) = TextView(this).apply {
            text = label; setTextColor(Color.parseColor("#7DE9FF")); textSize = 18f; setPadding(dp(12), dp(8), dp(12), dp(8)); setOnClickListener { onClick() }
        }
        bar.addView(btn("\u2190") { goBack() })
        bar.addView(TextView(this).apply {
            text = "\uD83D\uDD12 Official MSEDCL Site"; setTextColor(Color.WHITE); textSize = 15f; typeface = Typeface.DEFAULT_BOLD
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        })
        bar.addView(btn("Aa") { mobileView = !mobileView; injectCss(); toast(if (mobileView) "Mobile View On" else "Mobile View Off") })
        bar.addView(btn("\u21BB") { web.reload() })
        bar.addView(btn("\u2715") { finishWithResult() })
        rootL.addView(bar)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)) }
        rootL.addView(progress)
        banner = TextView(this).apply {
            setBackgroundColor(Color.parseColor("#E8FFF1")); setTextColor(Color.parseColor("#14532D")); textSize = 14f; setPadding(dp(12), dp(8), dp(12), dp(8)); visibility = android.view.View.GONE
        }
        rootL.addView(banner)
        web = WebView(this).apply { layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f) }
        rootL.addView(web)
        rootL.addView(TextView(this).apply {
            text = "You Type Captcha & OTP Yourself. Payment Only On The Official Page."; textSize = 11f; setTextColor(Color.parseColor("#A9BEDA"))
            setBackgroundColor(bg); gravity = Gravity.CENTER; setPadding(dp(6), dp(5), dp(6), dp(5))
        })
        setContentView(rootL)
        setup(web)
        web.loadUrl(intent.getStringExtra("url") ?: "https://wss.mahadiscom.in/wss/wss?uiActionName=getCustAccountLogin")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setup(w: WebView) {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true)
        with(w.settings) {
            javaScriptEnabled = true; domStorageEnabled = true; setSupportMultipleWindows(true); javaScriptCanOpenWindowsAutomatically = true
            useWideViewPort = true; loadWithOverviewMode = true; builtInZoomControls = true; displayZoomControls = false; setSupportZoom(true)
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE; allowFileAccess = false; textZoom = 100
        }
        w.addJavascriptInterface(Hook(), "VSOfficial")
        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean = route(req.url.toString())
            override fun onPageFinished(view: WebView, url: String) {
                injectCss(view); injectHook(view); scan(url)
            }
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                toast("Page Crashed. Please Open It Again."); finishWithResult(); return true
            }
        }
        w.webChromeClient = Chrome()
        w.setDownloadListener { url, ua, cd, mime, _ -> download(url, ua, cd, mime) }
    }

    private fun route(url: String): Boolean {
        scan(url)
        return when {
            url.startsWith("upi:") -> { try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (e: Exception) { toast("No UPI App Found") }; true }
            url.startsWith("intent:") -> {
                try {
                    val i = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                    try { startActivity(i) } catch (e: Exception) { i.getStringExtra("browser_fallback_url")?.let { web.loadUrl(it) } ?: toast("App Not Installed") }
                } catch (e: Exception) { toast("Cannot Open Link") }
                true
            }
            url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp:") || url.startsWith("market:") -> { try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {}; true }
            else -> false
        }
    }

    private fun injectCss(v: WebView = web) {
        val css = CSS + if (mobileView) " $CSS_MOBILE" else ""
        v.evaluateJavascript("(function(){var s=document.getElementById('vs-css');if(!s){s=document.createElement('style');s.id='vs-css';(document.head||document.documentElement).appendChild(s);}s.textContent=${org.json.JSONObject.quote(css)};})()", null)
    }
    private fun injectHook(v: WebView) {
        v.evaluateJavascript("""(function(){try{
          if(!window.__vsHooked){window.__vsHooked=1;var oa=window.alert;window.alert=function(m){try{VSOfficial.text(String(m))}catch(e){};return oa.apply(window,arguments)};}
          VSOfficial.text(document.body?document.body.innerText.slice(0,20000):'');
        }catch(e){}})()""", null)
    }

    private fun scan(text: String) {
        if (captured != null) return
        val id = Parser.findApplicationId(text)
        if (id.isNotEmpty() && (appId == "draft" || appId.isEmpty() || intent.getStringExtra("mode") == "apply")) {
            captured = id; lastCapturedId = id
            runOnUiThread {
                banner.text = "\u2714 Application ID $id Captured. It Will Be Filled In The App When You Close This Page."
                banner.visibility = android.view.View.VISIBLE
                setResult(RESULT_OK, Intent().putExtra("applicationId", id))
            }
        }
    }

    inner class Hook { @JavascriptInterface fun text(t: String) { scan(t) } }

    inner class Chrome : WebChromeClient() {
        override fun onProgressChanged(view: WebView, p: Int) { progress.progress = p; progress.visibility = if (p >= 100) android.view.View.INVISIBLE else android.view.View.VISIBLE }
        override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean {
            scan(message)
            AlertDialog.Builder(this@OfficialActivity).setTitle("Official Site Says").setMessage(message).setCancelable(false)
                .setPositiveButton("OK") { _, _ -> result.confirm() }.show(); return true
        }
        override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
            scan(message)
            AlertDialog.Builder(this@OfficialActivity).setTitle("Official Site Asks").setMessage(message).setCancelable(false)
                .setPositiveButton("OK") { _, _ -> result.confirm() }.setNegativeButton("Cancel") { _, _ -> result.cancel() }.show(); return true
        }
        override fun onJsPrompt(view: WebView, url: String, message: String, def: String?, result: JsPromptResult): Boolean {
            val input = EditText(this@OfficialActivity).apply { setText(def ?: "") }
            AlertDialog.Builder(this@OfficialActivity).setTitle("Official Site Asks").setMessage(message).setView(input).setCancelable(false)
                .setPositiveButton("OK") { _, _ -> result.confirm(input.text.toString()) }.setNegativeButton("Cancel") { _, _ -> result.cancel() }.show(); return true
        }
        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
            val pop = WebView(this@OfficialActivity); setup(pop)
            val d = Dialog(this@OfficialActivity, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
            val box = LinearLayout(this@OfficialActivity).apply { orientation = LinearLayout.VERTICAL }
            box.addView(TextView(this@OfficialActivity).apply {
                text = "\u2715  Close Window"; setTextColor(Color.WHITE); setBackgroundColor(Color.parseColor("#0B1744")); textSize = 16f; setPadding(dp(14), dp(12), dp(14), dp(12)); setOnClickListener { d.dismiss() }
            })
            box.addView(pop, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
            pop.webChromeClient = object : WebChromeClient() {
                override fun onCloseWindow(window: WebView) { d.dismiss() }
                override fun onJsAlert(v: WebView, u: String, m: String, r: JsResult) = this@Chrome.onJsAlert(v, u, m, r)
                override fun onJsConfirm(v: WebView, u: String, m: String, r: JsResult) = this@Chrome.onJsConfirm(v, u, m, r)
                override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams) = this@Chrome.onShowFileChooser(v, cb, p)
            }
            d.setContentView(box); d.setOnDismissListener { pop.destroy() }; d.show()
            (resultMsg.obj as WebView.WebViewTransport).webView = pop; resultMsg.sendToTarget(); return true
        }
        override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
            fileCb?.onReceiveValue(null); fileCb = cb
            val ids = listOf(appId, "draft").filter { it.isNotEmpty() }.distinct()
            val saved = mutableListOf<Pair<String, File>>()
            val data = Store.read(this@OfficialActivity).optJSONArray("apps")
            for (id in ids) {
                var app: JSONObject? = null
                if (data != null) for (i in 0 until data.length()) data.optJSONObject(i)?.let { if (it.optString("id") == id) app = it }
                val slots = if (id == "draft" || app == null) listOf("agreement", "formx", "single") else Store.slotsFor(app!!)
                for (slot in slots) { val f = Store.docFile(this@OfficialActivity, id, slot); if (f.exists()) saved.add(Store.docName(if (id == "draft") (captured ?: "New") else id, slot) to f) }
            }
            val labels = saved.map { "\uD83D\uDCC4 ${it.first}  (${it.second.length() / 1024} KB, Saved)" } + listOf("\uD83D\uDCC2 Choose Another File")
            AlertDialog.Builder(this@OfficialActivity).setTitle("Choose File To Upload")
                .setItems(labels.toTypedArray()) { _, which ->
                    if (which < saved.size) {
                        val (name, f) = saved[which]
                        val out = File(File(cacheDir, "upload").apply { mkdirs() }, name); f.copyTo(out, true)
                        fileCb?.onReceiveValue(arrayOf(FileProvider.getUriForFile(this@OfficialActivity, "$packageName.files", out))); fileCb = null
                    } else {
                        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                            .putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/pdf", "image/jpeg", "image/png"))
                        try { startActivityForResult(i, REQ_PICK) } catch (e: Exception) { fileCb?.onReceiveValue(null); fileCb = null }
                    }
                }
                .setOnCancelListener { fileCb?.onReceiveValue(null); fileCb = null }.show()
            return true
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(req: Int, res: Int, data: Intent?) {
        super.onActivityResult(req, res, data)
        if (req == REQ_PICK) {
            val uri = data?.data
            if (res != RESULT_OK || uri == null) { fileCb?.onReceiveValue(null); fileCb = null; return }
            // A file picked from the phone is copied under a clean name (no spaces / special characters); an oversize picture is gently shrunk below 1 MB.
            Thread {
                var result: Uri? = null; var note: String? = null
                try {
                    var display = "Document"
                    contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { if (it.moveToFirst()) display = it.getString(0) ?: display }
                    val mime = contentResolver.getType(uri) ?: ""
                    val bytes = contentResolver.openInputStream(uri)!!.use { it.readBytes() }
                    val isPdf = mime.contains("pdf") || display.lowercase().endsWith(".pdf")
                    var out = bytes; var name = display
                    if (!isPdf && bytes.size > Store.UPLOAD_LIMIT) {
                        val shrunk = Store.shrinkImage(bytes)
                        if (shrunk != null) { out = shrunk; name = display.substringBeforeLast('.') + ".jpg" } else note = "File Is Over 1 MB"
                    } else if (isPdf && bytes.size > Store.UPLOAD_LIMIT) note = "PDF Is Over 1 MB. Add It In The App First So It Gets Compressed"
                    val file = File(File(cacheDir, "upload").apply { mkdirs() }, Store.safeName(name, "Document", if (isPdf) "pdf" else "jpg"))
                    file.writeBytes(out)
                    result = FileProvider.getUriForFile(this, "$packageName.files", file)
                } catch (e: Exception) { note = "Could Not Read The File" }
                runOnUiThread {
                    note?.let { android.widget.Toast.makeText(this, it, android.widget.Toast.LENGTH_LONG).show() }
                    fileCb?.onReceiveValue(result?.let { arrayOf(it) }); fileCb = null
                }
            }.start()
        }
    }

    private fun download(url: String, ua: String, cd: String?, mime: String?) {
        try {
            val name = URLUtil.guessFileName(url, cd, mime).replace(Regex("[^A-Za-z0-9._-]"), "_")
            val r = DownloadManager.Request(Uri.parse(url)).setMimeType(mime).addRequestHeader("User-Agent", ua)
                .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "VidyutSewa/$name")
            (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(r)
            toast("Downloading $name")
        } catch (e: Exception) { toast("Download Failed: ${e.message}") }
    }

    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_SHORT).show()
    private fun goBack() { if (web.canGoBack()) web.goBack() else finishWithResult() }
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { goBack() }
    private fun finishWithResult() {
        if (captured != null) setResult(RESULT_OK, Intent().putExtra("applicationId", captured))
        CookieManager.getInstance().flush(); finish()
    }
    override fun onDestroy() { web.destroy(); super.onDestroy() }
}
