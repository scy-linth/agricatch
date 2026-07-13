const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cxqyqffnrmfowwaefbff:etitsmwa123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=no-verify'
});

async function main() {
  try {
    await client.connect();
    const result = await client.query("SELECT id, email, role, full_name FROM users WHERE role IN ('admin', 'super_admin') OR email = 'testfarmer@test.com' ORDER BY role LIMIT 10");
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (e) {
    console.error(e.message);
  } finally {
    await client.end();
  }
}

main();
