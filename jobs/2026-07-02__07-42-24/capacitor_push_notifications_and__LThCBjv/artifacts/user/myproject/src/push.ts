import { PushNotifications } from '@capacitor/push-notifications';

export async function initPush(): Promise<void> {
  // 1. Register listeners for all four events first
  await PushNotifications.addListener('registration', (token) => {
    console.log('Push registration success, token: ' + token.value);
  });

  await PushNotifications.addListener('registrationError', (error) => {
    console.error('Push registration error: ', error);
  });

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received: ', notification);
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push notification action performed: ', notification);
  });

  // 2. Request permission and register if granted
  const permissionStatus = await PushNotifications.requestPermissions();

  if (permissionStatus.receive === 'granted') {
    await PushNotifications.register();
  } else {
    console.warn('Push notification permission not granted: ' + permissionStatus.receive);
  }
}
