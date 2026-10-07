# ProcuraSheet cross-browser releases

ProcuraSheet uses one Manifest V3 source tree and generates browser-specific release directories with `npm run build:browsers`.

## Generated targets

- `dist/chrome` — Chrome Web Store package source
- `dist/edge` — Microsoft Edge Add-ons package source
- `dist/opera` — Opera Add-ons package source
- `dist/firefox` — Mozilla Add-ons (AMO) package source
- `dist/safari` — Safari Web Extension source for Apple's Safari Web Extension Packager

The runtime files are shared. Browser manifests are generated from the root `manifest.json` so plan logic, license activation, billing endpoints, icons and UI do not drift between browsers.

## Manifest differences

Chrome, Edge and Opera keep the Chromium `minimum_chrome_version` setting.

Firefox removes the Chromium-only minimum-version key and adds:

- a stable Gecko extension ID: `procurasheet@procurasheet.onrender.com`
- Firefox's required data-collection declaration
- `authenticationInfo` as optional because paid users may choose to transmit a ProcuraSheet license token for subscription verification

Safari removes the Chromium-only minimum-version key. The generated Safari ZIP is source input for Apple's Safari Web Extension Packager; it is not a signed App Store binary.

## Build locally

```bash
npm run build:browsers
npm test
npm run check
```

## CI release files

GitHub Actions packages these files from the generated directories:

- `ProcuraSheet-Chrome-v<VERSION>.zip`
- `ProcuraSheet-Edge-v<VERSION>.zip`
- `ProcuraSheet-Opera-v<VERSION>.zip`
- `ProcuraSheet-Firefox-v<VERSION>.zip`
- `ProcuraSheet-Safari-WebExtension-v<VERSION>.zip`

The release gate verifies that every ZIP contains `manifest.json` and excludes server code, tests and build scripts.

## Publishing

Chrome: upload the Chrome ZIP to Chrome Web Store.

Edge: upload the Edge ZIP to Microsoft Edge Add-ons / Partner Center.

Opera: upload the Opera ZIP to Opera Add-ons. Brave users can install the Chrome Web Store build, so a separate Brave package is not required.

Firefox: upload the Firefox ZIP to addons.mozilla.org. Keep the Gecko ID stable across every future release.

Safari: upload the Safari Web Extension ZIP to Apple's Safari Web Extension Packager in App Store Connect, or run Apple's packager on macOS/Xcode. Apple still performs the final app packaging, signing and review.

## Release rule

Never hand-edit files inside `dist/`. Update the single source tree and `manifest.json`, then regenerate all browser builds.
