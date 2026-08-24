package com.superme.chatgptultra;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
  private static final String BACKEND_URL = "https://YOUR-BACKEND.example.com";

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    WebView web = new WebView(this);
    web.setWebViewClient(new WebViewClient());
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.loadUrl("file:///android_asset/index.html?api=" + BACKEND_URL);
    setContentView(web);
  }
}
