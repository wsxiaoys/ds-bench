import { registerPlugin } from '@capacitor/core';
const StringKit = registerPlugin('StringKit', {
    web: () => import('./web').then((m) => new m.StringKitWeb()),
});
export * from './definitions';
export { StringKit };
//# sourceMappingURL=index.js.map