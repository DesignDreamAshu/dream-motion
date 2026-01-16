import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile: resolve(root, 'dist/runtime.js'),
  bundle: true,
  format: 'iife',
  globalName: 'DreamMotionRuntime',
  sourcemap: true,
  minify: false,
  platform: 'browser',
  target: ['es2020']
});
