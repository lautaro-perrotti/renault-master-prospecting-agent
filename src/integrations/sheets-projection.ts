import {sql} from 'drizzle-orm';
import type {Db} from '../db/client.js';
import {SheetsSync} from './sheets.js';

export const projectionTabs=['LEADS','OUTREACH','RESPUESTAS','FUENTES','RUNS','BLACKLIST'] as const;
export class SheetProjectionService{
  constructor(private db:Db,private sync:SheetsSync){}
  async buildTabs(){
    const leads=(await this.db.execute(sql`SELECT c.id,c.name,c.domain,c.status,COALESCE(q.total,0) AS score FROM companies c LEFT JOIN LATERAL (SELECT total FROM qualifications WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1) q ON true ORDER BY c.updated_at DESC`)).rows as any[];
    const outreach=(await this.db.execute(sql`SELECT m.id,m.company_id,m.to_email,m.subject,m.outbound_state,m.sent_at FROM messages m ORDER BY m.id`)).rows as any[];
    const replies=(await this.db.execute(sql`SELECT id,company_id,gmail_message_id,classification,received_at FROM replies ORDER BY received_at DESC`)).rows as any[];
    const sources=(await this.db.execute(sql`SELECT id,company_id,source_type,url,created_at FROM sources ORDER BY created_at DESC`)).rows as any[];
    const runs=(await this.db.execute(sql`SELECT id,type,status,started_at,finished_at FROM runs ORDER BY started_at DESC`)).rows as any[];
    const blacklist=(await this.db.execute(sql`SELECT id,company_id,email,domain,reason,created_at FROM suppressions ORDER BY created_at DESC`)).rows as any[];
    const rows=(items:any[],headers:string[],fields:string[])=>[headers,...items.map(item=>fields.map(field=>String(item[field]??'')))];
    return{LEADS:rows(leads,['internal_id','name','domain','status','score'],['id','name','domain','status','score']),OUTREACH:rows(outreach,['internal_id','company_id','to_email','subject','state','sent_at'],['id','company_id','to_email','subject','outbound_state','sent_at']),RESPUESTAS:rows(replies,['internal_id','company_id','gmail_message_id','classification','received_at'],['id','company_id','gmail_message_id','classification','received_at']),FUENTES:rows(sources,['internal_id','company_id','source_type','url','created_at'],['id','company_id','source_type','url','created_at']),RUNS:rows(runs,['internal_id','type','status','started_at','finished_at'],['id','type','status','started_at','finished_at']),BLACKLIST:rows(blacklist,['internal_id','company_id','email','domain','reason','created_at'],['id','company_id','email','domain','reason','created_at'])};
  }
  async syncDatabase(){await this.sync.syncTabs(await this.buildTabs())}
}
