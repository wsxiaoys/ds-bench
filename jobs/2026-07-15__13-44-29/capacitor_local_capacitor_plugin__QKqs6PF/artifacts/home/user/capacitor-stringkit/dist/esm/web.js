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
        const lower = options.value.toLowerCase();
        const replaced = lower.replace(/[^a-z0-9]+/g, '-');
        const slug = replaced.replace(/^-+|-+$/g, '');
        return { slug };
    }
}
