import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import type {Db} from '../db/client.js';
import {claim,fail,finish,heartbeat,requeueStale} from './queue.js';

export async function workerLoop(db:Db,handler:(job:any)=>Promise<void>,signal?:AbortSignal){
  const owner=randomUUID();
  while(!signal?.aborted){
    await db.execute(sql`INSERT INTO configuration(key,value) VALUES('WORKER_HEARTBEAT',now()::text) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    await requeueStale(db);
    const job=await claim(db,owner);
    if(!job){await new Promise(resolve=>setTimeout(resolve,1000));continue}
    const timer=setInterval(()=>void heartbeat(db,job.id,owner),30_000);
    try{await handler(job);await finish(db,job.id)}catch(error){await fail(db,job.id,error instanceof Error?error:new Error(String(error)))}finally{clearInterval(timer)}
  }
}
