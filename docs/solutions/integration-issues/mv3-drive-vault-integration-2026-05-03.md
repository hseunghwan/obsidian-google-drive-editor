---
title: MV3 Drive vault integrations cannot rely on remote Picker code or drive.file traversal
date: 2026-05-03
category: docs/solutions/integration-issues
module: Google Drive extension integration
problem_type: integration_issue
component: authentication
symptoms:
  - "Extension page folder selection fails when it depends on remote Google Picker scripts"
  - "Existing Drive vault traversal returns empty or partial results with drive.file-only consent"
  - "Save failures before content upload can report draft preservation without writing a draft"
root_cause: scope_issue
resolution_type: code_fix
severity: high
tags: [chrome-extension, manifest-v3, google-drive, oauth, draft-recovery]
---

# MV3 Drive vault integrations cannot rely on remote Picker code or drive.file traversal

## Problem
The MVP originally treated Google Picker and `drive.file` as if they could open an existing Drive folder as a full Obsidian vault from a Manifest V3 extension page. Review showed that this would fail in the real extension flow before users could reliably select, list, edit, or recover files.

## Symptoms
- `loadPickerApi()` depended on `gapi.load(...)`, but no packaged `gapi` script existed in the extension bundle.
- The OAuth scope was `https://www.googleapis.com/auth/drive.file`, while the loader recursively called `files.list` for an existing folder.
- `DriveVaultAdapter.saveFile()` only saved drafts after `updateText()` failures; `getMetadata()` failures happened before the draft-preserving `try`.
- Preserved drafts were written but never checked when reopening a file.

## What Didn't Work
- Keeping the official Google Picker script in the extension page. Manifest V3 extension pages execute packaged scripts, so a remote Picker runtime is not a safe core dependency.
- Assuming `drive.file` alone would expose any arbitrary existing folder vault. It does not grant blanket recursive access to arbitrary descendants unless the app has been granted access to those files or folders.
- Treating tests that covered only upload failure as enough for draft safety. Metadata preflight, conflict detection, and successful recovery cleanup need their own assertions.

## Solution
Use an MV3-compatible folder selection boundary and make the Drive consent model explicit.

Security follow-up: the default scope was narrowed back to `drive.file` after CSO review so a compromised extension token cannot manage the user's entire Drive by default. That makes arbitrary existing vault-folder traversal a known live-test risk; widen to full Drive scope only after an explicit security review and user-consent copy update.

```ts
export const driveScopes = ['https://www.googleapis.com/auth/drive.file'] as const;
```

The folder selection implementation now avoids remote code and opens a local Drive folder explorer backed by `files.list`:

```ts
export class BrowserGooglePickerClient implements GooglePickerClient {
  pickVaultFolder(accessToken: string): Promise<PickedFolder> {
    return new DriveFolderExplorer(accessToken, this.messages).open();
  }
}
```

The save adapter now wraps metadata preflight and upload in one draft-preserving pipeline, while avoiding double-draft writes for expected remote conflicts:

```ts
try {
  const metadata = await this.drive.getMetadata(fileId);
  if (metadata.modifiedTime > expectedModifiedTime) {
    await this.saveDraft(vaultRootId, fileId, content, expectedModifiedTime, 'RemoteChanged');
    throw new VaultError('RemoteChanged', 'Remote file changed before save.');
  }

  const updated = await this.drive.updateText(fileId, content);
  await this.drafts.deleteDraft(vaultRootId, fileId);
  return { fileId: updated.id, modifiedTime: updated.modifiedTime };
} catch (error) {
  if (isVaultError(error, 'RemoteChanged')) {
    throw error;
  }
  await this.saveDraft(vaultRootId, fileId, content, expectedModifiedTime, 'NetworkFailed');
  throw error;
}
```

`loadDriveWorkspace()` checks `DraftStore.getDraft()` before downloading Drive content so saved local edits are visible on reopen.

## Why This Works
The folder selection path no longer depends on a remote JavaScript runtime from an extension page. The OAuth scope now matches the safer default security model: Drive access is limited to files and folders opened or created by the app. Draft persistence now covers every failed save path that can lose local edits, including metadata preflight failures.

## Prevention
- Check Manifest V3 remote hosted code restrictions before choosing browser SDKs for extension pages.
- Match OAuth scope to the data model and threat model. Existing arbitrary folder vault traversal may need broader Drive access than per-file access, but that broader scope must be a deliberate security decision.
- Add tests for every phase of a save pipeline: metadata preflight failure, remote conflict, upload failure, successful cleanup, and reopen recovery.
- Keep manual check docs honest about credentials and live Drive testing gaps.

## Related Issues
- Code review finding on `src/integrations/google/googlePicker.ts` remote Picker dependency.
- Code review finding on `public/manifest.json` and `src/app/driveWorkspaceLoader.ts` Drive scope mismatch.
- Code review finding on `src/integrations/google/driveVaultAdapter.ts` metadata preflight draft loss.
