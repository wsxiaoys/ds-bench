'use strict';

var core = require('@capacitor/core');

const StringKit = core.registerPlugin('StringKit', {
    web: async () => {
        const { StringKitWeb } = await Promise.resolve().then(function () { return web; });
        return new StringKitWeb();
    },
});

/**
 * Web implementation of the {@link StringKitPlugin}.
 */
class StringKitWeb extends core.WebPlugin {
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

var web = /*#__PURE__*/Object.freeze({
    __proto__: null,
    StringKitWeb: StringKitWeb
});

exports.StringKit = StringKit;
//# sourceMappingURL=plugin.cjs.js.map
