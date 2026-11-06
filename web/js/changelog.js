/* VidyutSewa By Yuvraj - ONE shared release source for Android and Windows.
   Edit this file for every update: add the new version at the TOP of VS_CHANGELOG and change VS_RELEASE.version.
   CHANGELOG.md and the GitHub release notes are generated from it: node tools/gen-changelog.js */
(function () {
  window.VS_RELEASE = {
    version: '1.1.4',
    graceDays: 15, // used only if the update manifest has no valid graceDays
    manifestUrl: 'https://raw.githubusercontent.com/FilmyFather/vidyutsewa/main/update/latest.json'
  };
  window.VS_CHANGELOG = [
  {
    "v": "1.1.4",
    "date": "2026-11-07",
    "items": [
      "Submit Fix: The App Now Knows When The Official Site Accepted The Application And Shows An Application Submitted Screen",
      "Application Number Is Shown Big, With Copy And Open Official Page Buttons",
      "Submit Can Not Be Tapped Twice: After The First Submit The Button Is Locked To Avoid A Duplicate Application",
      "Result Unclear Screen: If The Site Shows No Number, The App Says Check Your SMS Instead Of Showing The Old Form Again",
      "Before Submit The App Checks The Official Page: Declaration Ticked, Place And OTP Filled",
      "New I Agree To The Terms And Conditions Box On The Last Screen",
      "Name Does Not Match Aadhaar Now Shows A Clear Message And Takes You Back To Edit The Name",
      "Login OTP Screen Shows Which Mobile Or Email The OTP Was Sent To"
    ]
  },
  {
    "v": "1.1.3",
    "date": "2026-11-06",
    "items": [
      "Windows Setup Installer: Installs Like A Normal App, With Desktop And Start Menu Shortcuts",
      "What's New Screen With The Full Version History (Settings, About)",
      "What's New Opens By Itself Once After Every Update",
      "New Version Available Pop-Up With Update Now And Later Buttons",
      "A Version Stops Working 15 Days After A New Update Is Released, Until You Update",
      "The Update Check Sends Nothing About You And Never Blocks If You Are Offline"
    ]
  },
  {
    "v": "1.1.2",
    "date": "2026-11-05",
    "items": [
      "Aadhaar Step Fixed: The Number Is Now Typed One Digit At A Time, Like The Official Site Expects",
      "Aadhaar Linked Mobile Is Fetched From The Official Site; Correct Generate OTP And Verify OTP Buttons",
      "The Official Site's OTP Pop-Up Text (Which Email Or Mobile Got The OTP) Is Shown In The App",
      "M/S: One Single Name Line, Counted Together With M/S In The 50 Character Limit",
      "All Names Are Typed In Capital Letters",
      "Consumer List Shows Names With A Search Box (Name Or Number)",
      "Diagnostics And Copy Button On Every Step"
    ]
  },
  {
    "v": "1.1.1",
    "date": "2026-11-05",
    "items": [
      "Login Fix: The App Now Presses The Real Generate OTP Button Of The Official Site",
      "Waits For The Official Page To Answer And Keeps The Captcha Unless The Site Rejects It",
      "Better Diagnostics With Page Title, Address And Error Text"
    ]
  },
  {
    "v": "1.1.0",
    "date": "2026-11-05",
    "items": [
      "First Native Change Of Name Flow: Login, Consumer, Details, Aadhaar, OTP And Submit Inside The App",
      "Live Name Length Counter Out Of 50",
      "Documents Upload From The App; Payment On The Official Page Inside The App",
      "Receipt Is Saved As Image And PDF With A WhatsApp Share",
      "Windows App Runs The Same Flow In A Hidden Window"
    ]
  },
  {
    "v": "1.0.1",
    "date": "2026-11-04",
    "items": [
      "Files Up To 1 MB Are Not Compressed; Bigger Files Are Gently Compressed Under 1 MB",
      "Clean Upload File Names",
      "New Spelling Correction Mode With A Single PDF",
      "Install Fix: Signed For Android 5.0 And Newer"
    ]
  },
  {
    "v": "1.0.0",
    "date": "2026-11-03",
    "items": [
      "First Release: Track Name Change Applications, Bills And Documents On Android And Windows",
      "Four Themes: Royal Electric, Emerald Luxe, Sunset Power And Purple Aurora, Each In Dark And Light",
      "Hindi And Marathi Language Support; Nothing Is Collected, Everything Stays On Your Device"
    ]
  }
];
})();
