import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Wires up the @capacitor/push-notifications runtime for Android FCM (HTTP v1).
 *
 * Order matters (per the plugin docs):
 *   1. Register listeners for every event the app cares about.
 *   2. Ask the OS for permission via `requestPermissions()`.
 *   3. Only when the returned `receive` value is `'granted'`, call `register()`.
 */
export function initPush(): void {
  // 1. Listeners -------------------------------------------------------------
  PushNotifications.addListener('registration', (token) => {
    // TODO: forward `token.value` to your backend so it can target this device.
    console.info('[push] FCM registration token:', token.value);
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.error('[push] FCM registration failed:', JSON.stringify(error));
  });

  PushNotifications.addListener(
    'pushNotificationReceived',
    (notification) => {
      // App is in the foreground — show an in-app banner/toast.
      console.info(
        '[push] Notification received in foreground:',
        JSON.stringify(notification)
      );
    }
  );

  PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action) => {
      // User tapped the system notification — deep-link as needed.
      console.info(
        '[push] Notification action performed:',
        JSON.stringify(action)
      );
    }
  );

  // 2. Permission gate -------------------------------------------------------
  PushNotifications.requestPermissions().then((result) => {
    // 3. Register only when permission has been granted.
    if (result.receive === 'granted') {
      PushNotifications.register();
    } else {
      console.warn(
        '[push] Notification permission not granted; skipping register().'
      );
    }
  });
}
