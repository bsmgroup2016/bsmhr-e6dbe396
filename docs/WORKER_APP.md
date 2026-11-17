# BSM Worker App — Android WebView (Expo / Android Studio)

The worker app is a WebView around the live web app. Workers sign in at
`https://hrbsm.xyz/auth`; accounts that only have the **employee** role land on
`/my-portal`, an app-like screen with a bottom tab bar:
Home · Attendance · Leave · Payslips · Profile.

| Tab | Shows |
| --- | --- |
| Home | Today's attendance, work permit countdown, this month's days/hours/OT, leave taken, latest net pay, documents to renew, Apply for leave |
| Attendance | Month picker, daily in/out, normal hours + OT, monthly totals (read-only) |
| Leave | Apply (type, dates, reason) and status of every request |
| Payslips | Monthly breakdown and Download payslip (PDF) |
| Profile | Personal, work, pass/passport, bank, documents (View); Edit my details sends changes to HR |

## 1. Expo (React Native)

    npx create-expo-app bsm-worker && cd bsm-worker
    npx expo install react-native-webview expo-file-system expo-sharing

`App.tsx`:

```tsx
import { useRef, useEffect } from "react";
import { BackHandler, SafeAreaView, StatusBar } from "react-native";
import { WebView } from "react-native-webview";

const START = "https://hrbsm.xyz/my-portal";

export default function App() {
  const ref = useRef<WebView>(null);
  const canBack = useRef(false);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canBack.current) { ref.current?.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, []);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1424" }}>
      <StatusBar barStyle="light-content" />
      <WebView
        ref={ref}
        source={{ uri: START }}
        domStorageEnabled            // keeps the sign-in session
        javaScriptEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowFileAccess
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback   // selfie punch camera
        setSupportMultipleWindows={false}
        pullToRefreshEnabled
        onNavigationStateChange={(s) => { canBack.current = s.canGoBack; }}
      />
    </SafeAreaView>
  );
}
```

`app.json` → `android.permissions`: `["CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]`
(camera for selfie punch, location for GPS punch). Build: `npx eas build -p android`.

## 2. Android Studio (Kotlin)

`AndroidManifest.xml`: `INTERNET`, `CAMERA`, `ACCESS_FINE_LOCATION`.

```kotlin
webView.settings.apply {
  javaScriptEnabled = true
  domStorageEnabled = true          // sign-in session lives in localStorage
  allowFileAccess = true
  mediaPlaybackRequiresUserGesture = false
  setGeolocationEnabled(true)
}
CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
webView.webChromeClient = object : WebChromeClient() {
  override fun onPermissionRequest(r: PermissionRequest) = r.grant(r.resources)
  override fun onGeolocationPermissionsShowPrompt(o: String, c: GeolocationPermissions.Callback) = c.invoke(o, true, false)
  override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
    filePathCallback = cb; fileChooser.launch(p.createIntent()); return true   // document / MC upload
  }
}
webView.setDownloadListener { url, _, cd, mime, _ ->
  // Payslip PDFs are created in the page as blob: URLs; handle via a JS bridge or
  // let DownloadManager save http(s) URLs:
  if (url.startsWith("http")) {
    val req = DownloadManager.Request(Uri.parse(url)).setMimeType(mime)
      .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
      .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, cd, mime))
    getSystemService(DownloadManager::class.java).enqueue(req)
  }
}
onBackPressedDispatcher.addCallback(this) { if (webView.canGoBack()) webView.goBack() else finish() }
webView.loadUrl("https://hrbsm.xyz/my-portal")
```

Tip: for payslip downloads inside WebView, the simplest reliable path is the
API `GET /api/public/v1/payroll/:id/payslip` (real PDF over https), which
DownloadManager can save — add the `Authorization` header with the session token.

## 3. Accounts

HR creates the worker record with the worker's email, then gives that login
the **Employee** role (Users page). The worker signs in once; the session stays
in the WebView until they tap Sign out (top-right).

## 4. API (optional, for native screens later)

Full list: `docs/MOBILE_API.md`. Postman: `docs/worker-api.postman_collection.json`
(set `email` / `password`, run **Sign in** first — it stores `token`).
