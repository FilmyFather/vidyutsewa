# VidyutSewa By Yuvraj

**Electricity Name Change & Tracker** for MSEDCL / Mahavitaran consumers, for Android and Windows.

> Independent Helper App. Not Affiliated With Or Endorsed By MSEDCL. All Applications Are Submitted And Paid On The Official MSEDCL Website.

Designed & Developed By ♥ [Yuvraj Chauhan](https://github.com/FilmyFather)

## Download

Get the latest files from **[Releases](https://github.com/FilmyFather/vidyutsewa/releases/latest)**:

| File | For |
|---|---|
| `VidyutSewa-By-Yuvraj-1.1.0.apk` | Android 5.0 and newer (signed with v1 + v2 + v3 schemes) |
| `VidyutSewa-By-Yuvraj-1.1.0-Windows-Portable.exe` | Windows 10 / 11 (64-bit), no install needed |

**Android:** open the APK, allow "Install Unknown Apps" for your browser / WhatsApp / file manager when asked, then tap Install. Allow notifications so status alerts can arrive.

**Windows:** double-click the EXE. Windows SmartScreen may say "Windows protected your PC" because the file is not code-signed: click **More info → Run anyway**. Closing the window keeps it running in the tray so background status checks continue; right-click the tray icon → Quit to exit.

## What it does

- **Shop Mode / Personal Mode**: shop name, default service fee and earnings for cyber cafe / CSC / xerox shops.
- **Home**: today / this month counts (Applied, Pending, Rejected, Approved), service-fee earnings, 3-day document upload deadline countdowns, recent activity.
- **New Application**: checklist → Agreement + Form X from camera, gallery or files (any size) → a file **up to 1 MB is never touched** (a JPEG is only placed into a PDF page as it is); a bigger file is compressed **once, on the device**, as gently as possible to just under 1 MB (the official upload page allows 1 MB), always with a clean file name (`Agreement_<ID>.pdf`, `FormX_<ID>.pdf`) → preview, swap, auto-detect by file name (Agmt / Agrmt / Agreement, Xform / X-Form / FormX) → confirm → apply on the **official MSEDCL site inside the app** → the 8-digit Application ID is captured from the page when possible (or typed) and saved.
- **Add Old Application**: 8-digit ID → verified from the official status page (name, consumer no, status) → choose the type → the PDFs are mandatory before saving.
- **Application type (per application)**: `Normal - Agreement + Form X` (two PDFs, both mandatory) or `Spelling Correction - 1 PDF` (exactly one PDF). Re-upload, details, Documents vault, WhatsApp share text and the 3-day deadline all follow the type.
- **Applications**: Pending / Rejected / Approved tabs, search by ID, name, consumer no or mobile; detail with timeline, fee + receipt, saved PDFs, Re-Upload, Share On WhatsApp, Open Official Status, Download Provisional Certificate (approved).
- **Background status checks** every 15 / 30 / 60 min (Android WorkManager; Windows while the app runs in the tray) with notifications: "Application Approved - ID", "Application Rejected - ID", "Re-Uploading Document - ID", re-upload done / failed. On approval the saved PDFs are deleted (setting).
- **Bill**: 12-digit consumer number → bill card (name, consumer no, billing unit, units, bill month, bill date, amount, due date, after-due amount, prompt payment discount) → **original MSEDCL bill PDF** download / share on WhatsApp, previous months, recent numbers.
- **Documents**: vault per Application ID.
- **Settings** (gear, top right): 4 themes (Royal Electric (default), Emerald Luxe, Sunset Power, Purple Aurora) × Dark / Light / System, English / हिंदी / मराठी, mode, notifications, auto re-upload, auto-delete, optional App Lock (PIN, fingerprint on Android), Next Customer wipe, WhatsApp template (`{Name}` `{ID}` `{Shop Name}`), backup & restore (one file with all data + PDFs), storage, update check against GitHub Releases.

## What's new in 1.1.0 - Apply For Change Of Name inside the app

The whole **New Application (Change Of Name)** now happens in native app screens. The official MSEDCL site (wss.mahadiscom.in) runs quietly behind the app in a hidden browser session, so every rule and every number still comes from the official site, but you never see its page unless you want to.

1. **Login**: user name, password and captcha (the captcha image is shown in the app, with a refresh button), then the OTP the official site sends. "Remember On This Phone" keeps the login encrypted with the phone's own key store (Windows: DPAPI); it can be removed any time.
2. **Consumer**: your consumer list is read from the official site, or add one (with its OTP).
3. **Page 1 - New Consumer Details**: Title + First Name in one row, Middle + Last Name in the next, the full name is composed automatically with a live `Name Length n / 50` counter that **blocks typing past 50 characters**. The title and reason lists are read from the official site. Email, mobile, reason.
4. **Page 2 - Aadhaar**: Generate OTP first, then the linked mobile number is shown **exactly as the official site shows it**, then the OTP and Verify. Skipped when the official page marks it optional. The Aadhaar number and OTP are never stored.
5. **Page 3 - Declaration and Submit**: declaration, place, mobile + email OTP. **Nothing is sent to MSEDCL until you tap Submit and confirm in a sheet.**
6. **Application number + documents**: slots are built from the official upload page; files up to 1 MB are not touched, bigger ones are gently compressed; clean file names. Upload now or later.
7. **Payment**: the official payment page opens inside the app (UPI intents open your UPI app; the QR code works). The app never sees card or UPI details.
8. **Receipt**: after payment the app checks the official page every 30 seconds for up to 5 minutes, then saves the receipt as an **image and the official PDF** in the Documents vault and in your phone's `Download/VidyutSewa` folder, with a WhatsApp share of both.

If the official page ever looks different from what the app expects, that step falls back to a generic screen built from the page's own fields, or to **Open Official Page** (the same hidden session, shown full screen, with copy buttons for your details). Tap the header title five times for a Diagnostics screen that lists every step the app took.

Windows: the same flow runs in a hidden window of the desktop app. Hindi and Marathi are extended for every new string.

Tests: `node tests/parsers.test.js` (name composition, 50-character counter, file rules, application number, fee, receipt status); `tests/mock/server.py` is a local imitation of the official pages used by the headless end-to-end runs in `tests/e2e/`. The mock is a model built from a screen recording, not the real site.

## What's new in 1.0.1

- Files up to 1 MB are not compressed at all; bigger files are gently compressed to just under 1 MB (was 300 KB).
- Upload file names only use letters, digits, `_` and `-` plus the extension, also for files that are not compressed.
- Spelling Correction applications need and upload only one PDF.
- Install fix for older phones: the APK is now signed with v1 + v2 + v3 and supports Android 5.0 and newer.

## Privacy

No server, no analytics, no data collection, no payment gateway. Everything (applications, PDFs, settings) stays on the device. The app only talks to the official MSEDCL sites (`css.mahadiscom.in`, `wss.mahadiscom.in`, `mobileapp.mahadiscom.in`, `billpdf.mahadiscom.in`) and to `api.github.com` for the update check. Login, captcha, OTP and payment are always done by the user on the official page.

## How it is built

```
web/        Shared UI (HTML/CSS/JS) used by both apps
  js/parsers.js   Status page + bill JSON parsers (unit tested)
  js/docs.js      On-device compression: images / PDFs -> one PDF < 300 KB (pdf.js + tiny PDF writer)
  js/core.js      Data store + status tracking engine
  js/app.js       Screens
  css/themes.css  All theme colours (CSS variables)
android/    Kotlin shell: WebView UI + native bridge, WorkManager status checks, notifications,
            official-site WebView (alerts, popups, file chooser with saved PDFs, downloads, UPI links)
desktop/    Electron shell for Windows (portable EXE), same UI, tray + notifications
tests/      Parser tests with an anonymised copy of a real status page
tools/      Headless UI smoke test
```

### Build

```bash
# tests
node tests/parsers.test.js

# Android (JDK 17 + Android SDK 35). Signing: android/keystore.properties (not in git)
cd android && ./gradlew assembleRelease testReleaseUnitTest

# Windows portable EXE (Node 20+; on Linux needs wine for the icon step)
cd desktop && npm install && npm run dist
```

## Known limits

- The bill and status endpoints are MSEDCL's own public pages / app endpoints, not a documented API. If MSEDCL changes them, the app shows an error and the "Official Site" buttons still work.
- Approved / rejected wording on the status page is matched broadly; the raw status text is always shown.
- Automatic re-upload uses the public upload page and is **experimental** (not yet verified on a real rejected application). If it fails you get a notification and the Re-Upload button opens the official upload page with your saved PDFs offered first.

## License

MIT © Yuvraj Chauhan
