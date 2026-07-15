import type { CapacitorConfig } from '@capacitor/cli';

const isDevelopment = process.env.NODE_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'com.example.envapp',
  appName: 'Env Aware App',
  webDir: 'dist',
  ...(isDevelopment
    ? {
        server: {
          url: 'http://localhost:5173',
          cleartext: true,
        },
        android: {
          allowMixedContent: true,
        },
      }
    : {}),
};

export default config;