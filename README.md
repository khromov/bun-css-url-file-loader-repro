# Bun repro: CSS `url()` ignores the `file` loader

`Bun.build` always base64-inlines `url()` references in bundled CSS. The `file` loader, `naming.asset`, and `publicPath` work as documented for JS-imported assets but are ignored for CSS — and plugins can't work around it either.

## Run

```sh
bun repro.ts
```

Reproduces on stable **1.3.14** and canary **1.4.0** (identical output).

## Output (Bun 1.3.14)

```
--- loader-map
    expected: url(/assets/demo-<hash>.woff2) + 1 emitted asset
    actual:   url("data:font/woff2;base64,BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcH… [12030 chars]
    assets emitted: 0

--- plugin-onload-file
    expected: url(/assets/demo-<hash>.woff2) + 1 emitted asset
    actual:   url("data:font/woff2;base64,BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcH… [12030 chars]
    assets emitted: 0

--- plugin-onresolve-external
    expected: url(/assets/rewritten.woff2)
    actual:   url("./fonts/demo.woff2")
    assets emitted: 0

--- js-control (same options, JS import)
    resolves to: "/assets/demo-rhmp9rsv.woff2"
    assets emitted: 1
```

## The three cases

1. **`loader: { '.woff2': 'file' }`** — ignored for CSS `url()`; the font inlines as a `data:` URI anyway.
2. **Plugin `onLoad` returning `loader: 'file'`** — the returned contents are inlined anyway.
3. **Plugin `onResolve` returning `{ path, external: true }`** — inlining stops, but the printed CSS keeps the *original* specifier; the returned path is discarded.

The JS control at the end uses the exact same options and behaves as documented: the asset is emitted to `outdir` and the import resolves to `publicPath` + asset name.

Why it matters: any stylesheet pulling in fonts (e.g. `@fontsource/*`) balloons from a few KB to hundreds of KB with no way to opt out.
