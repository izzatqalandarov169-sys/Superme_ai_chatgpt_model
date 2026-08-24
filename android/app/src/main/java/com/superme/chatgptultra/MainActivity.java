package com.superme.chatgptultra;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    WebView web = new WebView(this);
    web.setWebViewClient(new WebViewClient());
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.loadUrl("file:///android_asset/index.html");
    setContentView(web);
  }
}
