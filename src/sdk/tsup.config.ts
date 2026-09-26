import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/sdk/index.ts', react: 'src/sdk/react.ts' },
  outDir: 'src/sdk/dist',
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react'],
})
