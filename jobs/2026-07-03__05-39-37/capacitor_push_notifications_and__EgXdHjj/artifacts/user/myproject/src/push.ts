import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Initialise Capacitor Push Notifications for Android (FCM).
 *
 * Order of operations follows the official plugin guide:
 *   1. Register listeners for all four notification events.
 *   2. Request permission to receive notifications.
 *   3. Only when permission is `granted`, register with FCM.
 */
export async function initPush(): Promise<void> {
  // 1. Register listeners for all four events BEFORE requesting permission.
  await PushNotifications.addListener('registration', (token) => {
    console.info('Push registration token:', token.value);
  });

  await PushNotifications.addListener('registrationError', (err) => {
    console.error('Push registration error:', err);
  });

  await PushNotifications.addListener(
    'pushNotificationReceived',
    (notification) => {
      console.info('Push notification received:', notification);
    },
  );

  await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action) => {
      console.info('Push notification action performed:', action);
    },
  );

  // 2. Request permission to receive notifications.
  const permStatus = await PushNotifications.requestPermissions();

  // 3. Only register when the `receive` permission is `granted`.
  if (permStatus.receive === 'granted') {
    await PushNotifications.register();
  } else {
    console.warn('Push notification permission not granted; skipping register().');
  }
}