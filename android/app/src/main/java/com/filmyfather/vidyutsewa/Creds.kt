package com.filmyfather.vidyutsewa

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.math.BigInteger
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.util.Calendar
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.security.auth.x500.X500Principal

/** The (optional) WSS login name and password: encrypted with a key that lives in the Android Keystore, kept only in this app's private storage. Never leaves the phone except typed into the official site. */
object Creds {
    private const val ALIAS = "vs_wss_login"
    private const val PREFS = "vs_secure"
    private fun ks(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    private fun aesKey(): SecretKey {
        val k = ks()
        (k.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build())
        return g.generateKey()
    }
    @Suppress("DEPRECATION")
    private fun rsaPair(c: Context): java.security.KeyPair {
        val k = ks()
        if (k.containsAlias(ALIAS)) {
            val pub = k.getCertificate(ALIAS).publicKey; val priv = k.getKey(ALIAS, null) as java.security.PrivateKey
            return java.security.KeyPair(pub, priv)
        }
        val start = Calendar.getInstance(); val end = Calendar.getInstance().apply { add(Calendar.YEAR, 30) }
        val spec = android.security.KeyPairGeneratorSpec.Builder(c).setAlias(ALIAS).setSubject(X500Principal("CN=VidyutSewa")).setSerialNumber(BigInteger.ONE)
            .setStartDate(start.time).setEndDate(end.time).build()
        val g = KeyPairGenerator.getInstance("RSA", "AndroidKeyStore"); g.initialize(spec); return g.generateKeyPair()
    }

    fun save(c: Context, user: String, pass: String) {
        val plain = JSONObject().put("u", user).put("p", pass).toString().toByteArray(Charsets.UTF_8)
        val out = JSONObject()
        if (Build.VERSION.SDK_INT >= 23) {
            val ci = Cipher.getInstance("AES/GCM/NoPadding"); ci.init(Cipher.ENCRYPT_MODE, aesKey())
            out.put("m", "aes").put("iv", Base64.encodeToString(ci.iv, Base64.NO_WRAP)).put("d", Base64.encodeToString(ci.doFinal(plain), Base64.NO_WRAP))
        } else {
            val ci = Cipher.getInstance("RSA/ECB/PKCS1Padding"); ci.init(Cipher.ENCRYPT_MODE, rsaPair(c).public)
            out.put("m", "rsa").put("d", Base64.encodeToString(ci.doFinal(plain), Base64.NO_WRAP))
        }
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("wss", out.toString()).apply()
    }
    fun load(c: Context): JSONObject? {
        val s = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("wss", null) ?: return null
        return try {
            val o = JSONObject(s); val data = Base64.decode(o.getString("d"), Base64.NO_WRAP)
            val plain = if (o.getString("m") == "aes") {
                val ci = Cipher.getInstance("AES/GCM/NoPadding"); ci.init(Cipher.DECRYPT_MODE, aesKey(), GCMParameterSpec(128, Base64.decode(o.getString("iv"), Base64.NO_WRAP))); ci.doFinal(data)
            } else { val ci = Cipher.getInstance("RSA/ECB/PKCS1Padding"); ci.init(Cipher.DECRYPT_MODE, rsaPair(c).private); ci.doFinal(data) }
            val j = JSONObject(String(plain, Charsets.UTF_8)); JSONObject().put("user", j.optString("u")).put("pass", j.optString("p"))
        } catch (e: Exception) { clear(c); null }
    }
    fun clear(c: Context) { c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("wss").apply() }
}
