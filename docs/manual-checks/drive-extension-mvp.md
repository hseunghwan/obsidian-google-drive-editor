# Drive Extension MVP Manual Checks

## Google Cloud setup

1. Create a Google Cloud project for local extension testing.
2. Enable Google Drive API.
3. Create a Chrome Extension OAuth client.
4. Load `dist/` once as an unpacked extension and copy the generated extension id.
5. Add the unpacked extension id to the OAuth client configuration.
6. Set `VITE_GOOGLE_OAUTH_CLIENT_ID=<Chrome Extension OAuth client id>` in `.env.local`.
7. Run `npm run build` again so `dist/manifest.json` receives the configured OAuth client id.
8. Reload the unpacked extension in `chrome://extensions`.
9. Prepare a test vault folder that is visible from My Drive and inside the app's `drive.file` access boundary.

## Manual Drive checks

1. Run `npm run build`.
2. Load `dist/` as an unpacked extension in Chrome.
3. Click the extension icon.
4. Authenticate with the test Google account.
5. Select a test Drive folder in the extension Drive folder explorer.
6. Open `Home.md`.
7. Edit and save `Home.md`.
8. Confirm the Drive file content changed in Google Drive.
9. Edit `Home.md` outside the extension.
10. Save from the extension and confirm the conflict warning appears before overwrite.
11. Force network failure and confirm local draft recovery appears when reopening the file.

## Chrome Web Store package checks

1. Set `VITE_GOOGLE_OAUTH_CLIENT_ID=<Chrome Extension OAuth client id>`.
2. Run `npm run package:chrome`.
3. Confirm the command creates `release/obsidian-google-drive-editor-0.1.0-chrome.zip`.
4. Confirm `dist/manifest.json` contains the real OAuth client id and no `REPLACE_WITH` placeholder.
5. Upload the zip in the Chrome Web Store Developer Dashboard.
6. Record the submitted version, review status, and any policy feedback.

Do not configure Google Workspace Marketplace or Drive UI "Open with" for this release. That is a separate Drive app integration path.

## Local environment

The OAuth client id for `chrome.identity.getAuthToken` is configured with `VITE_GOOGLE_OAUTH_CLIENT_ID` in `.env.local`. `npm run build` injects that value into `dist/manifest.json` under `oauth2.client_id`. Do not commit a real OAuth client id to `public/manifest.json`.

This MVP does not load the remote Google Picker JavaScript API from an extension page. Manifest V3 extension pages execute packaged scripts only, so folder selection uses a local Drive folder explorer backed by the Drive REST API. The requested OAuth scope is `https://www.googleapis.com/auth/drive` because an existing Obsidian vault requires recursive listing, reading, and writing of files that were not created by this app. `drive.file` is not sufficient for arbitrary existing vault content and can fail with `appNotAuthorizedToFile`.

## Result - 2026-05-03

- Automated verification: `npm run typecheck`, `npm test`, `npm run build`.
- Unpacked extension load: credential 준비 뒤 Chrome 결과를 여기에 기록한다.
- OAuth/live Drive test: credential 준비 뒤 Google Cloud configuration과 결과를 여기에 기록한다.
- Chrome Web Store package: credential 준비 뒤 `npm run package:chrome` 결과를 여기에 기록한다.
- 알려진 release blocker: OAuth client id와 test Drive folder가 설정될 때까지 live Drive save는 막혀 있다.
