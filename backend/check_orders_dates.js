const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.cxqyqffnrmfowwaefbff:etitsmwa123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=no-verify'
});

pool.query(`
  SELECT DATE(created_at) as date, COUNT(*) as count 
  FROM orders 
  WHERE status != 'cancelled' 
  GROUP BY DATE(created_at) 
  ORDER BY date DESC 
  LIMIT 20
`).then(r => {
  console.log('Orders by date:');
  r.rows.forEach(row => console.log(row.date, '-', row.count, 'orders'));
  pool.end();
}).catch(e => {
  console.error(e);
  pool.end();
});
