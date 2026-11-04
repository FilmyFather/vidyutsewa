package com.filmyfather.vidyutsewa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ParserTest {
    private fun fx() = javaClass.classLoader!!.getResource("status-submitted.html")!!.readText()

    @Test fun parsesRealPage() {
        val p = Parser.parse(fx())
        assertTrue(p.found)
        assertEquals("12345678", p.applicationId)
        assertEquals("001122334455", p.consumerNo)
        assertEquals("PATIL RAMESH SHANKAR", p.oldName)
        assertEquals("DESHMUKH SUNIL ANANT", p.newName)
        assertEquals(2, p.docsUploaded)
        assertEquals("Application Submitted", p.rawStatus)
        assertEquals("pending", p.status)
        assertEquals("130", p.fee)
        assertEquals("4400000000001", p.receiptNo)
        assertFalse(p.hasUploadForm)
    }
    @Test fun variants() {
        val base = fx()
        assertEquals("approved", Parser.parse(base.replace(">Application Submitted<", ">Application Approved<")).status)
        assertEquals("rejected", Parser.parse(base.replace(">Application Submitted<", ">Application Rejected<")).status)
        val zero = base.replace(Regex("(No of Documents Online Uploaded\\. </td><td>\\s*)2"), "$10")
            .replace("</form>", "<input type=\"file\" name=\"fu1\" /><input type=\"file\" name=\"fu2\" /><input type=\"submit\" name=\"btnUpload\" value=\"Upload All Documents\" /></form>")
        val z = Parser.parse(zero)
        assertEquals(0, z.docsUploaded)
        assertEquals(listOf("fu1", "fu2"), z.fileInputs)
        assertEquals("btnUpload" to "Upload All Documents", Parser.uploadButton(zero))
        assertTrue(Parser.aspFields(zero).containsKey("__VIEWSTATE"))
        assertFalse(Parser.parse("").found)
    }
    @Test fun idCapture() {
        assertEquals("87261272", Parser.findApplicationId("Your Application ID is 87261272."))
        assertEquals("11223344", Parser.findApplicationId("x?applicationno=11223344"))
        assertEquals("", Parser.findApplicationId("Consumer No 002233826874"))
    }
    @Test fun fileNames() {
        assertEquals("My_Agreement_final_2.pdf", Store.safeName("My Agreement (final) #2.PDF"))
        assertEquals("photo_12_copy.jpg", Store.safeName("photo 12 & copy.jpg"))
        assertEquals("Doc.pdf", Store.safeName("%%.pdf", "Doc"))
        listOf("a b.pdf", "x+y;z`.jpg", "it's q.pdf", "a<b>%.pdf").forEach { assertTrue(it, Regex("^[A-Za-z0-9_-]+\\.[a-z0-9]+$").matches(Store.safeName(it))) }
        assertEquals("SpellingCorrection_87261272.pdf", Store.docName("87261272", "single"))
        assertEquals("FormX_87261272.pdf", Store.docName("87261272", "formx"))
    }
    @Test fun docSlots() {
        assertEquals(listOf("single"), Store.slotsFor(org.json.JSONObject().put("docMode", "spell")))
        assertEquals(listOf("agreement", "formx"), Store.slotsFor(org.json.JSONObject()))
    }
    @Test fun dates() { assertTrue(Parser.parseDate("31-Oct-26")!! > 0); assertEquals(null, Parser.parseDate("31-ऑक्टो.-26")) }
}
