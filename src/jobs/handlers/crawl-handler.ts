import {sql} from 'drizzle-orm';
import type {Config} from '../../config.js';
import type {Db} from '../../db/client.js';
import {audit} from '../../audit.js';
import {extractContacts} from '../../enrichment/contacts.js';
import {WebsiteCrawler} from '../../crawler/website.js';
import type {JobDependencies} from '../dependencies.js';
import {enqueue} from '../queue.js';
import {getSuppressionDecision} from '../../outreach/suppression.js';

function signalFor(page:{text:string;businessSignals?:string[]}){const text=`${page.text} ${(page.businessSignals??[]).join(' ')}`.toLowerCase();if(/refriger|congel|cadena de fr[ií]o|ultracongel/.test(text))return'REFRIGERATED_PRODUCTS';if(/distribu|entrega|mayorista|log[ií]st|repart/.test(text))return'DISTRIBUTION';return'OTHER'}
export async function crawlHandler(db:Db,config:Config,job:any,deps:JobDependencies){
  const companyId=String(job.payload.companyId);const company=(await db.execute(sql`SELECT id,status,domain FROM companies WHERE id=${companyId}`)).rows[0] as any;if(!company)throw new Error('COMPANY_NOT_FOUND');
  const suppression=await getSuppressionDecision(db,companyId);if(suppression.suppressed)return;
  const crawler=deps.crawler??new WebsiteCrawler(config);const pages=await crawler.crawl(String(job.payload.website));
  for(const page of pages){
    if(!page.text)continue;
    const excerpt=page.text.slice(0,4000);
    const inserted=(await db.execute(sql`INSERT INTO evidence(company_id,source_type,source_url,title,excerpt,signal_type,confidence,observed_at) VALUES(${companyId},${page.sourceType},${page.url},${page.title||page.url},${excerpt},${signalFor(page)},${page.businessSignals?.length?85:55},${page.observedAt}) ON CONFLICT DO NOTHING RETURNING id`)).rows[0] as any;
    const evidence=inserted??(await db.execute(sql`SELECT id FROM evidence WHERE company_id=${companyId} AND source_url=${page.url} AND md5(excerpt)=md5(${excerpt}) LIMIT 1`)).rows[0] as any;
    await db.execute(sql`INSERT INTO sources(company_id,source_type,url,metadata) VALUES(${companyId},'WEBSITE',${page.url},${JSON.stringify({title:page.title,contactSignals:page.contactSignals,businessSignals:page.businessSignals,evidenceId:evidence?.id})}::jsonb) ON CONFLICT DO NOTHING`);
    for(const finding of extractContacts(page.text,page.url))if(finding.email)await db.execute(sql`INSERT INTO contacts(company_id,email,kind,source_url,verification_status,verified) VALUES(${companyId},${finding.email},${finding.kind},${finding.sourceUrl},${finding.verificationStatus},false) ON CONFLICT(company_id,email) DO UPDATE SET source_url=excluded.source_url,verification_status=excluded.verification_status`);
    for(const finding of extractContacts(page.text,page.url))if(finding.phone)await db.execute(sql`INSERT INTO contacts(company_id,phone,kind,source_url,verification_status,verified) VALUES(${companyId},${finding.phone},${finding.kind},${finding.sourceUrl},${finding.verificationStatus},false) ON CONFLICT DO NOTHING`);
  }
  await db.execute(sql`UPDATE companies SET status=CASE WHEN status IN ('BLOCKED','DISCARDED') THEN status ELSE 'RESEARCHING' END,updated_at=now() WHERE id=${companyId}`);
  await enqueue(db,'RESEARCH',{companyId},new Date(),{idempotencyKey:`RESEARCH:${companyId}`});await audit(db,'CRAWL_COMPLETED',{pages:pages.length},companyId,job.id);
}
