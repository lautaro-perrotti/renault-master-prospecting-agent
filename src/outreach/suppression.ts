import {sql} from 'drizzle-orm';
import type {Db} from '../db/client.js';
import {normalizeEmail} from '../enrichment/contacts.js';
import {normalizeDomain} from '../enrichment/company.js';
export type SuppressionDecision={suppressed:boolean;reasons:string[]};
function clauses(companyId:string,email?:string,domain?:string){const parts=[sql`company_id=${companyId}`];if(email)parts.push(sql`email=${normalizeEmail(email)}`);if(domain)parts.push(sql`domain=${normalizeDomain(domain)}`);return parts}
export async function getSuppressionDecision(db:Db,companyId:string,email?:string,domain?:string):Promise<SuppressionDecision>{
  const company=(await db.execute(sql`SELECT domain,status FROM companies WHERE id=${companyId}`)).rows[0] as any;const rows=await db.execute(sql`SELECT reason FROM suppressions WHERE ${sql.join(clauses(companyId,email,domain??company?.domain),sql` OR `)}`);const reasons=(rows.rows as any[]).map(row=>String(row.reason));if(company?.status==='BLOCKED')reasons.push('COMPANY_BLOCKED');return{suppressed:reasons.length>0,reasons:[...new Set(reasons)]};
}
export async function createSuppression(db:Db,input:{companyId?:string;email?:string;domain?:string;reason:string}){
  const email=input.email?normalizeEmail(input.email):undefined;const domain=normalizeDomain(input.domain);const match=[];if(input.companyId)match.push(sql`company_id=${input.companyId}`);if(email)match.push(sql`email=${email}`);if(domain)match.push(sql`domain=${domain}`);if(match.length){const existing=await db.execute(sql`SELECT id FROM suppressions WHERE ${sql.join(match,sql` OR `)} LIMIT 1`);if(existing.rows.length)return existing.rows[0]}
  const inserted=await db.execute(sql`INSERT INTO suppressions(company_id,email,domain,reason) VALUES(${input.companyId??null},${email??null},${domain??null},${input.reason}) RETURNING *`);return inserted.rows[0];
}
