# GitHub Upload & Update Guide

This guide will help you upload your AgriCatch system to GitHub and keep it updated.

## Prerequisites

1. **Git installed** - Download from [https://git-scm.com/downloads](https://git-scm.com/downloads)
2. **GitHub account** - Create one at [https://github.com](https://github.com)
3. **GitHub repository** - Create a new repository on GitHub (don't initialize with README)

---

## Step 1: Initial Setup (First Time Only)

### 1.1 Open PowerShell or Command Prompt

Navigate to your project directory:
```powershell
cd "d:\Program Files\Coding\imtired"
```

### 1.2 Initialize Git Repository

```powershell
git init
```

### 1.3 Configure Git (if not already done)

```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 1.4 Check Current Status

```powershell
git status
```

This will show you which files will be tracked. Make sure `.env` files and `node_modules` are NOT listed (they should be ignored).

---

## Step 2: Add Files to Git

### 2.1 Add All Files

```powershell
git add .
```

### 2.2 Verify What Will Be Committed

```powershell
git status
```

**IMPORTANT:** Make sure these files are NOT included:
- ❌ `.env` files
- ❌ `node_modules/` folders
- ❌ `LOGIN_CREDENTIALS.md`
- ❌ `SETUP_GUIDE_LOG.txt`
- ❌ Any files with passwords or secrets

### 2.3 Create Initial Commit

```powershell
git commit -m "Initial commit: AgriCatch marketplace system"
```

---

## Step 3: Connect to GitHub

### 3.1 Create Repository on GitHub

1. Go to [https://github.com/new](https://github.com/new)
2. Enter repository name (e.g., `agricatch-marketplace`)
3. Choose **Public** or **Private**
4. **DO NOT** check "Initialize with README"
5. Click "Create repository"

### 3.2 Add GitHub Remote

Copy the repository URL from GitHub (e.g., `https://github.com/yourusername/agricatch-marketplace.git`)

```powershell
git remote add origin https://github.com/yourusername/agricatch-marketplace.git
```

### 3.3 Verify Remote

```powershell
git remote -v
```

---

## Step 4: Upload to GitHub

### 4.1 Push to GitHub

```powershell
git branch -M main
git push -u origin main
```

You'll be prompted for your GitHub username and password (or use a Personal Access Token).

---

## Step 5: Updating Your Repository

Whenever you make changes to your code, follow these steps:

### 5.1 Check What Changed

```powershell
git status
```

### 5.2 Add Changed Files

```powershell
# Add specific files
git add path/to/file.js

# Or add all changes
git add .
```

### 5.3 Commit Changes

```powershell
git commit -m "Description of your changes"
```

Examples:
- `git commit -m "Added checkout quantity controls"`
- `git commit -m "Fixed cart refresh issue"`
- `git commit -m "Updated UI color palette"`

### 5.4 Push to GitHub

```powershell
git push
```

---

## Quick Update Commands (Copy & Paste)

For regular updates, use these commands in sequence:

```powershell
# Navigate to project
cd "d:\Program Files\Coding\imtired"

# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "Update: [describe your changes]"

# Push to GitHub
git push
```

---

## Troubleshooting

### Issue: "fatal: not a git repository"

**Solution:** Run `git init` first

### Issue: "Permission denied" when pushing

**Solutions:**
1. Use Personal Access Token instead of password:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Generate new token with `repo` permissions
   - Use token as password when pushing

2. Or use SSH:
   ```powershell
   git remote set-url origin git@github.com:yourusername/repository.git
   ```

### Issue: "Updates were rejected"

**Solution:** Pull first, then push:
```powershell
git pull origin main
git push
```

### Issue: Accidentally added sensitive files

**Solution:**
1. Remove from Git (but keep local file):
   ```powershell
   git rm --cached .env
   git rm --cached backend/.env
   ```

2. Add to .gitignore (already done)

3. Commit the removal:
   ```powershell
   git commit -m "Remove sensitive files from tracking"
   git push
   ```

---

## Best Practices

1. **Commit Often**: Make small, frequent commits with clear messages
2. **Never Commit Secrets**: Always check `.gitignore` includes `.env` files
3. **Write Good Commit Messages**: Describe what changed and why
4. **Pull Before Push**: If working with others, always pull first
5. **Use Branches**: For major features, create branches:
   ```powershell
   git checkout -b feature-name
   # Make changes
   git commit -m "Add feature"
   git push -u origin feature-name
   ```

---

## File Structure in GitHub

Your repository should include:
- ✅ `backend/` - All backend code
- ✅ `frontend/` - All frontend files
- ✅ `database/` - Database scripts
- ✅ `README.md` - Project documentation
- ✅ `.gitignore` - Ignore rules
- ❌ `.env` - Should NOT be uploaded
- ❌ `node_modules/` - Should NOT be uploaded

---

## Need Help?

- Git Documentation: [https://git-scm.com/doc](https://git-scm.com/doc)
- GitHub Guides: [https://guides.github.com](https://guides.github.com)
- Git Cheat Sheet: [https://education.github.com/git-cheat-sheet-education.pdf](https://education.github.com/git-cheat-sheet-education.pdf)

---

**Remember:** Never share your `.env` file or any files containing passwords, API keys, or database credentials publicly!
