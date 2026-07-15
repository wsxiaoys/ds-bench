import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'dist/esm/index.js',
  output: {
    file: 'dist/plugin.cjs.js',
    format: 'cjs',
    sourcemap: true,
    exports: 'named',
    inlineDynamicImports: true,
  },
  external: ['@capacitor/core'],
  plugins: [
    nodeResolve({
      extensions: ['.js', '.ts'],
    }),
    commonjs({
      extensions: ['.ts', '.js'],
    }),
  ],
};