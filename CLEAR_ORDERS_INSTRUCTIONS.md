# 🗑️ How to Clear All Orders

## Step 1: Navigate to Project Directory

**IMPORTANT:** You must run the script from the project root directory!

Open terminal/command prompt and run:

```bash
cd "d:\Program Files\Coding\imtired"
```

Or if you're already in the project folder, make sure you're in the root directory (where you see `database`, `backend`, `frontend` folders).

## Step 2: Run the Database Clear Script

```bash
node database/clear_orders.js
```

You should see output like:
```
🗑️  Starting to clear all orders...

Deleting order items...
   ✓ Deleted X order items
...
✅ All orders have been deleted successfully!
```

## Step 3: Clear Browser Cache

After the database is cleared, open your browser and:

1. Go to: `http://localhost:3000/clear_cache.html`
2. Click "Clear All Cache"
3. Or press F12 → Console → Run:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   location.reload(true);
   ```

## Step 4: Hard Refresh All Pages

Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac) on all pages.

---

## ⚠️ Troubleshooting

### Error: "Cannot find module"
- **Problem:** You're not in the project root directory
- **Solution:** 
  ```bash
  cd "d:\Program Files\Coding\imtired"
  node database/clear_orders.js
  ```

### Still seeing orders after clearing?
1. Check if database script completed successfully
2. Verify in browser console (F12):
   ```javascript
   fetch('/api/orders', {
     headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
   })
   .then(r => r.json())
   .then(data => console.log('Orders count:', data.orders?.length || 0));
   ```
   If it shows > 0, the database wasn't cleared. Run the script again.
