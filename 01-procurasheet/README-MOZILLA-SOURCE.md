# Mozilla source build instructions — ProcuraSheet v1.1.3

This source package reproduces the Firefox add-on submitted to addons.mozilla.org.

## Build environment

Reference environment used by the ProcuraSheet release workflow:

- Operating system: Ubuntu Linux x86_64 (GitHub Actions `ubuntu-latest`)
- Node.js: 22.x
- npm: the npm version bundled with Node.js 22
- zip: Info-ZIP 3.0 or a compatible standard `zip` command

No third-party npm packages are required. `package.json` has no runtime or development dependencies, so `npm install` is not required.

Example setup on Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y zip
# Install Node.js 22.x using your preferred Node distribution or nvm.
node --version
npm --version
zip -v | head -n 2
```

## What the build does

ProcuraSheet is not transpiled, minified, concatenated, bundled with webpack, or generated from templates.

The build script `scripts/build-browsers.cjs` uses only Node.js built-in modules. It:

1. Copies the readable extension source files into browser-specific output folders.
2. Copies the base Manifest V3 file.
3. For Firefox only, removes the Chromium-only `minimum_chrome_version` key.
4. Adds the stable Firefox Gecko extension ID and Firefox data-collection declaration.
5. Writes the resulting Firefox manifest to `dist/firefox/manifest.json`.

All JavaScript, HTML and CSS shipped in the Firefox add-on remain readable source files.

## Build the Firefox add-on

From the root of this source package:

```bash
npm run build:browsers
```

The Firefox extension files will be created in:

```text
dist/firefox/
```

To create the ZIP submitted to AMO:

```bash
VERSION=$(node -p "require('./manifest.json').version")
(
  cd dist/firefox
  zip -qr "../../ProcuraSheet-Firefox-v${VERSION}.zip" .
)
```

The resulting file is:

```text
ProcuraSheet-Firefox-v1.1.3.zip
```

## Files intentionally excluded from the Firefox add-on

The submitted Firefox package does not include:

- `billing/` — server-side Paystack billing service
- `tests/` — automated tests
- `scripts/` — build tooling
- documentation files
- any generated `dist/` or `release/` folders

These are not needed at runtime inside Firefox.

## Verify the package contents

```bash
unzip -l ProcuraSheet-Firefox-v1.1.3.zip
```

The archive should contain readable extension files such as:

- `manifest.json`
- `popup.html`
- `popup.js`
- `index.html`
- `styles.css`
- `app.js`
- `lib/`
- `assets/`
- `samples/`

It should not contain `billing/`, `tests/`, or `scripts/`.

## Automated validation

The repository release workflow runs:

```bash
npm test
npm run check
npm run build:browsers
```

It then builds and validates the Firefox ZIP and the other browser release ZIPs.
