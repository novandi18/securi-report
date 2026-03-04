const mysql2 = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

(async () => {
  const c = await mysql2.createConnection(process.env.DATABASE_URL);
  
  try { await c.execute('ALTER TABLE reports ADD COLUMN scope_issa_1 JSON NULL'); console.log('Added scope_issa_1'); } catch(e) { console.log('scope_issa_1:', e.message); }
  try { await c.execute('ALTER TABLE reports ADD COLUMN scope_issa_2 JSON NULL'); console.log('Added scope_issa_2'); } catch(e) { console.log('scope_issa_2:', e.message); }
  try { await c.execute('ALTER TABLE reports ADD COLUMN scope_issa_3 JSON NULL'); console.log('Added scope_issa_3'); } catch(e) { console.log('scope_issa_3:', e.message); }
  try { await c.execute('ALTER TABLE reports DROP COLUMN scope'); console.log('Dropped scope'); } catch(e) { console.log('drop scope:', e.message); }
  
  const [rows] = await c.execute('SHOW COLUMNS FROM reports');
  console.log('Current columns:', rows.map(r => r.Field).join(', '));
  
  await c.end();
  process.exit(0);
})();
