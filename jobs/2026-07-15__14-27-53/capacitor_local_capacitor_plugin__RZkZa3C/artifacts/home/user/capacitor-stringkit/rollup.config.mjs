import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/plugin.cjs.js',
    format: 'cjs',
    sourcemap: false,
    inlineDynamicImports: true,
    exports: 'named',
  },
  external: ['@capacitor/core'],
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: './tsconfig.rollup.json',
    }),
  ],
};
