import {Pool} from 'pg'; import {drizzle} from 'drizzle-orm/node-postgres'; import * as schema from './schema.js'; import type {Config} from '../config.js';
export function createDb(config:Config){const pool=new Pool({connectionString:config.DATABASE_URL});return{pool,db:drizzle(pool,{schema})}}
export type Db=ReturnType<typeof createDb>['db']; export async function closeDb(client:ReturnType<typeof createDb>){await client.pool.end()}
