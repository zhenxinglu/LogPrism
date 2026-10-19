---
name: publish-release
description: >-
  Step-by-step workflow for bumping versions, building release artifacts,
  and publishing new releases of LogPrism to GitHub with auto-update support.
  Use when the user asks to release, publish, package, or deploy a new version.
---

# Publish Release Workflow for LogPrism

Follow this structured workflow to release a new version of LogPrism and ensure auto-updates work reliably for users.

## 1. Pre-release Check & Version Bump

1. **Check Working Tree**: Ensure there are no unexpected uncommitted modifications:
   ```bash
   git status
   ```
2. **Determine New Version**: Check the current version in [package.json](../../package.json) and decide the next semantic version (`patch`, `minor`, `major`, or exact version string).
3. **Bump Version**:
   ```bash
   npm version <new-version> --no-git-tag-version
   ```
   Or edit `"version"` in [package.json](../../package.json).
4. **Sync Lockfile**:
   ```bash
   npm install
   ```

## 2. Update Release Documentation

1. **Update Release Notes**: Add the new release section in [RELEASE_NOTES.md](../../RELEASE_NOTES.md):
   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD

   ### 🚀 New Features & Enhancements
   - ...

   ### 🐛 Bug Fixes & Reliability
   - ...
   ```
2. **Update Features**: Update [feature.md](../../feature.md) if new features were implemented or improved.

## 3. Build & Package Distribution Artifacts

1. Run the build command for the target platform:
   ```bash
   # Windows (NSIS installer + Portable)
   npm run build:win
   ```
2. Verify output files in the `dist/` directory:
   - `latest.yml`
   - `log-prism-X.Y.Z-setup.exe`
   - `log-prism-X.Y.Z-setup.exe.blockmap`
   - `LogPrism X.Y.Z.exe`

## 4. Git Commit & Tag

1. Stage and commit changes:
   ```bash
   git add package.json package-lock.json RELEASE_NOTES.md feature.md
   git commit -m "chore(release): vX.Y.Z"
   ```
2. Create Git tag:
   ```bash
   git tag vX.Y.Z
   ```
3. Push to remote:
   ```bash
   git push origin <branch> --tags
   ```

## 5. GitHub Release & Publishing

You can publish the release and upload the assets using either automated methods or manual upload:

### Option A: Automated Publishing via `electron-builder` (Recommended)

When a GitHub Personal Access Token (with `repo` scope) is available, `electron-builder` can automatically create the release, upload all binaries and metadata, and publish it:

1. Set the GitHub token environment variable:
   ```powershell
   # PowerShell
   $env:GH_TOKEN = "your_github_personal_access_token"
   ```
   *(Or set `export GH_TOKEN=...` in Bash / set it in system environment variables)*

2. Build and automatically publish to GitHub:
   ```powershell
   npm run build && npx electron-builder --win --publish always
   ```
   > **Note**: `electron-builder` reads the `publish` block from `electron-builder.yml` and uploads `latest.yml`, the `.exe` installer, `.blockmap`, and portable `.exe` automatically.

---

### Option B: Automated Publishing via GitHub CLI (`gh`)

If the GitHub CLI (`gh`) is installed and authenticated (`gh auth login`):

```powershell
gh release create vX.Y.Z `
  dist/latest.yml `
  dist/log-prism-X.Y.Z-setup.exe `
  dist/log-prism-X.Y.Z-setup.exe.blockmap `
  "dist/LogPrism X.Y.Z.exe" `
  --title "vX.Y.Z" `
  --notes-file RELEASE_NOTES.md
```

---

### Option C: Manual Upload via GitHub Web UI

1. Open `https://github.com/zhenxinglu/LogPrism/releases/new`.
2. Choose tag `vX.Y.Z`, set Title to `vX.Y.Z`, and copy content from [RELEASE_NOTES.md](../../RELEASE_NOTES.md) into the description.
3. In the **"Attach binaries by dropping them here"** section, upload:
   - **`dist/latest.yml`** *(Mandatory for auto-update)*
   - **`dist/log-prism-X.Y.Z-setup.exe`** *(Mandatory installer)*
   - **`dist/log-prism-X.Y.Z-setup.exe.blockmap`** *(Mandatory / Recommended for differential updates)*
   - **`dist/LogPrism X.Y.Z.exe`** *(Portable version, optional but recommended)*
4. Ensure **"Set as the latest release"** is checked and **"Save draft"** is NOT used.
5. Click **"Publish release"**.

