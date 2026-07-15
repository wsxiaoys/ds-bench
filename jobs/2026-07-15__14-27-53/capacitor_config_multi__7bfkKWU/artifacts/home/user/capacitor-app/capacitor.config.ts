import type { CapacitorConfig } from '@capacitor/cli';

const isDevelopment = process.env.NODE_ENV === 'development';

const config: CapacitorConfig = isDevelopment
  ? {
      appId: 'com.example.envapp',
      appName: 'Env Aware App',
      webDir: 'dist',
      server: {
        url: 'http://localhost:5173',
        cleartext: true,
      },
      android: {
        allowMixedContent: true,
      },
    }
  : {
      appId: 'com.example.envapp',
      appName: 'Env Aware App',
      webDir: 'dist',
    };

export default config;
