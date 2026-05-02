# Drive Extension MVP Manual Checks

## Google Cloud setup

1. Create a Google Cloud project for local extension testing.
2. Enable Google Drive API and Google Picker API.
3. Create a Chrome Extension OAuth client.
4. Load `dist/` once as an unpacked extension and copy the generated extension id.
5. Add the unpacked extension id to the OAuth client configuration.
6. Create an API key restricted to Google Picker API during development.
7. Configure the local OAuth client id, Picker API key, and Picker app id before testing.

## Manual Drive checks

1. Run `npm run build`.
2. Load `dist/` as an unpacked extension in Chrome.
3. Click the extension icon.
4. Authenticate with the test Google account.
5. Select a test Drive folder through Picker.
6. Open `Home.md`.
7. Edit and save `Home.md`.
8. Confirm the Drive file content changed in Google Drive.
9. Edit `Home.md` outside the extension.
10. Save from the extension and confirm the conflict warning appears before overwrite.
11. Force network failure and confirm local draft recovery appears when reopening the file.

## Local environment

`VITE_GOOGLE_PICKER_DEVELOPER_KEY` and `VITE_GOOGLE_PICKER_APP_ID` are public browser configuration values for local testing. The OAuth client id for `chrome.identity.getAuthToken` must be configured in `public/manifest.json` under `oauth2.client_id` after creating the Chrome Extension OAuth client in Google Cloud Console.

## Result - 2026-05-03

- Automated verification: `npm run typecheck`, `npm test`, `npm run build`.
- Unpacked extension load: credential 준비 뒤 Chrome 결과를 여기에 기록한다.
- OAuth/Picker live Drive test: credential 준비 뒤 Google Cloud configuration과 결과를 여기에 기록한다.
- 알려진 release blocker: OAuth client id, Picker API key, test Drive folder가 설정될 때까지 live Drive save는 막혀 있다.
