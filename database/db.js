// db.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); // Load environment variables from .env, regardless of CWD
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

module.exports = {
  query: (text, params) => pool.query(text, params), 
  pool, // Export the pool for direct access if needed
};