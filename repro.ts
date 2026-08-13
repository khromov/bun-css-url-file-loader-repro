import fs from 'node:fs';
import path from 'node:path';

const dir = import.meta.dir;
fs.rmSync(path.join(dir, 'out'), { recursive: true, force: true });

// A fake 9 kB "font" so the repo stays binary-free — its contents don't matter for bundling.
fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
fs.writeFileSync(path.join(dir, 'fonts', 'demo.woff2'), new Uint8Array(9000).fill(7));

console.log(`Bun ${Bun.version}\n`);

async function build(label: string, expected: string, opts: Partial<Parameters<typeof Bun.build>[0]> = {}) {
  const result = await Bun.build({
    entrypoints: [path.join(dir, 'app.css')],
    outdir: path.join(dir, 'out', label),
    naming: { asset: '[name]-[hash].[ext]' },
    publicPath: '/assets/',
    throw: false,
    ...opts,
  });
  const css = result.outputs.find((o) => o.path.endsWith('.css'));
  const text = css ? fs.readFileSync(css.path, 'utf8') : '(build failed)';
  const src = text.match(/url\([^)]*\)/)?.[0] ?? '(no url() found)';
  const shown = src.length > 60 ? `${src.slice(0, 60)}… [${src.length} chars]` : src;
  console.log(`--- ${label}`);
  console.log(`    expected: ${expected}`);
  console.log(`    actual:   ${shown}`);
  console.log(`    assets emitted: ${result.outputs.filter((o) => o.kind === 'asset' && !o.path.endsWith('.css')).length}\n`);
}

// 1. The documented way: loader map + naming.asset + publicPath.
//    Works for JS-imported assets, ignored for CSS url() — the font inlines as base64.
await build('loader-map', 'url(/assets/demo-<hash>.woff2) + 1 emitted asset', {
  loader: { '.woff2': 'file' },
});

// 2. Plugin onLoad returning loader: 'file' — the returned contents are inlined anyway.
await build('plugin-onload-file', 'url(/assets/demo-<hash>.woff2) + 1 emitted asset', {
  plugins: [
    {
      name: 'onload-file',
      setup(b) {
        b.onLoad({ filter: /\.woff2$/ }, async (args) => ({
          contents: await Bun.file(args.path).bytes(),
          loader: 'file',
        }));
      },
    },
  ],
});

// 3. Plugin onResolve returning an external rewritten path — inlining stops,
//    but the printed CSS keeps the ORIGINAL specifier; the returned path is discarded.
await build('plugin-onresolve-external', 'url(/assets/rewritten.woff2)', {
  plugins: [
    {
      name: 'onresolve-external',
      setup(b) {
        b.onResolve({ filter: /\.woff2$/ }, () => ({
          path: '/assets/rewritten.woff2',
          external: true,
        }));
      },
    },
  ],
});

// 4. Control: the exact same options work for a JS entrypoint importing the font.
const js = await Bun.build({
  entrypoints: [path.join(dir, 'app.ts')],
  outdir: path.join(dir, 'out', 'js-control'),
  naming: { asset: '[name]-[hash].[ext]' },
  publicPath: '/assets/',
  loader: { '.woff2': 'file' },
  throw: false,
});
const jsText = fs.readFileSync(js.outputs.find((o) => o.path.endsWith('.js'))!.path, 'utf8');
console.log(`--- js-control (same options, JS import)`);
console.log(`    resolves to: ${jsText.match(/"[^"]*\.woff2"/)?.[0] ?? '(not found)'}`);
console.log(`    assets emitted: ${js.outputs.filter((o) => o.kind === 'asset').length}`);
