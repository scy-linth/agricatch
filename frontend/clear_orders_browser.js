// Complete Browser Cache Clear Script
// Copy and paste this ENTIRE script into browser console (F12) and press Enter

(function clearEverything() {
  console.log('🧹 Starting complete cache clear...\n');

  // Step 1: Clear all storage
  const token = localStorage.getItem('token');
  localStorage.clear();
  sessionStorage.clear();
  if (token) localStorage.setItem('token', token);
  console.log('✓ Storage cleared');

  // Step 2: Clear IndexedDB
  if ('indexedDB' in window) {
    indexedDB.databases().then(dbs => {
      dbs.forEach(db => {
        indexedDB.deleteDatabase(db.name);
        console.log(`✓ Deleted IndexedDB: ${db.name}`);
      });
    });
  }

  // Step 3: Clear Cache API
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
        console.log(`✓ Deleted cache: ${name}`);
      });
    });
  }

  // Step 4: Clear service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => {
        reg.unregister();
        console.log('✓ Service worker unregistered');
      });
    });
  }

  // Step 5: Force reload orders with cache bypass
  console.log('\n🔄 Forcing fresh API calls...');
  
  // Force reload customer orders
  if (window.ordersPage) {
    fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    })
    .then(() => {
      if (window.ordersPage.loadOrders) {
        window.ordersPage.loadOrders();
        console.log('✓ Customer orders reloaded');
      }
    });
  }

  // Force reload farmer orders
  if (window.farmerDashboard) {
    const farmerId = window.farmerDashboard.farmerId || window.farmerDashboard.userId;
    if (farmerId) {
      fetch(`/api/orders/farmer/${farmerId}?status=pending&_=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      })
      .then(() => {
        if (window.farmerDashboard.loadMyOrders) {
          window.farmerDashboard.loadMyOrders();
          console.log('✓ Farmer orders reloaded');
        }
      });
    }
  }

  // Force reload admin orders
  if (window.adminDashboard) {
    fetch('/api/admin/orders?_=' + Date.now(), {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store'
    })
    .then(() => {
      if (window.adminDashboard.loadOrders) {
        window.adminDashboard.loadOrders();
        console.log('✓ Admin orders reloaded');
      }
    });
  }

  console.log('\n✅ Cache cleared! Reloading page in 2 seconds...');
  console.log('💡 If orders still appear, the database might not be cleared.');
  console.log('   Run: node database/clear_orders.js\n');
  
  setTimeout(() => {
    location.reload(true);
  }, 2000);
})();
