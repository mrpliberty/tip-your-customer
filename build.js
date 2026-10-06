import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('docs', { recursive: true });
await build({ entryPoints: ['src/app.js'], outfile: 'docs/app.js', bundle: true, platform: 'browser', format: 'iife', minify: true, target: 'es2020' });
await Promise.all(['index.html', 'styles.css', 'qr.css'].map(file => copyFile(`public/${file}`, `docs/${file}`)));
console.log('GitHub Pages site built in docs/');
