package com.filmyfather.vidyutsewa

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Environment
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.*
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ConcurrentHashMap

/**
 * The hidden official session: one WebView that loads the real wss.mahadiscom.in pages and runs the page's own JavaScript
 * (login encryption, captcha, OTP buttons). The app drives it with label-based calls (vsdrv.js) and mirrors every step in native screens.
 * Nothing is submitted, uploaded or paid by this class: the screens call it only after the person's own tap.
 * "Reveal" turns the same session into a full screen page (Open Official Page fallback, and the official payment page).
 */
class Driver(private val act: MainActivity, private val host: FrameLayout) {
    private var wv: WebView? = null
    private var overlay: LinearLayout? = null
    private var chipsRow: LinearLayout? = null
    private var titleView: TextView? = null
    private var progress: ProgressBar? = null
    @Volatile var finishSeq = 0
    @Volatile var startSeq = 0
    @Volatile private var revealed = false
    private var mobileView = true
    private val msgs = CopyOnWriteArrayList<JSONObject>()
    private val pendingEval = ConcurrentHashMap<String, (String) -> Unit>()
    private val loadWaiters = CopyOnWriteArrayList<(JSONObject) -> Unit>()
    private var showCb: (() -> Unit)? = null
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private val drvJs: String by lazy { act.assets.open("web/js/vsdrv.js").bufferedReader().readText() }

    private fun dp(v: Int) = (v * act.resources.displayMetrics.density).toInt()

    private val CSS = "input[type=text],input[type=password],input[type=tel],input[type=email],input[type=number],select,textarea{font-size:16px!important;min-height:36px!important;padding:4px 6px!important;box-sizing:border-box!important;max-width:100%!important} " +
        "input[type=submit],input[type=button],button,.btn{font-size:16px!important;min-height:40px!important;padding:6px 12px!important} img{max-width:100%!important;height:auto!important} body{-webkit-text-size-adjust:100%!important}"
    private val CSS_MOBILE = "body,form,#wrap,#container,#content,.container,div,table{min-width:0!important;max-width:100vw!important} table{width:100%!important;table-layout:auto!important} td{word-break:break-word!important} #wrap,#container,#content,.container,form{width:auto!important}"

    inner class JsHook {
        @JavascriptInterface fun done(id: String, json: String) { pendingEval.remove(id)?.invoke(json) }
    }

    @SuppressLint("SetJavaScriptEnabled")
    fun ensure(): WebView {
        wv?.let { return it }
        val w = WebView(act)
        w.layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true)
        with(w.settings) {
            javaScriptEnabled = true; domStorageEnabled = true; javaScriptCanOpenWindowsAutomatically = true
            useWideViewPort = true; loadWithOverviewMode = true; builtInZoomControls = true; displayZoomControls = false; setSupportZoom(true)
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE; allowFileAccess = false; textZoom = 100
        }
        w.addJavascriptInterface(JsHook(), "VSDrv")
        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean = route(req.url.toString())
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) { startSeq++ }
            override fun onPageFinished(view: WebView, url: String) {
                inject(view)
                if (revealed) { injectCss(view); view.evaluateJavascript("window.__vsd&&__vsd.setReveal(true)", null) }
                finishSeq++
                val info = JSONObject().put("url", url).put("title", view.title ?: "")
                val ws = loadWaiters.toList(); loadWaiters.clear(); ws.forEach { it(info) }
            }
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // the hidden page crashed: drop it; the next call builds a fresh one (the person logs in again)
                try { host.removeView(view) } catch (_: Exception) {}
                wv = null; pendingEval.values.forEach { it("""{"e":"The hidden official page stopped. Please start again."}""") }; pendingEval.clear()
                val ws = loadWaiters.toList(); loadWaiters.clear(); ws.forEach { it(JSONObject().put("error", "stopped")) }
                return true
            }
        }
        w.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, p: Int) { progress?.let { it.progress = p; it.visibility = if (p >= 100) View.INVISIBLE else View.VISIBLE } }
            private fun note(kind: String, m: String) { msgs.add(JSONObject().put("k", kind).put("t", m.take(400)).put("at", System.currentTimeMillis())); while (msgs.size > 40) msgs.removeAt(0) }
            override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean {
                note("alert", message)
                if (!revealed) { result.confirm(); return true }
                AlertDialog.Builder(act).setTitle("Official Site Says").setMessage(message).setCancelable(false).setPositiveButton("OK") { _, _ -> result.confirm() }.show(); return true
            }
            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                note("confirm", message)
                if (!revealed) { result.confirm(); return true }   // hidden: only reached after the person's own tap
                AlertDialog.Builder(act).setTitle("Official Site Asks").setMessage(message).setCancelable(false)
                    .setPositiveButton("OK") { _, _ -> result.confirm() }.setNegativeButton("Cancel") { _, _ -> result.cancel() }.show(); return true
            }
            override fun onJsPrompt(view: WebView, url: String, message: String, def: String?, result: JsPromptResult): Boolean {
                note("prompt", message)
                if (!revealed) { result.confirm(def ?: ""); return true }
                val input = EditText(act).apply { setText(def ?: "") }
                AlertDialog.Builder(act).setTitle("Official Site Asks").setMessage(message).setView(input).setCancelable(false)
                    .setPositiveButton("OK") { _, _ -> result.confirm(input.text.toString()) }.setNegativeButton("Cancel") { _, _ -> result.cancel() }.show(); return true
            }
            override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean = act.pickFile(cb, p)
        }
        w.setDownloadListener { url, ua, cd, mime, _ -> download(url, ua, cd, mime) }
        wv = w
        host.addView(w, 0)   // behind the main screen: drawn, but never touched
        return w
    }

    private fun route(url: String): Boolean {
        val scheme = Uri.parse(url).scheme?.lowercase() ?: return false
        if (scheme == "http" || scheme == "https" || scheme == "about" || scheme == "data" || scheme == "blob" || scheme == "javascript" || scheme == "file") return false
        if (url.startsWith("intent:")) {
            try {
                val i = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                try { act.startActivity(i) } catch (e: Exception) { i.getStringExtra("browser_fallback_url")?.let { wv?.loadUrl(it) } ?: toast("App Not Installed") }
            } catch (e: Exception) { toast("Cannot Open Link") }
            return true
        }
        // upi:, phonepe:, paytmmp:, gpay:, tez:, bhim:, tel:, mailto:, whatsapp:, market: ... open in the app that handles them
        try { act.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) { toast(if (scheme == "upi") "No UPI App Found" else "No App Found To Open This") }
        return true
    }
    private fun toast(s: String) = Toast.makeText(act, s, Toast.LENGTH_SHORT).show()
    private fun injectCss(v: WebView) {
        val css = CSS + if (mobileView) " $CSS_MOBILE" else ""
        v.evaluateJavascript("(function(){var s=document.getElementById('vs-css');if(!s){s=document.createElement('style');s.id='vs-css';(document.head||document.documentElement).appendChild(s);}s.textContent=${JSONObject.quote(css)};})()", null)
    }
    private fun inject(v: WebView) { v.evaluateJavascript("(function(){try{if(!window.__vsd){$drvJs}}catch(e){}})()", null) }

    private fun download(url: String, ua: String, cd: String?, mime: String?) {
        try {
            val name = URLUtil.guessFileName(url, cd, mime).replace(Regex("[^A-Za-z0-9._-]"), "_")
            val r = DownloadManager.Request(Uri.parse(url)).setMimeType(mime).addRequestHeader("User-Agent", ua)
                .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "VidyutSewa/$name")
            (act.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(r)
            toast("Downloading $name")
        } catch (e: Exception) { toast("Download Failed: ${e.message}") }
    }

    // ---------- calls from the screens ----------
    fun load(url: String, reply: (Any?, String?) -> Unit) {
        val w = ensure()
        var done = false
        val cb: (JSONObject) -> Unit = { info -> if (!done) { done = true; if (info.has("error")) reply(null, info.optString("error")) else reply(info, null) } }
        loadWaiters.add(cb)
        w.postDelayed({ if (!done) { done = true; loadWaiters.remove(cb); reply(JSONObject().put("url", w.url ?: "").put("timeout", true), null) } }, 30000)
        w.loadUrl(url)
    }

    fun eval(script: String, timeoutMs: Long, reply: (Any?, String?) -> Unit) {
        val w = ensure(); val id = UUID.randomUUID().toString()
        var done = false
        val finish: (String) -> Unit = { json ->
            if (!done) { done = true
                try { val o = JSONObject(json); if (o.has("e")) reply(null, o.optString("e")) else reply(o.opt("v") ?: JSONObject.NULL, null) } catch (e: Exception) { reply(null, "Bad answer from the official page") }
            }
        }
        pendingEval[id] = finish
        w.postDelayed({ if (!done) { pendingEval.remove(id); finish("""{"e":"The official page changed before it answered."}""") } }, timeoutMs)
        val js = "(function(){try{if(!window.__vsd){$drvJs}}catch(e){} Promise.resolve().then(function(){return ($script)}).then(function(r){VSDrv.done(${JSONObject.quote(id)},JSON.stringify({v:r===undefined?null:r}))},function(e){VSDrv.done(${JSONObject.quote(id)},JSON.stringify({e:String(e&&e.message||e)}))});})()"
        w.evaluateJavascript(js, null)
    }

    fun drainMsgs(): JSONObject { val a = JSONArray(); msgs.forEach { a.put(it) }; msgs.clear(); return JSONObject().put("msgs", a) }

    fun reset(reply: () -> Unit) {
        val cm = CookieManager.getInstance(); cm.removeAllCookies(null); cm.flush()
        WebStorage.getInstance().deleteAllData()
        wv?.let { it.stopLoading(); it.clearCache(false); it.loadUrl("about:blank") }
        msgs.clear(); reply()
    }

    // ---------- reveal: the same page, full screen ----------
    @SuppressLint("SetTextI18n")
    fun show(title: String, copy: JSONArray, onClosed: () -> Unit) {
        val w = ensure()
        showCb = onClosed
        revealed = true
        w.evaluateJavascript("window.__vsd&&__vsd.setReveal(true)", null)
        val bg = Color.parseColor("#0B1744")
        val ov = LinearLayout(act).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.WHITE); isClickable = true }
        val bar = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL; setBackgroundColor(bg); gravity = Gravity.CENTER_VERTICAL; setPadding(dp(4), dp(4), dp(4), dp(4)) }
        fun btn(label: String, onClick: () -> Unit) = TextView(act).apply { text = label; setTextColor(Color.parseColor("#7DE9FF")); textSize = 17f; setPadding(dp(12), dp(8), dp(12), dp(8)); setOnClickListener { onClick() } }
        bar.addView(btn("\u2190") { onBack() })
        titleView = TextView(act).apply { text = "\uD83D\uDD12 $title"; setTextColor(Color.WHITE); textSize = 15f; typeface = Typeface.DEFAULT_BOLD; layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f); maxLines = 1 }
        bar.addView(titleView)
        bar.addView(btn("Aa") { mobileView = !mobileView; injectCss(w) })
        bar.addView(btn("\u21BB") { w.reload() })
        bar.addView(btn("Back To App") { hide() })
        ov.addView(bar)
        progress = ProgressBar(act, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)); visibility = View.INVISIBLE }
        ov.addView(progress)
        if (copy.length() > 0) {
            val sv = HorizontalScrollView(act).apply { setBackgroundColor(Color.parseColor("#E8F6FF")); isHorizontalScrollBarEnabled = false }
            val row = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL; setPadding(dp(6), dp(6), dp(6), dp(6)) }
            for (i in 0 until copy.length()) {
                val o = copy.getJSONObject(i); val label = o.optString("l"); val value = o.optString("v")
                row.addView(TextView(act).apply {
                    text = "\uD83D\uDCCB $label"; setTextColor(Color.parseColor("#0B1744")); textSize = 12f; setPadding(dp(10), dp(6), dp(10), dp(6))
                    setBackgroundColor(Color.parseColor("#BFE9F5")); layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { rightMargin = dp(6) }
                    setOnClickListener { copyText(value); toast("Copied: $label") }
                })
            }
            sv.addView(row); ov.addView(sv)
        }
        host.removeView(w)
        ov.addView(w, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        ov.addView(TextView(act).apply { text = "You Type Captcha & OTP Yourself. Payment Only On The Official Page."; textSize = 11f; setTextColor(Color.parseColor("#A9BEDA")); setBackgroundColor(bg); gravity = Gravity.CENTER; setPadding(dp(6), dp(5), dp(6), dp(5)) })
        overlay = ov
        host.addView(ov, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        injectCss(w)
    }
    fun isRevealed() = revealed
    fun onBack(): Boolean { val w = wv; if (revealed && w != null && w.canGoBack()) { w.goBack(); return true }; if (revealed) { hide(); return true }; return false }
    fun hide() {
        val w = wv ?: return
        if (!revealed) return
        revealed = false
        w.evaluateJavascript("window.__vsd&&__vsd.setReveal(false)", null)
        overlay?.let { ov -> ov.removeView(w); host.removeView(ov) }
        overlay = null
        w.layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        host.addView(w, 0)
        val cb = showCb; showCb = null; cb?.invoke()
    }
    fun copyText(text: String) { val cm = act.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager; cm.setPrimaryClip(ClipData.newPlainText("VidyutSewa", text)) }
    fun destroy() { try { wv?.destroy() } catch (_: Exception) {}; wv = null }
}
