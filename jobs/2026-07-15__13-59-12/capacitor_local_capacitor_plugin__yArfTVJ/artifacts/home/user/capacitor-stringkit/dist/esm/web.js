import { WebPlugin } from '@capacitor/core';
/**
 * Web implementation of the {@link StringKitPlugin}.
 */
export class StringKitWeb extends WebPlugin {
    async echo(options) {
        return { value: options.value };
    }
    async reverse(options) {
        return { value: options.value.split('').reverse().join('') };
    }
    async slugify(options) {
        const slug = options.value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return { slug };
    }
}
//# sourceMappingURL=web.js.map