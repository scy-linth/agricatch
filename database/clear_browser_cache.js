// Browser Console Script to Clear Order-Related Cache
// Copy and paste this entire script into your browser's console (F12) and press Enter

(function clearOrderCache() {
  console.log('🧹 Clearing browser cache for orders...\n');

  // Clear localStorage items (except token to stay logged in)
  const token = localStorage.getItem('token');
  const farmerSection = localStorage.getItem('farmerActiveSection');
  const adminSection = localStorage.getItem('adminActiveSection');
  
  // Clear all localStorage except essential items
  localStorage.clear();
  
  // Restore essential items
  if (token) {
    localStorage.setItem('token', token);
    console.log('✓ Token preserved');
  }
  if (farmerSection) {
    localStorage.setItem('farmerActiveSection', farmerSection);
  }
  if (adminSection) {
    localStorage.setItem('adminActiveSection', adminSection);
  }

  // Clear sessionStorage
  sessionStorage.clear();
  console.log('✓ Session storage cleared');

  // Clear any cached API responses (if using service workers)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
        console.log('✓ Service worker unregistered');
      });
    });
  }

  // Force reload orders if on orders page
  if (window.ordersPage && typeof window.ordersPage.loadOrders === 'function') {
    window.ordersPage.loadOrders();
    console.log('✓ Customer orders page refreshed');
  }

  // Force reload orders if on farmer dashboard
  if (window.farmerDashboard && typeof window.farmerDashboard.loadMyOrders === 'function') {
    window.farmerDashboard.loadMyOrders();
    console.log('✓ Farmer dashboard orders refreshed');
  }

  // Force reload orders if on admin dashboard
  if (window.adminDashboard && typeof window.adminDashboard.loadOrders === 'function') {
    window.adminDashboard.loadOrders();
    console.log('✓ Admin dashboard orders refreshed');
  }

  console.log('\n✅ Browser cache cleared!');
  console.log('💡 Tip: Refresh the page (F5) to ensure all data is reloaded from the server.\n');
})();
