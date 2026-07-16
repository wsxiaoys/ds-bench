# capacitor-stringkit

A standalone Capacitor v8 web plugin providing string manipulation utilities: `echo`, `reverse`, and `slugify`.

## Install

```bash
npm install capacitor-stringkit
```

## Usage

```ts
import { StringKit } from 'capacitor-stringkit';

const { value } = await StringKit.echo({ value: 'hello' });
// value === 'hello'

const { value: reversed } = await StringKit.reverse({ value: 'abcde' });
// reversed === 'edcba'

const { slug } = await StringKit.slugify({ value: '  Hello, World! 123 ' });
// slug === 'hello-world-123'
```

The plugin is a **web-only** implementation; no native Android or iOS code is shipped.

## Build

```bash
npm install
npm run build
```

Outputs:

- `dist/esm/` — ESM build with TypeScript declarations
- `dist/plugin.cjs.js` — CommonJS bundle
