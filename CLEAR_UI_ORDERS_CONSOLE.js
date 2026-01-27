// Copy and paste this ENTIRE script into browser console (F12) to clear orders from UI

(function clearUIOrders() {
  console.log('🗑️ Clearing orders from UI...\n');

  // Clear customer orders page
  if (window.ordersPage) {
    const container = document.getElementById('orders-list');
    if (container) {
      container.innerHTML = '<div class="empty-state">No orders found.</div>';
      console.log('✓ Cleared customer orders UI');
    }
    if (window.ordersPage.loadOrders) {
      window.ordersPage.loadOrders();
      console.log('✓ Reloaded customer orders from server');
    }
  }

  // Clear farmer dashboard orders
  if (window.farmerDashboard) {
    // Clear in-memory cache
    if (window.farmerDashboard.lastOrdersById) {
      window.farmerDashboard.lastOrdersById.clear();
      console.log('✓ Cleared farmer orders cache');
    }
    if (window.farmerDashboard.lastOrdersByStatus) {
      window.farmerDashboard.lastOrdersByStatus = { 
        pending: [], confirmed: [], preparing: [], 
        out_for_delivery: [], delivered: [], cancelled: [] 
      };
    }

    // Clear all order containers
    const statuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    statuses.forEach(status => {
      const container = document.getElementById(`${status}-orders-list`);
      if (container) {
        container.innerHTML = `<div class="empty-state"><p>No orders found.</p></div>`;
      }
    });
    console.log('✓ Cleared all farmer order tabs');

    // Force reload from server
    if (window.farmerDashboard.loadMyOrders) {
      window.farmerDashboard.loadMyOrders();
      console.log('✓ Reloaded farmer orders from server');
    }
  }

  // Clear admin dashboard orders
  if (window.adminDashboard) {
    if (window.adminDashboard.lastOrders) {
      window.adminDashboard.lastOrders = [];
      console.log('✓ Cleared admin orders cache');
    }
    if (window.adminDashboard.renderOrders) {
      window.adminDashboard.renderOrders([]);
      console.log('✓ Cleared admin orders UI');
    }
    if (window.adminDashboard.loadOrders) {
      window.adminDashboard.loadOrders();
      console.log('✓ Reloaded admin orders from server');
    }
  }

  console.log('\n✅ UI cleared! Orders should now be empty.');
  console.log('💡 If orders still appear, refresh the page (F5) or check the Network tab to see if API is returning orders.\n');
})();
