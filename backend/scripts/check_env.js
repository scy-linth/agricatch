require('dotenv').config();
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
