import type {Pool} from 'pg';
import fs from 'node:fs';
import path from 'node:path';
export async function migrate(pool:Pool){
  const dir=path.resolve('src/db/migrations');const files=fs.readdirSync(dir).filter(file=>file.endsWith('.sql')).sort();const client=await pool.connect();
  try{
    await client.query(`SELECT pg_advisory_lock(hashtext('renault-migrations'))`);await client.query(`CREATE TABLE IF NOT EXISTS migration_history(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    for(const file of files){const current=await client.query('SELECT 1 FROM migration_history WHERE version=$1',[file]);if(current.rowCount)continue;await client.query('BEGIN');try{await client.query(fs.readFileSync(path.join(dir,file),'utf8'));await client.query('INSERT INTO migration_history(version) VALUES($1)',[file]);await client.query('COMMIT')}catch(error){await client.query('ROLLBACK');throw error}}
  }finally{await client.query(`SELECT pg_advisory_unlock(hashtext('renault-migrations'))`);client.release()}
}
