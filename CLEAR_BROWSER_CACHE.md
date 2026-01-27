# How to Clear Browser Cache for Orders

## Quick Method (Recommended)

### Step 1: Open Browser Console
1. Press **F12** (or right-click → Inspect)
2. Click the **Console** tab

### Step 2: Run This Command
Copy and paste this entire block into the console and press Enter:

```javascript
// Clear all storage
localStorage.clear();
sessionStorage.clear();

// Force reload all pages
if (window.ordersPage) window.ordersPage.loadOrders();
if (window.farmerDashboard) window.farmerDashboard.loadMyOrders();
if (window.adminDashboard) window.adminDashboard.loadOrders();

// Reload the page
location.reload();
```

### Step 3: Hard Refresh
After the page reloads, do a **hard refresh**:
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

---

## Alternative Methods

### Method 1: Browser Settings (Chrome/Edge)
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cached images and files"
3. Time range: "All time"
4. Click "Clear data"

### Method 2: Browser Settings (Firefox)
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cache"
3. Time range: "Everything"
4. Click "Clear Now"

### Method 3: Developer Tools
1. Press **F12** to open DevTools
2. Right-click the refresh button (next to address bar)
3. Select **"Empty Cache and Hard Reload"**

---

## Complete Reset (If Still Seeing Old Data)

Run this in the browser console (F12):

```javascript
// 1. Clear all storage
localStorage.clear();
sessionStorage.clear();

// 2. Clear service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
  });
}

// 3. Clear IndexedDB (if used)
if ('indexedDB' in window) {
  indexedDB.databases().then(dbs => {
    dbs.forEach(db => indexedDB.deleteDatabase(db.name));
  });
}

// 4. Force reload
setTimeout(() => location.reload(true), 1000);
```

Then do a hard refresh: `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac)
