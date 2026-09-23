import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import type {Db} from '../db/client.js';

export type JobType='DISCOVERY'|'RESEARCH'|'CRAWL'|'ENRICH'|'QUALIFY'|'DRAFT'|'SEND'|'CHECK_REPLIES'|'FOLLOW_UP'|'SHEETS_SYNC';
export type JobRecord={id:string;type:JobType;payload:Record<string,unknown>;status:string;attempts:number;maxAttempts:number;runAt:Date;leaseOwner?:string};
export function retryDelaySeconds(attempt:number){return Math.min(3600,Math.pow(2,attempt)*30)}
export function isStale(lockedAt:Date|undefined,maxAgeMs=300000){return Boolean(lockedAt&&Date.now()-lockedAt.getTime()>maxAgeMs)}
export function jobKey(type:JobType,payload:Record<string,unknown>){return `${type}:${JSON.stringify(payload,Object.keys(payload).sort())}`}

export async function enqueue(db:Db,type:JobType,payload:Record<string,unknown>,runAt=new Date(),options:{idempotencyKey?:string;priority?:number;runId?:string}={}){
  const key=options.idempotencyKey;const result=await db.execute(sql`INSERT INTO jobs(type,payload,run_at,idempotency_key,priority,run_id) VALUES(${type},${JSON.stringify(payload)}::jsonb,${runAt},${key??null},${options.priority??0},${options.runId??null}) ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE SET payload=jobs.payload RETURNING *`);
  return result.rows[0] as JobRecord|undefined;
}
export async function requeueStale(db:Db,maxAgeSeconds=300){await db.execute(sql`UPDATE jobs SET status='PENDING',locked_at=NULL,lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,last_error='STALE_LOCK_REQUEUED' WHERE status='RUNNING' AND COALESCE(lease_expires_at,locked_at)<now()-(${maxAgeSeconds} * interval '1 second')`)}
export async function claim(db:Db,owner=randomUUID()):Promise<(JobRecord&{leaseOwner:string})|undefined>{
  const result=await db.execute(sql`WITH next_job AS (SELECT id FROM jobs WHERE status='PENDING' AND run_at<=now() ORDER BY priority DESC,run_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE jobs SET status='RUNNING',locked_at=now(),heartbeat_at=now(),lease_owner=${owner},lease_expires_at=now()+interval '5 minutes',attempts=attempts+1 FROM next_job WHERE jobs.id=next_job.id RETURNING jobs.*`);
  return result.rows[0] as (JobRecord&{leaseOwner:string})|undefined;
}
export async function heartbeat(db:Db,id:string,owner:string){await db.execute(sql`UPDATE jobs SET heartbeat_at=now(),lease_expires_at=now()+interval '5 minutes' WHERE id=${id} AND status='RUNNING' AND lease_owner=${owner}`)}
export async function finish(db:Db,id:string){await db.execute(sql`UPDATE jobs SET status='DONE',finished_at=now(),locked_at=NULL,lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL WHERE id=${id}`)}
export async function fail(db:Db,id:string,error:Error){await db.execute(sql`UPDATE jobs SET status=CASE WHEN attempts>=max_attempts THEN 'DEAD' ELSE 'PENDING' END,locked_at=NULL,lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,last_error=${error.message},run_at=now()+(LEAST(3600,POWER(2,GREATEST(attempts-1,0))*30)*interval '1 second') WHERE id=${id}`)}
