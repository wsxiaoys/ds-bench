import { PushNotifications } from '@capacitor/push-notifications';

export async function initPush(): Promise<void> {
  // 1. Register listeners for all four events.
  PushNotifications.addListener('registration', (token) => {
    console.log('Push registration success, token:', token.value);
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('Push registration error:', JSON.stringify(err));
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received:', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push notification action performed:', notification);
  });

  // 2. Request permissions; only call register() when the user has granted.
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive === 'granted') {
    await PushNotifications.register();
  }
}
