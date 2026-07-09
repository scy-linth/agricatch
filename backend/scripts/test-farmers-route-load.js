try {
  console.log('Attempting to load farmers route...');
  const farmersRouter = require('../routes/farmers');
  console.log('Farmers route loaded successfully');
  console.log('Router type:', typeof farmersRouter);
} catch (error) {
  console.error('Failed to load farmers route:', error.message);
  console.error('Stack trace:', error.stack);
}
