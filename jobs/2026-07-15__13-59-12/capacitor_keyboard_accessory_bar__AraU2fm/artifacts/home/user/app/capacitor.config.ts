import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.example.composer',
  appName: 'Composer',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      // Resize the `body` element when the keyboard appears so relative
      // units (vh) are not affected.
      resize: KeyboardResize.Body,
      // Force the keyboard to use a dark appearance.
      style: KeyboardStyle.Dark,
      // Work around the Android full-screen resize bug so the WebView is
      // resized even when the app is running in full-screen mode.
      resizeOnFullScreen: true,
    },
  },
};

export default config;