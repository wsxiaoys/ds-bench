import { registerPlugin } from '@capacitor/core';

import type { StringKitPlugin } from './definitions';

const StringKit = registerPlugin<StringKitPlugin>('StringKit', {
  web: () => import('./web').then((m) => new m.StringKitWeb()),
});

export * from './definitions';
export { StringKit };
