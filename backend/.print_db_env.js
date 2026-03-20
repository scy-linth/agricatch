const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });
console.log('DATABASE_URL=' + (process.env.DATABASE_URL || ''));
console.log('DB_HOST=' + (process.env.DB_HOST || ''));
console.log('DB_NAME=' + (process.env.DB_NAME || ''));
console.log('DB_USER=' + (process.env.DB_USER || ''));
console.log('DB_PORT=' + (process.env.DB_PORT || ''));
