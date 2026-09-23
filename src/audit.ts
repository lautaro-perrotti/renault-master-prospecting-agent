import {sql} from 'drizzle-orm';
import type {Db} from './db/client.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function audit(db:Db,action:string,details:Record<string,unknown>,companyId?:string,jobId?:string,runId?:string){const safeDetails=jobId&&!uuid.test(jobId)?{...details,sourceJobId:jobId}:details;await db.execute(sql`INSERT INTO audit_events(action,company_id,job_id,run_id,details) VALUES(${action},${uuid.test(companyId??'')?companyId:null},${uuid.test(jobId??'')?jobId:null},${uuid.test(runId??'')?runId:null},${JSON.stringify(safeDetails)}::jsonb)`)}
