package com.example.codescanner;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setBackgroundDrawableResource(android.R.color.transparent);

        WebView webView = getBridge().getWebView();
        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        View parent = (View) webView.getParent();
        if (parent instanceof ViewGroup) {
            parent.setBackgroundColor(Color.TRANSPARENT);
        }
    }
}
