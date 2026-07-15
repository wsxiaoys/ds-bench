import { WebPlugin } from '@capacitor/core';
export class StringKitWeb extends WebPlugin {
    async echo(options) {
        return { value: options.value };
    }
    async reverse(options) {
        const reversed = options.value.split('').reverse().join('');
        return { value: reversed };
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