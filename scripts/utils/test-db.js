// test-db.js
require('dotenv').config({ path: '../.env' }); // Adjust path to point to root
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

console.log(pool);

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log("✅ Successfully connected to Postgres!");

    // Test Read
    const res = await client.query('SELECT version()');
    console.log("Database version:", res.rows[0].version);

    // Test Write (Create a temp table)
    await client.query('CREATE TABLE IF NOT EXISTS test_perm (id SERIAL PRIMARY KEY)');
    console.log("✅ Successfully created test table (Write permissions confirmed).");

    // Clean up
    await client.query('DROP TABLE test_perm');
    console.log("✅ Successfully dropped test table (Delete permissions confirmed).");

    client.release();
  } catch (err) {
    console.error("❌ Connection or Permission Error:", err.message);
  } finally {
    await pool.end();
  }
}

testConnection();