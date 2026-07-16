'use strict';

var core = require('@capacitor/core');

const StringKit = core.registerPlugin('StringKit', {
    web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.StringKitWeb()),
});

class StringKitWeb extends core.WebPlugin {
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

var web = /*#__PURE__*/Object.freeze({
    __proto__: null,
    StringKitWeb: StringKitWeb
});

exports.StringKit = StringKit;
