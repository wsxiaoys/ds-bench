import { registerPlugin } from '@capacitor/core';
export * from './definitions';
export const StringKit = registerPlugin('StringKit', {
    web: async () => {
        const { StringKitWeb } = await import('./web');
        return new StringKitWeb();
    },
});
//# sourceMappingURL=index.js.map