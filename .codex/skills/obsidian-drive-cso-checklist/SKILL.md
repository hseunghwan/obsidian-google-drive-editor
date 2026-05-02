---
name: obsidian-drive-cso-checklist
description: Use when checking this workspace for security risks, rerunning the gstack /cso review, or preparing implementation guardrails for the Drive-backed Obsidian editor.
---

# Obsidian Drive CSO Checklist

## Purpose

Use this project-local skill to repeat the security review for this workspace and keep the results easy for the user to scan. Prefer `gstack /cso` when available; otherwise perform an equivalent read-only audit with shell searches and repository inspection.

## Scope

- Workspace: `/Users/cycle1223/workspace/obsidian-google-drive-editor`
- Product shape: Chrome Manifest V3 extension for a Drive-backed Obsidian-like markdown editor.
- Planned sensitive surfaces: Chrome Identity, Google Picker, Google Drive API, local draft storage, markdown rendering, extension permissions.

## Daily Review Checklist

Report only verified findings with high confidence. If the repo is still design-only, say that runtime exploitability cannot be validated yet.

- [ ] Confirm repository state with `git status --short`.
- [ ] Identify app, dependency, CI, environment, Docker, and IaC files.
- [ ] Scan current files for hardcoded secrets, API keys, OAuth secrets, tokens, private keys, and passwords.
- [ ] Scan git history for secrets outside markdown/planning documents.
- [ ] Inspect dependency manifests and lockfiles when present.
- [ ] Inspect CI/CD workflows when present.
- [ ] Inspect extension manifest permissions when present.
- [ ] Inspect OAuth scopes and confirm Google Drive scope remains least-privilege, preferably `drive.file`.
- [ ] Inspect Drive write/conflict handling for overwrite risk and local draft preservation.
- [ ] Inspect markdown preview/rendering for raw HTML, sanitizer usage, and XSS exposure.
- [ ] Inspect Chrome storage/IndexedDB usage for token or sensitive document leakage.
- [ ] Inspect Google Picker/API config and confirm public keys are appropriately restricted in Google Cloud Console.
- [ ] Summarize results as a user-readable checklist with Critical/High/Medium/Low sections.
- [ ] Include the standard caveat that this is an AI-assisted first-pass review, not a replacement for professional security audit or penetration testing.

## Baseline From 2026-05-03

- gstack installed at `/Users/cycle1223/.gstack/repos/gstack`.
- gstack version: `1.26.0.0`.
- gstack commit: `bf65487`.
- Codex skill path: `/Users/cycle1223/.codex/skills/gstack-cso/SKILL.md`.
- Current workspace had only planning/spec documents and no implemented app code.
- No actual secrets were found in current files or non-markdown git history.
- No dependency manifest, lockfile, CI workflow, Docker, IaC, env file, or repo-local agent skill directory was present.
- No high-confidence daily-mode security finding was reported.

## Implementation Guardrails

Apply these before or during first implementation:

- [ ] Add `.gitignore` before adding app code: `.env*`, `!.env.example`, `.gstack/`, `node_modules/`, `dist/`, `coverage/`.
- [ ] Keep OAuth scope at `https://www.googleapis.com/auth/drive.file` unless a broader scope is justified and reviewed.
- [ ] Never put an OAuth client secret in the browser extension or repository.
- [ ] Treat Google Picker developer key and app ID as public config, but restrict them in Google Cloud Console.
- [ ] Keep Manifest V3 permissions and `host_permissions` narrow; avoid `<all_urls>`.
- [ ] Preserve local drafts before Drive overwrite or conflict resolution.
- [ ] Sanitize rendered markdown if preview supports HTML.
- [ ] Add lint, typecheck, test, and dependency audit gates when CI exists.
