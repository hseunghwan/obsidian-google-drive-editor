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
