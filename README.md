# VidyutSewa By Yuvraj

**Electricity Name Change & Tracker** for MSEDCL / Mahavitaran consumers, for Android and Windows.

> Independent Helper App. Not Affiliated With Or Endorsed By MSEDCL. All Applications Are Submitted And Paid On The Official MSEDCL Website.

Designed & Developed By ♥ [Yuvraj Chauhan](https://github.com/FilmyFather)

## Download

Get the latest files from **[Releases](https://github.com/FilmyFather/vidyutsewa/releases/latest)**:

| File | For |
|---|---|
| `VidyutSewa-By-Yuvraj-1.0.0.apk` | Android 7.0 and newer |
| `VidyutSewa-By-Yuvraj-1.0.0-Windows-Portable.exe` | Windows 10 / 11 (64-bit), no install needed |

**Android:** open the APK, allow "Install Unknown Apps" for your browser / WhatsApp / file manager when asked, then tap Install. Allow notifications so status alerts can arrive.

**Windows:** double-click the EXE. Windows SmartScreen may say "Windows protected your PC" because the file is not code-signed: click **More info → Run anyway**. Closing the window keeps it running in the tray so background status checks continue; right-click the tray icon → Quit to exit.

## What it does

- **Shop Mode / Personal Mode**: shop name, default service fee and earnings for cyber cafe / CSC / xerox shops.
- **Home**: today / this month counts (Applied, Pending, Rejected, Approved), service-fee earnings, 3-day document upload deadline countdowns, recent activity.
- **New Application**: checklist → Agreement + Form X from camera, gallery or files (any size) → compressed **once, on the device**, to a PDF under 300 KB with a clean file name (`Agreement_<ID>.pdf`, `FormX_<ID>.pdf`) → preview, swap, auto-detect by file name (Agmt / Agrmt / Agreement, Xform / X-Form / FormX) → confirm → apply on the **official MSEDCL site inside the app** → the 8-digit Application ID is captured from the page when possible (or typed) and saved.
- **Add Old Application**: 8-digit ID → verified from the official status page (name, consumer no, status) → both PDFs are mandatory before saving.
- **Applications**: Pending / Rejected / Approved tabs, search by ID, name, consumer no or mobile; detail with timeline, fee + receipt, saved PDFs, Re-Upload, Share On WhatsApp, Open Official Status, Download Provisional Certificate (approved).
- **Background status checks** every 15 / 30 / 60 min (Android WorkManager; Windows while the app runs in the tray) with notifications: "Application Approved - ID", "Application Rejected - ID", "Re-Uploading Document - ID", re-upload done / failed. On approval the saved PDFs are deleted (setting).
- **Bill**: 12-digit consumer number → bill card (name, consumer no, billing unit, units, bill month, bill date, amount, due date, after-due amount, prompt payment discount) → **original MSEDCL bill PDF** download / share on WhatsApp, previous months, recent numbers.
- **Documents**: vault per Application ID.
- **Settings** (gear, top right): 4 themes (Royal Electric (default), Emerald Luxe, Sunset Power, Purple Aurora) × Dark / Light / System, English / हिंदी / मराठी, mode, notifications, compression quality, auto re-upload, auto-delete, optional App Lock (PIN, fingerprint on Android), Next Customer wipe, WhatsApp template (`{Name}` `{ID}` `{Shop Name}`), backup & restore (one file with all data + PDFs), storage, update check against GitHub Releases.

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
