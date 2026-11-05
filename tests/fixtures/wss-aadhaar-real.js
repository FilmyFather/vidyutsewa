/* Aadhaar part of the official Change-Of-Name page script, copied from the sanitised snapshot (no personal data). Used ONLY by tests/mock/server.py
   so the mock masks and posts the Aadhaar number exactly like the real page does. */
        function jsDecimalsOnlyNumeric(e) {
            var evt = (e) ? e : window.event;
            var key = (evt.keyCode) ? evt.keyCode : evt.which;
            if (key != null) {
                key = parseInt(key, 10);
                if ((key < 48 || key > 57) && (key < 96 || key > 105)) {
                    if (!jsIsUserFriendlyChar(key, "Decimals")) {
                        alert("Only Numeric Values allowed");
                        return false;
                    }
                }
                else {
                    if (evt.shiftKey) {
                        return false;
                    }
                }
                if (key == 190) {
                    alert('Decimals not allowed. Please re-enter.');
                    document.getElementById("txtAadhaarNumber").value = "";
                }
            }
            return true;
        }
        function displayUIDAIAadharPanel() {
            var concentUIDAI = document.getElementById("chkUIDAIConcent").checked;
            if (concentUIDAI == true) {
                document.getElementById("TR_UIDAI_1").style.display = "";
            }
            else {
                document.getElementById("TR_UIDAI_1").style.display = "none";
                document.getElementById("TR_UIDAI_2").style.display = "none";
            }
        }
        function savetoVault() {
            var txtUIDAI = document.getElementById("txtAadharNo").value;
            var params = "AadharNo=" + txtUIDAI;
            var out =
            {
                resp: function savetoVaultCons(res) {
                    var JsonObj = eval("(" + res + ")");
                    if (JsonObj.toString().substring(0, 5) == "Error") {
                        alert(JsonObj.toString());
                        return;
                    }
                    else if (JsonObj.toString() == "false") {
                        alert("Incorrect OTP,Please select option again for resend OTP.");
                        return;
                    }
                    else {
                    }
                }
            }
            callAjax("POST", "wss?uiActionName=SaveUIDtoVaultForm&IsAjax=true", params, false, out.resp);
        }
        function generateUIDAIOTP() {
            var txtAadhar = document.getElementById("hdnAadharNum").value;
            var ConsumerFirstName = document.getElementById("txtConsumerFirstName").value.replace(/^\s*|\s*$/g, '');
            var ConsumerLastName = document.getElementById("txtConsumerLastName").value.replace(/^\s*|\s*$/g, '');
            if (isEmpty(ConsumerFirstName)) {
                alert("Please enter First Name");
                return false;
            }
            if (isEmpty(ConsumerLastName)) {
                alert("Please enter Last Name");
                return false;
            }
            if (isEmpty(txtAadhar)) {
                alert("Please Enter Valid Aadhar Number.");
                return false;
            }
            document.getElementById("TR_UIDAI_2").style.display = "";
            document.getElementById('hdnSourceofAA').value = "0003";//Added on 29-OCT-2025 for Saving Source of Aadhar Authentication
            var SourceofAA = "0003";       //Added on 29-OCT-2025 for Saving Source of Aadhar Authentication 
            var params = "AadharNo=" + txtAadhar + "&hdnSourceofAA=" + SourceofAA; //Added on 29-OCT-2025 for Saving Source of Aadhar Authentication
            var out =
            {
                resp: function validateConsumerNumber(res) {
                    var JsonObj = eval("(" + res + ")");
                    if (JsonObj.toString().substring(0, 5) == "Error") {
                        alert(JsonObj.toString());
                        return;
                    }
                    else if (JsonObj.Ret == "N" || JsonObj.Ret == "n") {
                        alert("Invalid Aadhar Number entered.");
                        alert(JsonObj.ErrorDesc);
                        return;
                    }
                    else if (JsonObj.ResponseMessage == null) /*Added on 17th-NOV-2025 for displaying error at UIDAI */ {
                        alert("Error at UIDAI for Sending OTP to Aadhar Registered Mobile number. Please try after some time.")
                    } /*Added on 17th-NOV-2025 for displaying error at UIDAI - end*/
                    else {
                        var resultmsg = JsonObj.ResponseMessage;
                        var aadharmobno = resultmsg.substring(resultmsg.length - 4);
                        document.getElementById("aadharmobno4digit").value = aadharmobno;
                        var ccd1 = document.getElementById("hdnccdmob1").value; 
                        var ccd2 = document.getElementById("hdnccdmob2").value; 
                        var ccd3 = document.getElementById("hdnccdmob3").value; 
                        var ccd4 = document.getElementById("hdnccdmob4").value; 
                        if (ccd4 != '') {
                            if (aadharmobno == ccd4.substring(ccd4.length - 4)) {
                                document.getElementById("txtAadharMobNo").value = ccd4;
                            }
                        }
                         if (ccd3 != '') {
                            if (aadharmobno == ccd3.substring(ccd3.length - 4)) {
                                document.getElementById("txtAadharMobNo").value = ccd3;
                            }
                        }
                         if (ccd2 != '') {
                            if (aadharmobno == ccd2.substring(ccd2.length - 4)) {
                                document.getElementById("txtAadharMobNo").value = ccd2;
                            }
                        }
                         if (ccd1 != '') {
                            if (aadharmobno == ccd1.substring(ccd1.length - 4)) {
                                document.getElementById("txtAadharMobNo").value = ccd1;
                            }
                        }
                        if (document.getElementById("txtAadharMobNo").value == '') {
                             document.getElementById('txtAadharMobNo').readOnly = false;
                        }
                        document.getElementById("trAadharMobNo").style.visibility = "visible";
                        alert(JsonObj.ResponseMessage);
                    }
                }
            }
            callAjax("POST", "wss?uiActionName=generateAadharOTPUIDAI&IsAjax=true", params, false, out.resp);
        }
        function showDuplicatePopup() {
            var messageText = document.getElementById("hdnMessageText").value;
            if (messageText != "")
                alert(messageText);
        }
        function verifyAadhaarOTP() {
            debugger;
            var txtUIDAI = document.getElementById("hdnAadharNum").value;
            var txtUIDAIOTP = document.getElementById("txtUIDAIOTP").value;
            var params = "AadharOTP=" + txtUIDAIOTP;
            var ConsumerFullName = document.getElementById("txtConsumerFullName").value.replace(/^\s*|\s*$/g, '');
            var params = "Aadhar=" + txtUIDAI + "&AadharOTP=" + txtUIDAIOTP + "&ConsumerFullName=" + ConsumerFullName;
            var otp_verified = false;
            var out =
            {
                resp: function validateAadharOTP(res) {
                    var JsonObj = eval("(" + res + ")");
                    if (JsonObj.toString().substring(0, 5) == "Error") {
                        alert(JsonObj.toString());
                        return;
                    }
                    else if (JsonObj.Ret == "N" || JsonObj.Ret == "n") {
                        alert("Error in Validating OTP or You have entered Incorrect OTP.");
                        alert(JsonObj.ErrorDesc);
                        otp_verified = false;
                        return;
                    }
                    else if (JsonObj == "N" || JsonObj == "n") {
                        alert("Error in Validating OTP or You have entered Incorrect OTP.");
                        alert(JsonObj.ErrorDesc);
                        otp_verified = false;
                        return;
                    }
                    else if (JsonObj.toString() == "false") {
                        alert("Incorrect OTP,Please select option again for resend OTP.");
                        return;
                    }
                    else {
                        otp_verified = true;
                        var ConsumerFullName = document.getElementById("txtConsumerFullName").value.replace(/^\s*|\s*$/g, '');
                        var POIName = '';
                        POIName = JsonObj.Poi.name;
                        document.getElementById("hdnAadharNameAppName").value = "Y";
                        const result = areNamesPartiallyMatching(POIName, ConsumerFullName, 2);
                        if (!result) {
                            alert("OTP Verified. However, Name does not match with Aadhar Registered Name at UIDAI. Please re-enter the name as per Aadhar Registered Name.");
                            document.getElementById("txtConsumerFirstName").value = "";
                            document.getElementById("txtConsumerMiddleName").value = "";
                            document.getElementById("txtConsumerLastName").value = "";
                            document.getElementById("txtConsumerFullName").value = "";
                            document.getElementById("TR_UIDAI_2").style.display = "none";
                            document.getElementById("txtUIDAIOTP").value = "";
                            const input = document.getElementById("txtAadharNo");
                            const hidden = document.getElementById("hdnAadharNum");
                            document.getElementById("hdnAadharNameAppName").value = "N";
                            if (input) {
                                input.value = "";
                                input.dataset.prevLength = 0; // ← Set as number, not string
                            }
                            if (hidden) {
                                hidden.value = "";
                            }
                            if (typeof aadhaarRaw !== "undefined") {
                                aadhaarRaw = "";
                            }
                            if (typeof isMasked !== "undefined") {
                                isMasked = true;
                                const icon = document.getElementById("eyeIcon");
                                if (icon) icon.src = "images/eye.png";
                            }
                        }
                        else {
                              alert("OTP Verified. Name matched with Aadhar Registered Name.");
                            hdnIsAadharAuthenticated.value = "Y";
                            document.getElementById('txtConsumerFirstName').readOnly = true;
                        document.getElementById('txtConsumerMiddleName').readOnly = true;
                        document.getElementById('txtConsumerLastName').readOnly = true;
                        }
                    }
                }
            }
            callAjax("POST", "wss?uiActionName=validateAadharOTPUIDAI&IsAjax=true", params, false, out.resp);
        }
        function clearAadhaarInput() {
            const input = document.getElementById("txtAadharNo");
            const hidden = document.getElementById("hdnAadharNum");
            input.value = "";
            hidden.value = "";
            if (typeof aadhaarRaw !== "undefined") {
                aadhaarRaw = "";
            }
            if (input && input.dataset) {
                input.dataset.prevLength = "0";
            }
        }
        function areNamesPartiallyMatching(name1, name2, minWordMatches) {
            name1 = name1.replace(/\./g, ' ');
            const nameParts1 = name1.toLowerCase().split(/\s+/).filter(Boolean);
            const nameParts2 = name2.toLowerCase().split(/\s+/).filter(Boolean);
            let commonCount = 0;
            nameParts1.forEach(word => {
                if (nameParts2.includes(word)) {
                    commonCount++;
                }
            });
            return commonCount >= minWordMatches;
        }
        let aadhaarRaw = "";
        let isMasked = true;
        function maskAadhaar(raw) {
            if (raw.length <= 4) return raw;
            let visible = raw.slice(-4);
            let maskedCount = Math.min(8, raw.length - 4);
            return "*".repeat(maskedCount) + raw.slice(maskedCount, -4) + visible;
        }
        function updateAadhaarDisplay() {
            const input = document.getElementById("txtAadharNo");
            const hidden = document.getElementById("hdnAadharNum");
            if (!input) return;
            input.value = isMasked ? maskAadhaar(aadhaarRaw) : aadhaarRaw;
            input.dataset.prevLength = aadhaarRaw.length;
            hidden.value = aadhaarRaw;
        }
        function onAadhaarKeyDown(e) {
            const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];
            if (allowedKeys.includes(e.key)) return;
            if (!/^\d$/.test(e.key) || aadhaarRaw.length >= 12) {
                e.preventDefault();
            }
        }
        function onAadhaarInput(e) {
            const input = e.target;
            const currentLength = input.value.length;
            const prevLength = Number(input.dataset.prevLength || 0);
            if (currentLength < prevLength) {
                aadhaarRaw = aadhaarRaw.slice(0, -1);
            } else {
                let lastChar = input.value.slice(-1);
                if (/^\d$/.test(lastChar) && aadhaarRaw.length < 12) {
                    aadhaarRaw += lastChar;
                }
            }
            updateAadhaarDisplay();
        }
        function toggleMask() {
            isMasked = !isMasked;
            updateAadhaarDisplay();
            const icon = document.getElementById("eyeIcon");
            if (icon) icon.src = isMasked ? "images/eye.png" : "images/eye_slashed.png";
        }
        function clearAadhaarInput() {
            aadhaarRaw = "";
            isMasked = true;
            const input = document.getElementById("txtAadharNo");
            const hidden = document.getElementById("hdnAadharNum");
            const icon = document.getElementById("eyeIcon");
            if (input) {
                input.value = "";
                input.dataset.prevLength = 0;
            }
            if (hidden) hidden.value = "";
            if (icon) icon.src = "images/eye.png";
        }
        function bindAadhaarEvents() {
            const input = document.getElementById("txtAadharNo");
            const icon = document.getElementById("eyeIcon");
            if (!input) return;
            input.removeEventListener("keydown", onAadhaarKeyDown);
            input.removeEventListener("input", onAadhaarInput);
            input.addEventListener("keydown", onAadhaarKeyDown);
            input.addEventListener("input", onAadhaarInput);
            if (icon) {
                icon.removeEventListener("click", toggleMask);
                icon.addEventListener("click", toggleMask);
            }
            updateAadhaarDisplay();
        }
        if (typeof Sys !== "undefined" && Sys.WebForms && Sys.WebForms.PageRequestManager) {
            Sys.WebForms.PageRequestManager.getInstance().add_pageLoaded(bindAadhaarEvents);
        }
        window.addEventListener("load", bindAadhaarEvents);
