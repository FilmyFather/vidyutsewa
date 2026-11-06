#!/usr/bin/env python3
"""Local MOCK of the official MSEDCL wss pages (login -> My Account -> Change Of Name -> upload -> pay -> receipt).
Built from the screen recording (labels, layout) - NOT the real site. Used only for headless tests.
Usage: python3 server.py [port] [resident|society]"""
import sys, re, json, io, time, random, urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from PIL import Image, ImageDraw, ImageFont

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
VARIANT = sys.argv[2] if len(sys.argv) > 2 else 'society'
import os
SUBMIT = os.environ.get('MOCK_SUBMIT', 'classic')   # classic (upload page) | ack (acknowledgement page with the application number, no message element) | ackbare (acknowledgement page without a number) | quiet (same form page comes back, no message)
DECL = os.environ.get('MOCK_DECL', 'native')   # native | handler (the site only counts a click on the box: .checked set from outside is not enough -> 'Please check Terms And Conditions')
NAMEMM = os.environ.get('MOCK_NAMEMM', '')   # 1: the first Aadhaar verify answers 'Name does not match'
MODE = os.environ.get('MOCK_LOGIN', 'classic')   # classic | ajax (real wss: ajax OTP step) | lag (ajax; the post-OTP page comes back unchanged once, logged-in on reload) | lagcreds (ajax; Generate OTP shows nothing, logged-in on reload)
SESS = {}
LOG = []

def S(h):
    ck = h.headers.get('Cookie', ''); m = re.search(r'MSID=(\w+)', ck)
    sid = m.group(1) if m else None
    if not sid or sid not in SESS:
        sid = '%08x' % random.getrandbits(32)
        _cons = [
            {'no': '092236112147', 'bu': '4960', 'name': 'TABASSUM NISHA', 'cat': 'LT-I Residential 1Ph' if VARIANT == 'resident' else 'LT-II Commercial'},
            {'no': '170012345678', 'bu': '3031', 'name': 'RAMESH KUMAR', 'cat': 'LT-I Residential 1Ph'}]
        for _i in range(int(os.environ.get('MOCK_CONS', '2')) - 2):     # long list for the search / scroll tests
            _cons.append({'no': '1%011d' % (500000 + _i * 37), 'bu': '4%03d' % (_i % 900), 'name': ['SURESH PATIL', 'MEENA SHAH', 'GANESH MANDAL', 'ANITA DESHMUKH', 'JAI LAXMI SOCIETY'][_i % 5] + ' ' + chr(65 + _i % 26), 'cat': 'LT-I Residential 1Ph'})
        SESS[sid] = {'cap': '', 'auth': False, 'otp_sent': False, 'uploaded': {}, 'rcpt_polls': 0, 'sid': sid, 'consumers': _cons}
    return sid, SESS[sid]

CSS = "<style>body{font-family:Arial;font-size:13px;margin:8px}table{border-collapse:collapse;width:100%}td,th{padding:4px;border:1px solid #ddd;vertical-align:middle}.hd{background:#4a7fb5;color:#fff;padding:3px 8px;font-weight:bold}.err{color:red;font-weight:bold}input[readonly]{background:#e8e8e8}.btn{background:#c33;color:#fff;border:0;padding:5px 12px}</style>"

LOGIN = """<form name="loginForm" id="loginForm" method="post" action="wss" onsubmit="return false">
<input type="hidden" name="uiActionName" id="uiActionName"><table style="width:360px">
<tr><td>User Name</td><td><input type="text" name="loginId" id="loginId" maxlength="24"></td></tr>
<tr><td>Password</td><td><input type="password" name="password" id="password" maxlength="20"></td></tr>
%(capcell)s
<tr><td>Enter Captcha</td><td><input type="text" maxlength="6" id="txtInput" name="txtInput"></td></tr>
<tr><td colspan="2"><button id="loginButton" type="submit" onclick="return validateLoginForm()">Generate OTP</button> <button id="clearButton" type="button">Clear</button></td></tr>
%(otp)s</table></form>
<script>
%(capjs)s
function validateLoginForm(){var p=document.getElementById('password');var l=document.getElementById('loginId').value;
 if(!l||!p.value||!document.getElementById('txtInput').value){alert('Enter login, password and captcha');return false}
 p.value='ENC:'+p.value.split('').reverse().join('');document.getElementById('uiActionName').value='login';document.getElementById('loginForm').submit();return false}
function validateLoginFormOTP(){document.getElementById('uiActionName').value='loginOtp';document.getElementById('loginForm').submit();return false}
</script>"""
OTPROW = """<tr><td colspan="2"><span class="err">%s</span></td></tr><tr><td>OTP</td><td><input type="text" name="txtOTP" id="txtOTP" maxlength="7"></td></tr>
<tr><td colspan="2"><button id="loginButtonOTP" type="submit" onclick="return validateLoginFormOTP()">Login</button></td></tr>"""


NAV = """<div id="leftnav_notloggedin" style="float:right;width:210px;border:1px solid #ccc;font-size:12px"><ul style="list-style:none;margin:0;padding:4px">
<li id="leftnav_homePage"><a href="wss?uiActionName=getHome"><span id="leftnav_lblHome">Home</span></a></li>
<li id="leftnav_createProfile"><a href="wss?uiActionName=getCreateProfile"><span id="leftnav_lblNewUser">New User Registration</span></a></li>
<li id="leftnav_loginPage"><a href="wss?uiActionName=getCustAccountLogin"><span id="leftnav_lblLogin">Login</span></a></li>
<li id="leftnav_forgotLoginPassword"><a href="wss?uiActionName=getForgot"><span id="leftnav_lblForgot">Forgot Login Name/Password?</span></a></li>
<li id="leftnav_complaintRegistration"><a id="leftnav_complaintRegistrationlnk" href="wss?uiActionName=getComplaint"><span id="leftnav_lblComplaint">Complaint Registration</span></a></li>
<li id="leftnav_trackComplaintStatus"><a id="leftnav_trackComplaintStatuslnk" href="wss?uiActionName=getTrack"><span id="leftnav_lblComplaintStatus">Complaint Status</span></a></li>
<li id="leftnav_submitReading"><a id="leftnav_submitReadinglnk" href="wss?uiActionName=getReading"><span id="leftnav_lblSubmitReading">Submit Self Reading</span></a></li>
</ul></div>"""

LOGIN_AJAX = """<div style="width:640px"><form name="loginForm" id="loginForm" method="post" action="wss" onsubmit="return false">
<input type="hidden" name="uiActionName" id="uiActionName"><table id="tblLoginForm" style="width:360px">
<tr><td>Login Name<span class="red">*</span></td><td><input type="text" name="loginId" id="loginId" maxlength="24"></td></tr>
<tr><td>Password<span class="red">*</span></td><td><input type="password" name="password" id="password" maxlength="20"></td></tr>
%(capcell)s
<tr><td>Captcha<span class="red">*</span></td><td><input type="text" maxlength="6" id="txtInput"></td></tr>
<tr><td colspan="2"><button id="loginButton" type="submit" onclick="return validateLoginForm()"><em><span id="lblLoginButton">Generate OTP</span></em></button> <button id="clearButton" type="submit" onclick="clearLoginForm()"><em><span id="lblClear">Clear</span></em></button></td></tr></table>
<table id="tblOTP" style="visibility:hidden;width:360px"><tr><td><span id="lblOTP">Enter OTP:</span><br><span id="lblMaskedEmail1"></span><br><span id="lblMaskedMobNo1"></span></td><td><input name="txtOTP" type="text" id="txtOTP" maxlength="7"></td>
<td><button id="loginButtonOTP" type="submit" onclick="return validateLoginFormOTP()"><em><span id="lblLoginOTP">Login</span></em></button></td></tr></table></form></div>
<script>
function post(u,b,cb){fetch(u,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:b}).then(function(r){return r.text()}).then(cb)}
function validateLoginForm(){var l=document.getElementById('loginId').value,p=document.getElementById('password').value,c=document.getElementById('txtInput').value;
 if(!l||!p||!c){alert('Enter Login Name, Password and Captcha First');return false}
 post('wss?uiActionName=validateLoginIdAndPassword&IsAjax=true','LoginId='+encodeURIComponent(l)+'&Password='+encodeURIComponent('ENC:'+p.split('').reverse().join(''))+'&txtInput='+encodeURIComponent(c),function(res){
  if(res.indexOf('true')==0){var t=res.split('#');alert('OTP has been successfully sent to following contact details. Email ID: '+t[1]+' Mobile Number: '+t[2]);document.getElementById('lblMaskedEmail1').innerHTML='Email ID: '+t[1];document.getElementById('lblMaskedMobNo1').innerHTML='Mobile Number: '+t[2];
   document.getElementById('loginButton').style.visibility='hidden';document.getElementById('tblOTP').style.visibility='visible'}
  else if(res.indexOf('Invalid_Captcha')==0){drawCap(res.substring(15,21));alert('Invalid Captcha')}
  else if(res.indexOf('false')==0){drawCap(res.substring(5,11));alert('Invalid login name or password.')}
  else if(res=='silent'){}});
 return false}
function validateLoginFormOTP(){var o=document.getElementById('txtOTP').value;if(!o){alert('Please enter OTP');return false}
 if(o.length!=7&&o.length!=6){alert('Entered OTP must be 7 digits only');return false}
 post('wss?uiActionName=validateLoginOTP&IsAjax=true','LoginId='+document.getElementById('loginId').value+'&OTP='+o,function(res){
  if(res.indexOf('true')==0){document.getElementById('uiActionName').value='postCustAccountLogin';document.loginForm.submit()}
  else{document.getElementById('txtOTP').value='';alert('You have entered wrong OTP!')}});return false}
function clearLoginForm(){document.getElementById('loginId').value='';document.getElementById('password').value='';document.getElementById('txtInput').value='';document.getElementById('tblOTP').style.visibility='hidden';document.getElementById('loginButton').style.visibility='visible'}
%(capjs)s
</script>"""

def page_login(sess, msg='', otp=False):
    sess['cap'] = ''.join(random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
    if MODE != 'classic':
        capcell = '<tr><td><b>Captcha </b></td><td><table><tr><td><div id="divCaptcha" style="border-style:ridge"></div></td><td><button id="btnCaptchaRefLogin" type="button" onclick="RefreshCaptchaLogin();">R</button></td></tr></table></td></tr>'
        capjs = "function drawCap(t){var d=document.getElementById('divCaptcha');d.innerHTML='';var c=document.createElement('canvas');c.id='captcha';c.width=100;c.height=40;var x=c.getContext('2d');x.font='25px Georgia';x.strokeText(t,0,30);d.appendChild(c);}function RefreshCaptchaLogin(){fetch('/__newcap').then(function(r){return r.text()}).then(drawCap)}window.addEventListener('load',function(){drawCap(CAPTEXT)});".replace('CAPTEXT', json.dumps(sess['cap']))
        return CSS + NAV + LOGIN_AJAX % {'capcell': capcell, 'capjs': capjs}
    extra = (OTPROW % msg) if otp else ('<tr><td colspan="2"><span id="lblErr" class="err">%s</span></td></tr>' % msg if msg else '')
    if VARIANT == 'resident':   # like the real wss page: the captcha is a canvas drawn by the page's own script
        capcell = '<tr><td><b>Captcha </b></td><td><table><tr><td><div id="divCaptcha" style="border-style:ridge"></div></td><td><button id="btnCaptchaRefLogin" type="button" onclick="RefreshCaptchaLogin();" style="height:50px"><img src="/refresh.png" alt="refresh" width="22" height="22"></button></td></tr></table></td></tr>'
        capjs = "function drawCap(t){var d=document.getElementById('divCaptcha');d.innerHTML='';var c=document.createElement('canvas');c.id='captcha';c.width=100;c.height=40;var x=c.getContext('2d');x.font='25px Georgia';x.strokeText(t,0,30);d.appendChild(c);}function RefreshCaptchaLogin(){fetch('/__newcap').then(function(r){return r.text()}).then(drawCap)}window.addEventListener('load',function(){drawCap(CAPTEXT)});".replace('CAPTEXT', json.dumps(sess['cap']))
    else:
        capcell = '<tr><td>Captcha</td><td><img id="imgCaptcha" src="/captcha?r=' + str(time.time()) + '" width="150" height="50"> <button id="btnCaptchaRefLogin" type="button" onclick="RefreshCaptchaLogin();">Refresh</button></td></tr>'
        capjs = "function RefreshCaptchaLogin(){document.getElementById('imgCaptcha').src='/captcha?r='+Date.now();}"
    return CSS + LOGIN % {'capcell': capcell, 'capjs': capjs, 'otp': extra}

def page_account(sess):
    rows = ''.join('<tr><td><input type="radio" name="consumerSel" id="radCustList" value="%s" onclick="radioCheck(this)"></td><td %s style="width:100px">%s</td><td class="right">%s</td><td class="left">%s</td><td>LT</td><td class="right">Oct 2026</td><td class="right">175</td><td class="right">1910</td><td class="right">02 Nov 2026</td></tr>' % (c['no'], ('' if os.environ.get('MOCK_NONAME') else 'title="%s"' % c['name']), c['no'], c['bu'], 'VASAI RD. URBAN S/DN') for i, c in enumerate(sess['consumers']))
    return CSS + """<div>Welcome, <b>Yuvi Shop</b> | <a href="wss?uiActionName=logout">Logout</a></div><div class="hd">My Account</div>
<form id="acc" method="post" action="wss"><input type="hidden" name="uiActionName" id="ua"><table id="grdCustList" class="list_table"><tr><th>&nbsp;</th><th>Consumer No.</th><th>BU</th><th>/Circle Code</th><th>HT/LT</th><th>Bill Month</th><th>Consumption</th><th>Bill Amount</th><th>Bill Due Date</th></tr>%s</table>
<p>To add a consumer click <a href="wss?uiActionName=getAddConsumer">Add Consumer</a></p>
<button type="button" onclick="go('getChangeLoad')">Change Load/Demand</button> <button type="button" id="btnCON" onclick="go('changeOfName')">Change Of Name</button> <button type="button" onclick="go('getComplaint')">Complaint Status</button>
</form><script>function radioCheck(r){}function go(a){if(!document.querySelector('input[name=consumerSel]:checked')){alert('Please select a consumer');return}document.getElementById('ua').value=a;document.getElementById('acc').submit()}</script>""" % rows

def page_addconsumer(sess, msg='', otp=False):
    return CSS + """<div class="hd">Add Consumer</div><form method="post" action="wss"><input type="hidden" name="uiActionName" value="%s"><table>
<tr><td>Consumer Number :*</td><td><input type="text" name="cno" maxlength="12"></td></tr><tr><td>Billing Unit :*</td><td><input type="text" name="bu" maxlength="4"></td></tr>%s
<tr><td colspan="2"><button type="submit" class="btn">%s</button></td></tr></table><div class="err" id="lblMsg">%s</div></form>""" % (
        'addConsumerVerify' if otp else 'addConsumerOtp', '<tr><td>OTP :*</td><td><input type="text" name="otp" id="otp"></td></tr>' if otp else '', 'Verify OTP' if otp else 'Get OTP', msg)

def page_form(sess, msg=''):
    c = sess['sel']; res = VARIANT == 'resident'
    aadh = """<tr><td colspan="2"><input type="checkbox" id="chkUIDAIConcent" name="chkUIDAIConcent" onclick="displayUIDAIAadharPanel()"> I, the holder of Aadhaar number, hereby give my consent to Maharashtra State Electricity Distribution Co. Ltd. to obtain my Aadhaar number and Name for authentication with UIDAI.</td></tr>
<tr id="TR_UIDAI_1" style="display: none"><td><span>Aadhaar Number/Virtual ID :</span></td><td><input name="txtAadharNo" type="text" id="txtAadharNo" data-prev-length="0"><img id="eyeIcon" alt="Toggle" width="20" height="19"></td><td><button id="btnUIDAIGenerateOTP" type="button" onclick="generateUIDAIOTP()"><em><span id="Label258">Generate OTP</span></em></button></td></tr>
<tr id="trAadharMobNo" style="visibility: hidden"><td><span>Enter Aadhar Registered Mobile Number :</span></td><td><input name="txtAadharMobNo" type="text" maxlength="10" readonly="readonly" id="txtAadharMobNo" onkeydown="return jsDecimalsOnlyNumeric(event);"></td></tr>
<tr id="TR_UIDAI_2" style="display: none"><td><span>Enter OTP:</span></td><td><input name="txtUIDAIOTP" type="text" maxlength="12" id="txtUIDAIOTP" onkeydown="return jsDecimalsOnlyNumeric(event);"></td><td><button id="btnUIDAIVerifyOTP" type="button" onclick="verifyAadhaarOTP();"><em><span id="Label264">Verify OTP</span></em></button></td></tr>
<input type="hidden" id="hdnIsAadharMandatory" value="%(mand)s"><input type="hidden" id="hdnAadharNum" name="hdnAadharNum" value=""><input type="hidden" id="aadharmobno4digit" value=""><input type="hidden" id="hdnSourceofAA" value=""><input type="hidden" id="hdnAadharNameAppName" value=""><input type="hidden" id="hdnIsAadharAuthenticated" value="N">
<input type="hidden" id="hdnccdmob1" value="%(m1)s"><input type="hidden" id="hdnccdmob2" value=""><input type="hidden" id="hdnccdmob3" value=""><input type="hidden" id="hdnccdmob4" value="">"""
    AADJS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fixtures', 'wss-aadhaar-real.js')).read()
    AADJS += """
function isEmpty(v){return v==null||String(v).replace(/\\s/g,'')==''}
function jsIsUserFriendlyChar(k,t){return [8,9,13,16,17,18,35,36,37,38,39,40,46,110,190].indexOf(k)>=0}
function callAjax(m,u,params,async_,cb){var x=new XMLHttpRequest();x.open(m,u,false);x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');x.send(params);cb(x.responseText)}
"""
    aadh = aadh % {'mand': 'Y' if VARIANT == 'resident' else 'N', 'm1': '9876543210' if os.environ.get('MOCK_AADMOB', 'match') == 'match' else '9000000000'}
    return CSS + """<form id="cf" method="post" action="wss"><input type="hidden" name="uiActionName" value="submitName">
<ul><li>Name Change request would be accepted Online only.</li><li>Note: For correction in spelling please select option no. 10 in purpose of transfer tab.</li></ul>
<div class="hd">Details of Old Consumer</div><table>
<tr><td>Consumer Number :*</td><td><input readonly value="%(no)s"></td><td>Application Date</td><td><input readonly value="05-Nov-2026"></td></tr>
<tr><td>Billing Unit :*</td><td><input readonly value="%(bu)s"></td><td>Meter Number</td><td><input readonly value="MAD2104482413"></td></tr>
<tr><td>Consumer Name :</td><td><input readonly value="%(name)s"></td><td>Category</td><td><input readonly value="LT"></td></tr>
<tr><td>Sub-Category :</td><td><input readonly value="%(cat)s"></td><td>Mobile number</td><td><input readonly value="98******34"></td></tr>
<tr><td>Email-ID:</td><td><input readonly value="req*********@gmail.com"></td><td></td><td></td></tr><tr><td>Current Arrears:</td><td><input readonly value="-3.36"></td></tr></table>
<div class="hd">Details of New Consumer</div><table>
<tr><td>First Name :*</td><td><select id="ddlTitle" name="title"><option value="">-- Select --</option><option>Mr</option><option>Mrs</option><option>Ms</option><option>M/S</option><option>Smt</option></select> <input type="text" id="txtConsumerFirstName" name="firstName" maxlength="50" onkeyup="comp()" onblur="comp()"></td></tr>
<tr><td>Middle Name :</td><td><input type="text" id="txtConsumerMiddleName" name="middleName" maxlength="50" onblur="comp()"></td></tr>
<tr><td>Last Name :*</td><td><input type="text" id="txtConsumerLastName" name="lastName" maxlength="50" onblur="comp()"></td></tr>
<tr><td>Consumer Full Name :</td><td><input type="text" id="txtConsumerFullName" name="fullName" readonly maxlength="50"> <span class="err">Max 50 char</span></td></tr>
<tr><td>Email ID :*</td><td><input type="text" id="txtEmail" name="email"></td><td>Phone No :</td><td><input type="text" id="txtPhone" name="phone"></td></tr>
<tr><td>Mobile number :*</td><td><input type="text" id="txtMobile" name="mobile" maxlength="10"></td></tr></table>
<div class="hd">Purpose of Transfer/Correction in Name</div><table><tr><td>Select a reason :*</td><td><select id="ddlReason" name="reason"><option value="">-- Select --</option>
<option value="1">1 - Death of Owner</option><option value="9">9 - Partition</option><option value="10">10 - Correction In Spelling</option><option value="11">11 - Change in Ownership</option></select></td></tr></table>
<div class="hd">Aadhar Authentication</div><table><tr><td colspan="2" style="color:blue">Note : Providing an Aadhaar number is optional for Consumers having other than Residential category.</td></tr>%(aadh)s</table>
<div class="hd">Document required :</div><div>Document Name<br>1) Proof of Title change (Any one of the below)<br>2) Consent Letter For Sd Transfer (Any one of the below)<br>- Form X</div>
<p>Please Click on "Generate OTP" button to get OTP on Mobile and Email Address for verification purpose.</p>
<button type="button" id="SubmitButton2" class="btn" onclick="genOtp()">Generate OTP</button>
<table id="otprow" style="display:none"><tr><td>Mobile OTP :*</td><td><input type="text" id="txtMobOtp" name="mobOtp" maxlength="6"></td><td>Email OTP :*</td><td><input type="text" id="txtEmailOtp" name="emailOtp" maxlength="6"></td></tr></table>
<div class="hd">I hereby declare that</div><ol><li>I will abide by the provisions of Electricity Act 2003.</li><li>The above information is true and if any false information is observed...</li></ol>
<table><tr><td><input type="checkbox" id="chkAgree" name="agree" onclick="window._decl=this.checked"> We agree to the terms and conditions</td><td>Place : <input type="text" id="txtPlace" name="place"></td></tr></table>
<p class="err">Please <a href="#">Click Here</a> to upload mandatory relevant document for Name change after submit.</p>
<button type="button" id="btnSubmit" class="btn" onclick="sub()">Submit</button><div class="err" id="lblMsg">%(msg)s</div></form>
<script>
var RES=%(res)s;
%(aadjs)s
function comp(){var t=document.getElementById('ddlTitle').value;var ms=(t=='M/S');var m=document.getElementById('txtConsumerMiddleName'),l=document.getElementById('txtConsumerLastName');if(ms){m.value='';l.value=''}m.style.display=ms?'none':'';l.style.display=ms?'none':'';var p=[t,txtConsumerFirstName.value,m.value,l.value].filter(Boolean).join(' ');document.getElementById('txtConsumerFullName').value=p.slice(0,50)}
document.getElementById('ddlTitle').onchange=comp;
function genOtp(){if(!confirm('You will get OTP on your registered Mobile Number: xxxxxx3210 and on Email Address for Change of Name application.\\n Do you want to confirm?'))return;fetch('wss?uiActionName=genOtp',{method:'POST',credentials:'include',body:'m='+txtMobile.value+'&e='+txtEmail.value,headers:{'Content-Type':'application/x-www-form-urlencoded'}}).then(r=>r.text()).then(t=>{alert(t);document.getElementById('otprow').style.display=''})}
function sub(){if(hdnIsAadharMandatory.value=='Y'&&hdnIsAadharAuthenticated.value=='N'&&!/society|trust|ltd|chs/i.test(txtConsumerFullName.value)){alert('For Residential Consumers, Aadhaar number authentication is mandatory');return}if(!document.getElementById('chkAgree').checked||(%(declmode)s=='handler'&&!window._decl)){alert('Please check Terms And Conditions');return}if(confirm('Are you sure you want to submit?'))document.getElementById('cf').submit()}
</script>""" % {'no': c['no'], 'bu': c['bu'], 'name': c['name'], 'cat': c['cat'], 'aadh': aadh, 'aadjs': AADJS, 'msg': msg, 'res': 'true' if res else 'false', 'declmode': repr(DECL)}

def page_upload(sess, msg=''):
    docs = ['Proof of Title change - Registered Agreement / possession letter', 'Consent Letter For Sd Transfer', 'Form X'] if not sess.get('spell') else ['Correction Document']
    rows = ''
    for i, d in enumerate(docs):
        up = sess['uploaded'].get(str(i))
        rows += '<tr><td>%s</td><td>%s</td></tr>' % (d, ('&#10004; Uploaded: %s (%d bytes)' % up) if up else
          '<form method="post" action="wss" enctype="multipart/form-data"><input type="hidden" name="uiActionName" value="uploadDoc"><input type="hidden" name="slot" value="%d"><input type="file" name="docFile%d" id="file%d"> <input type="submit" class="btn" value="Upload"></form>' % (i, i, i))
    return CSS + """<div class="hd">Application Submitted</div><p>Your Application No. is <b>%s</b>. Please upload documents (max 1 MB each, name without spaces).</p><table>%s</table><div class="err" id="lblMsg">%s</div>
<form method="post" action="wss"><input type="hidden" name="uiActionName" value="payFee"><p>Processing Fee: Rs. %s</p><input type="submit" class="btn" value="Pay Processing Fee"></form>""" % (sess['appno'], rows, msg, '130' if VARIANT == 'resident' else '180')

def page_pay(sess):
    return CSS + """<div class="hd">Payment Gateway (MOCK)</div><p>Amount: Rs. %s</p><img src="/qr.png" width="120"><p>upi://pay?pa=mock@bank</p>
<form method="post" action="wss"><input type="hidden" name="uiActionName" value="payDone"><input type="submit" class="btn" id="btnPayNow" value="Pay Now (mock)"></form>""" % ('130' if VARIANT == 'resident' else '180')

def page_receipt(sess):
    sess['rcpt_polls'] += 1
    ok = sess['rcpt_polls'] >= 3
    return CSS + ('' if ok else '<meta http-equiv="refresh" content="2;url=wss?uiActionName=getReceipt">') + """<div class="hd">Payment Receipt</div><table style="width:420px">
<tr><td>Application Number</td><td>%s</td></tr><tr><td>Consumer Number</td><td>%s</td></tr><tr><td>Transaction Id</td><td>TXN20261105001</td></tr>
<tr><td>Amount</td><td>Rs. %s</td></tr><tr><td>Payment Date</td><td>05-Nov-2026 04:41</td></tr><tr><td>Status</td><td id="st">%s</td></tr></table>
%s""" % (sess['appno'], sess['sel']['no'], '130' if VARIANT == 'resident' else '180', 'Success' if ok else 'Pending',
         '<br><input type="button" class="btn" id="btnViewReceipt" value="View Receipt" onclick="window.open(\'/wss/receipt.pdf?app=%s\')">' % sess['appno'] if ok else '<p>Refreshing every 30 seconds...</p>')

def make_pdf():
    return (b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
            b"4 0 obj<</Length 60>>stream\nBT /F1 14 Tf 20 100 Td (MOCK RECEIPT - Success) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF\n")

def parse_multipart(body, ctype):
    b = re.search(r'boundary=(.+)', ctype).group(1).encode(); fields = {}; files = {}
    for part in body.split(b'--' + b)[1:-1]:
        head, _, data = part.partition(b'\r\n\r\n'); data = data[:-2]
        nm = re.search(rb'name="([^"]+)"', head).group(1).decode(); fn = re.search(rb'filename="([^"]*)"', head)
        if fn: files[nm] = (fn.group(1).decode(), data)
        else: fields[nm] = data.decode()
    return fields, files

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, body, ct='text/html; charset=utf-8', code=200, extra=None):
        if isinstance(body, str): body = body.encode('utf-8')
        self.send_response(code); self.send_header('Content-Type', ct); self.send_header('Content-Length', str(len(body)))
        if getattr(self, '_sid', None): self.send_header('Set-Cookie', 'MSID=%s; Path=/' % self._sid)
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def do_GET(self): self.handle_any('GET')
    def do_POST(self): self.handle_any('POST')
    def handle_any(self, method):
        u = urllib.parse.urlparse(self.path); q = dict(urllib.parse.parse_qsl(u.query)); sid, sess = S(self); self._sid = sid
        fields = {}; files = {}
        if method == 'POST':
            n = int(self.headers.get('Content-Length', 0)); body = self.rfile.read(n); ct = self.headers.get('Content-Type', '')
            if 'multipart' in ct: fields, files = parse_multipart(body, ct)
            else: fields = dict(urllib.parse.parse_qsl(body.decode('utf-8', 'replace')))
        act = fields.get('uiActionName') or q.get('uiActionName') or ''
        LOG.append({'m': method, 'path': u.path, 'act': act, 'fields': {k: ('***' if k in ('password', 'otp', 'txtOTP', 'aadhaarNo', 'aadhaar', 'AadharNo', 'Aadhar', 'AadharOTP') else v[:60]) for k, v in fields.items()}, 'files': {str(k): (v[0], len(v[1])) for k, v in files.items()}, 'lens': {k: len(v) for k, v in fields.items() if k in ('AadharNo', 'Aadhar', 'AadharOTP')}, 'digits': {k: bool(re.fullmatch(r'\d+', v)) for k, v in fields.items() if k in ('AadharNo', 'Aadhar')}})
        if u.path == '/__log': return self.send(json.dumps(LOG), 'application/json')
        if u.path == '/wss/__form': sess['auth'] = True; sess['sel'] = sess['consumers'][0]; return self.send(page_form(sess))   # tests only: the form page without the login walk
        if u.path == '/__reset': SESS.clear(); LOG.clear(); return self.send('ok')
        if u.path == '/captcha':
            im = Image.new('RGB', (150, 50), (240, 240, 230)); d = ImageDraw.Draw(im)
            try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
            except Exception: f = None
            d.text((10, 8), sess['cap'], fill=(30, 30, 120), font=f)
            for _ in range(4): d.line([(random.randint(0, 150), random.randint(0, 50)), (random.randint(0, 150), random.randint(0, 50))], fill=(160, 90, 90))
            bio = io.BytesIO(); im.save(bio, 'PNG'); return self.send(bio.getvalue(), 'image/png', extra={'Cache-Control': 'no-store'})
        if u.path == '/__newcap': sess['cap'] = ''.join(random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6)); return self.send(sess['cap'])
        if u.path == '/refresh.png':
            bio = io.BytesIO(); Image.new('RGB', (22, 22), (200, 200, 200)).save(bio, 'PNG'); return self.send(bio.getvalue(), 'image/png')
        if u.path == '/__cap': return self.send(sess['cap'])
        if u.path == '/qr.png':
            im = Image.new('RGB', (120, 120), 'white'); d = ImageDraw.Draw(im)
            for x in range(12):
                for y in range(12):
                    if random.random() < .5: d.rectangle([x * 10, y * 10, x * 10 + 9, y * 10 + 9], fill='black')
            bio = io.BytesIO(); im.save(bio, 'PNG'); return self.send(bio.getvalue(), 'image/png')
        if u.path == '/wss/receipt.pdf':
            if not sess['auth']: return self.send('login', code=403)
            return self.send(make_pdf(), 'application/pdf', extra={'Content-Disposition': 'inline; filename="receipt.pdf"'})
        if u.path != '/wss/wss': return self.send('not found', code=404)
        if act == 'validateLoginIdAndPassword':
            if fields.get('txtInput', '').upper() != sess['cap']:
                sess['cap'] = ''.join(random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6)); return self.send('Invalid_Captcha' + sess['cap'])
            if fields.get('LoginId') != 'yuvishop' or fields.get('Password') != 'ENC:' + 'Pass@123'[::-1]:
                sess['cap'] = ''.join(random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6)); return self.send('false' + sess['cap'])
            sess['otp_sent'] = True
            if MODE == 'lagcreds': sess['auth'] = True; return self.send('silent')
            return self.send('true#a****@gmail.com#98******94')
        if act == 'validateLoginOTP':
            if sess['otp_sent'] and fields.get('OTP') == '123456': sess['otp_ok'] = True; return self.send('true')
            return self.send('false')
        if act == 'postCustAccountLogin':
            if sess.get('otp_ok'):
                sess['auth'] = True
                if MODE == 'lag' and not sess.get('lagged'): sess['lagged'] = True; return self.send(page_login(sess))   # same login page comes back once, no message
                return self.send(page_account(sess))
            return self.send(page_login(sess, 'Session expired. Please login again.'))
        if act in ('', 'getCustAccountLogin'):
            if MODE == 'lagcreds' and sess['auth']: return self.send(page_account(sess))
            return self.send(page_login(sess))
        if act == 'login':
            if fields.get('txtInput', '').upper() != sess['cap']: return self.send(page_login(sess, 'Invalid Captcha'))
            if fields.get('loginId') != 'yuvishop' or fields.get('password') != 'ENC:' + 'Pass@123'[::-1]: return self.send(page_login(sess, 'Invalid user name or password'))
            sess['otp_sent'] = True; return self.send(page_login(sess, "OTP sent to your registered mobile. Please enter the OTP and click the 'Login' button", otp=True))
        if act == 'loginOtp':
            if fields.get('txtOTP') == '123456' and sess['otp_sent']: sess['auth'] = True; return self.send(page_account(sess))
            return self.send(page_login(sess, 'Invalid OTP', otp=True))
        if act == 'logout': sess['auth'] = False; return self.send(page_login(sess))
        if not sess['auth']: return self.send(page_login(sess, 'Session expired. Please login again.'))
        if act == 'getMyAccount': return self.send(page_account(sess))
        if act == 'getAddConsumer': return self.send(page_addconsumer(sess))
        if act == 'addConsumerOtp': return self.send(page_addconsumer(sess, 'OTP sent to the mobile registered for this consumer', otp=True))
        if act == 'addConsumerVerify':
            if fields.get('otp') == '654321': sess['consumers'].append({'no': fields.get('cno', '999999999999'), 'bu': fields.get('bu', '0000'), 'name': 'ADDED CONSUMER', 'cat': 'LT-I'}); return self.send(page_account(sess))
            return self.send(page_addconsumer(sess, 'Invalid OTP', otp=True))
        if act == 'changeOfName':
            no = fields.get('consumerSel'); sess['sel'] = next((c for c in sess['consumers'] if c['no'] == no), sess['consumers'][0]); return self.send(page_form(sess))
        if act == 'generateAadharOTPUIDAI':
            no = fields.get('AadharNo', '')   # honest like the real site: an empty / non-digit / not 12-digit number is what it answers "Invalid Auth XML format" to
            if not re.fullmatch(r'\d{12}', no): return self.send(json.dumps({'Ret': 'N', 'ErrorDesc': 'Invalid Auth XML format.'}), 'application/json')
            sess['aad'] = True; return self.send(json.dumps({'Ret': 'Y', 'ErrorDesc': '', 'ResponseMessage': 'OTP sent to mobile number ending ****3210'}), 'application/json')
        if act == 'validateAadharOTPUIDAI':
            ok = fields.get('AadharOTP') == '246810' and re.fullmatch(r'\d{12}', fields.get('Aadhar', ''))
            if not ok: return self.send(json.dumps({'Ret': 'N', 'ErrorDesc': 'Invalid OTP'}), 'application/json')
            nm = fields.get('ConsumerFullName', '')
            if NAMEMM and not sess.get('mm_done'): sess['mm_done'] = True; nm = 'SOMEBODY ELSE ENTIRELY'
            return self.send(json.dumps({'Ret': 'Y', 'ErrorDesc': '', 'Poi': {'name': nm}}), 'application/json')
        if act == 'genOtp': return self.send('OTP sent to registered mobile and email')
        if act == 'submitName':
            err = []
            if not fields.get('firstName'): err.append('First name required')
            if not fields.get('title'): err.append('Select title')
            if fields.get('reason', '') == '': err.append('Select a reason')
            if not re.match(r'^\d{10}$', fields.get('mobile', '')): err.append('Mobile invalid')
            if '@' not in fields.get('email', ''): err.append('Email invalid')
            if fields.get('mobOtp') != '111111' or fields.get('emailOtp') != '222222': err.append('Invalid OTP')
            if not fields.get('agree'): err.append('Accept declaration')
            if not fields.get('place'): err.append('Place required')
            sess['spell'] = fields.get('reason') == '10'
            if err: return self.send(page_form(sess, '; '.join(err)))
            sess['appno'] = '80%06d' % random.randint(0, 999999); sess['submitted'] = fields
            if SUBMIT == 'ack': return self.send(CSS + '<div>Dear Consumer,application %s for Change of Name is received on date 06-Nov-2026 for consumer no. %s.MSEDCL</div><p><a href="wss?uiActionName=getMyAccount">Home</a></p>' % (sess['appno'], fields.get('consumerNo', '002211661987')))
            if SUBMIT == 'ackbare': return self.send(CSS + '<div>Thank you. Your request has been processed.</div>')
            if SUBMIT == 'quiet': return self.send(page_form(sess))
            return self.send(page_upload(sess))
        if act == 'uploadDoc':
            slot = fields.get('slot'); fk = [k for k in files if str(k).startswith('docFile')]
            if not fk or not files[fk[0]][0]: return self.send(page_upload(sess, 'Please choose a file'))
            fn, data = files[fk[0]]
            if len(data) > 1048576: return self.send(page_upload(sess, 'File size exceeds 1 MB'))
            if not re.match(r'^[A-Za-z0-9_-]+\.(pdf|jpg|png)$', fn): return self.send(page_upload(sess, 'Invalid file name'))
            sess['uploaded'][slot] = (fn, len(data)); return self.send(page_upload(sess))
        if act == 'payFee': return self.send(page_pay(sess))
        if act == 'payDone': sess['rcpt_polls'] = 0; return self.send(page_receipt(sess))
        if act == 'getReceipt': return self.send(page_receipt(sess))
        return self.send('unknown action ' + act, code=404)

if __name__ == '__main__':
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), H)
    if len(sys.argv) > 4 and sys.argv[3] == 'tls':   # optional: https with a throw-away certificate (for the Electron run: host-resolver maps the real host name here)
        import ssl
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(sys.argv[4]); srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    srv.serve_forever()
