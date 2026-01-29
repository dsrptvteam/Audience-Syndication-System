require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Try DATABASE_URL first (pooler), fall back to DIRECT_URL
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (!connectionString) {
    console.error('ERROR: DIRECT_URL environment variable is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '0001_init', 'migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration completed successfully!');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('\nTables created:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
