import { registerPlugin } from '@capacitor/core';

import type { StringKitPlugin } from './definitions';

export * from './definitions';

export const StringKit = registerPlugin<StringKitPlugin>('StringKit', {
  web: async () => {
    const { StringKitWeb } = await import('./web');
    return new StringKitWeb();
  },
});