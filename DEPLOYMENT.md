# GitHub Deployment Guide for TimeTracker

This guide will help you deploy TimeTracker as a Windows desktop application using GitHub Releases.

## Prerequisites

1. **GitHub Repository**: Create a GitHub repository for your project
2. **GitHub Personal Access Token**: Required for publishing releases
3. **Git**: Installed and configured on your system

---

## Step 1: Set Up GitHub Repository

### 1.1 Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository named `TimeTracker`
2. Note your GitHub username

### 1.2 Update package.json

Open `package.json` and replace `YOUR_USERNAME` with your actual GitHub username:

```json
"homepage": "https://github.com/YOUR_USERNAME/TimeTracker",
"repository": {
  "type": "git",
  "url": "https://github.com/YOUR_USERNAME/TimeTracker.git"
},
// ...
"publish": {
  "provider": "github",
  "owner": "YOUR_USERNAME",
  "repo": "TimeTracker",
  "releaseType": "release"
}
```

### 1.3 Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/TimeTracker.git
git push -u origin main
```

---

## Step 2: Create GitHub Personal Access Token

### 2.1 Generate Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name: `TimeTracker Release`
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again!)

### 2.2 Add Token to Environment

**Windows:**

1. Open your `.env` file
2. Add the following line:
   ```
   GH_TOKEN=your_github_personal_access_token_here
   ```

**Alternative (System Environment Variable):**

```cmd
setx GH_TOKEN "your_github_personal_access_token_here"
```

> **Note**: Never commit the `.env` file with your actual token to GitHub!

---

## Step 3: Prepare for Build

### 3.1 Update Version Number

Before each release, update the version in `package.json`:

```json
{
  "version": "1.0.0" // Change this (e.g., 1.0.1, 1.1.0, etc.)
}
```

Use semantic versioning:

- **Patch** (1.0.x): Bug fixes
- **Minor** (1.x.0): New features
- **Major** (x.0.0): Breaking changes

### 3.2 Verify .gitignore

Ensure sensitive files are not tracked:

```
.env
dist/
node_modules/
```

---

## Step 4: Build the Application

### 4.1 Production Build (Local Test)

First, test the build locally:

```bash
npm run build:win
```

This will:

1. Build the Electron app
2. Create installers in the `dist/` folder:
   - `TimeTracker-Setup-1.0.0.exe` (Installer)
   - `TimeTracker-1.0.0-portable.exe` (Portable)

### 4.2 Test the Installer

1. Navigate to `dist/`
2. Run `TimeTracker-Setup-1.0.0.exe`
3. Install and test the application
4. Verify all features work correctly

> **Important**: Test on a clean machine if possible to ensure all dependencies are bundled

---

## Step 5: Publish to GitHub Releases

### 5.1 Automatic Publishing

To build and automatically publish to GitHub Releases:

```bash
npm run publish
```

This will:

1. Build the application
2. Create a GitHub Release with the version from `package.json`
3. Upload the installer files as release assets
4. Make them available for download

### 5.2 Manual Publishing

If you prefer manual control:

1. Build the app:

   ```bash
   npm run build:win
   ```

2. Go to your GitHub repository
3. Click "Releases" → "Create a new release"
4. Tag version: `v1.0.0` (match package.json version)
5. Release title: `TimeTracker v1.0.0`
6. Upload files from `dist/`:
   - `TimeTracker-Setup-1.0.0.exe`
   - `TimeTracker-1.0.0-portable.exe`
   - Optionally: `latest.yml` (for auto-updates)
7. Write release notes
8. Click "Publish release"

---

## Step 6: Distribution

### 6.1 Share Download Link

Your installer will be available at:

```
https://github.com/YOUR_USERNAME/TimeTracker/releases/latest/download/TimeTracker-Setup-1.0.0.exe
```

Or users can visit:

```
https://github.com/YOUR_USERNAME/TimeTracker/releases
```

### 6.2 Installation Instructions for Users

Share these instructions:

1. Download `TimeTracker-Setup-1.0.0.exe` from the releases page
2. Run the installer
3. Follow the installation wizard
4. Launch TimeTracker from the Start Menu or Desktop shortcut

**For Portable Version:**

1. Download `TimeTracker-1.0.0-portable.exe`
2. Run directly (no installation required)

---

## Step 7: Auto-Updates

The app is configured to check for updates automatically:

- Checks on startup (production builds only)
- Checks every 4 hours
- Downloads updates in the background
- Notifies users when an update is ready

### How Auto-Update Works:

1. User has TimeTracker v1.0.0 installed
2. You publish v1.1.0 to GitHub Releases
3. App checks GitHub Releases for newer version
4. Downloads update automatically
5. Prompts user to restart and install

> **Note**: Auto-update only works if `latest.yml` is published alongside your exe files

---

## Release Workflow

### For Each New Version:

1. **Make changes** to your codebase
2. **Test thoroughly** in development mode
3. **Update version** in `package.json`
4. **Commit changes**:
   ```bash
   git add .
   git commit -m "Release v1.1.0 - Added new features"
   git push
   ```
5. **Publish release**:
   ```bash
   npm run publish
   ```
6. **Verify on GitHub** that the release was created
7. **Test download** and installation from the release page
8. **Announce to users**

---

## Troubleshooting

### Build Fails

**Error: Cannot find module**

- Run `npm install` to ensure all dependencies are installed

**Error: icon.png not found**

- Ensure `resources/icon.png` exists
- For Windows .ico format: Convert png to ico or update config

### Publish Fails

**Error: GitHub token not set**

- Set `GH_TOKEN` environment variable
- Restart your terminal/IDE after setting

**Error: 404 Repository not found**

- Verify repository exists on GitHub
- Check `package.json` has correct owner/repo names
- Ensure GitHub token has `repo` scope

### Auto-Update Not Working

- Ensure `latest.yml` is uploaded to releases
- Check that the version number is properly formatted (semver)
- Verify app is running in production mode (not dev)
- Check console logs for auto-updater errors

---

## Security Considerations

### Before Public Release:

1. **Review .env file** - ensure it's in `.gitignore`
2. **Rotate API keys** after deployment if exposed
3. **Rate limiting** - monitor Gemini API usage
4. **Supabase RLS** - verify Row Level Security policies
5. **Code signing** (optional but recommended):
   - Purchase Windows code signing certificate
   - Configure in electron-builder
   - Prevents Windows SmartScreen warnings

---

## Cost Considerations

### Free Tier (GitHub Releases):

- ✅ Unlimited releases
- ✅ Unlimited downloads
- ✅ Free bandwidth

### Paid Services:

- **Supabase**: $0-40/month (based on usage)
- **Gemini API**: Pay per use
- **Code Signing Certificate**: ~$100-300/year (optional)

---

## Next Steps

After successful deployment:

1. ✅ Monitor GitHub release download statistics
2. ✅ Set up error tracking (optional: Sentry, Bugsnag)
3. ✅ Create user documentation
4. ✅ Set up feedback collection
5. ✅ Plan regular update schedule
6. ✅ Monitor Supabase usage dashboard
7. ✅ Optimize based on real-world usage

---

## Support & Maintenance

### Monitoring:

- **GitHub Insights**: Track downloads, stars, issues
- **Supabase Dashboard**: Monitor database performance, storage
- **User Feedback**: Set up GitHub Issues or email support

### Update Schedule:

- **Hotfixes**: Immediate (critical bugs)
- **Minor Updates**: Every 2 weeks (new features, improvements)
- **Major Updates**: Quarterly (significant changes)

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for Windows (test locally)
npm run build:win

# Build and publish to GitHub Releases
npm run publish

# Build for all platforms (Windows, macOS, Linux)
npm run build:all
```

---

**Congratulations!** 🎉 Your TimeTracker app is now ready for distribution via GitHub Releases!

Users can download and install it just like any professional desktop application, and they'll automatically receive updates as you release them.
