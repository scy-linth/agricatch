try {
  console.log('Attempting to load admin route...');
  const adminRouter = require('../routes/admin');
  console.log('Admin route loaded successfully');
  console.log('Router type:', typeof adminRouter);
  console.log('Has ensureCategoryAdminSchema:', typeof adminRouter.ensureCategoryAdminSchema);
} catch (error) {
  console.error('Failed to load admin route:', error.message);
  console.error('Stack trace:', error.stack);
}
