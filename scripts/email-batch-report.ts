import 'dotenv/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {sql} from 'drizzle-orm';
import {loadConfig} from '../src/config.js';
import {closeDb,createDb} from '../src/db/client.js';
import {migrate} from '../src/db/migrate.js';
import {classifyPersistedRefrigeration,type RefrigerationSegment} from '../src/qualification/refrigeration.js';

function csv(value:unknown){return `"${String(value??'').replace(/"/g,'""')}"`}
function classificationReason(segment:RefrigerationSegment,row:any){
  const known=(value:unknown)=>Boolean(value && value!=='UNKNOWN');
  const direct=known(row.use_case)||known(row.refrigeration_fit);
  const source=direct?'calificación':'investigación';
  const useCase=direct?row.use_case:row.research_use_case;
  const fit=direct?row.refrigeration_fit:row.research_refrigeration_fit;
  if(segment==='REFRIGERATED')return `Refrigerado/congelado: ${source} indica use_case=${useCase??'—'} y refrigeration_fit=${fit??'—'}.`;
  if(segment==='NON_REFRIGERATED')return `General: ${source} indica use_case=${useCase??'—'} y refrigeration_fit=${fit??'—'}.`;
  return 'General por fallback: todavía no hay clasificación específica de refrigeración; se conserva en el texto la capacidad refrigerada y congelada.';
}

const config=loadConfig(),client=createDb(config);
try{
  await migrate(client.pool);
  const result=await client.db.execute(sql`SELECT m.id AS message_id,c.name AS company_name,m.to_email,m.subject,m.outbound_state,ct.source_url AS contact_source_url,e.source_url AS evidence_source_url,e.excerpt,q.use_case,q.refrigeration_fit,r.use_case AS research_use_case,r.refrigeration_fit AS research_refrigeration_fit FROM messages m JOIN message_sequences ms ON ms.id=m.sequence_id JOIN campaigns ca ON ca.id=ms.campaign_id JOIN companies c ON c.id=m.company_id LEFT JOIN LATERAL(SELECT source_url FROM contacts WHERE company_id=c.id AND lower(email)=lower(m.to_email) ORDER BY invalid,verified DESC LIMIT 1) ct ON true LEFT JOIN LATERAL(SELECT source_url,excerpt FROM evidence WHERE company_id=c.id ORDER BY observed_at DESC LIMIT 1) e ON true LEFT JOIN LATERAL(SELECT use_case,refrigeration_fit FROM qualifications WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1) q ON true LEFT JOIN LATERAL(SELECT use_case,refrigeration_fit FROM research_results WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1) r ON true WHERE ca.name='DEFAULT_TRANSPORT_OUTREACH' AND m.direction='OUTBOUND' AND m.sequence_step='DAY_0' AND m.prepared_at IS NOT NULL ORDER BY CASE WHEN m.subject LIKE '%refrigerado%' THEN 0 ELSE 1 END,c.name,m.to_email`);
  const rows=(result.rows as any[]).map(row=>{
    const segment=classifyPersistedRefrigeration({useCase:row.use_case,refrigerationFit:row.refrigeration_fit,fallbackUseCase:row.research_use_case,fallbackRefrigerationFit:row.research_refrigeration_fit});
    const template=String(row.subject).includes('refrigerado')?'REFRIGERADO_CONGELADO':'GENERAL';
    return {messageId:String(row.message_id),company:String(row.company_name),email:String(row.to_email),url:String(row.contact_source_url??row.evidence_source_url??''),contactSourceUrl:row.contact_source_url??null,evidenceSourceUrl:row.evidence_source_url??null,template,classification:segment,reason:classificationReason(segment,{use_case:row.use_case,refrigeration_fit:row.refrigeration_fit,research_use_case:row.research_use_case,research_refrigeration_fit:row.research_refrigeration_fit}),evidence:row.excerpt??null,status:String(row.outbound_state)};
  });
  const stamp=new Date().toISOString().replace(/[:.]/g,'-'),directory=path.resolve('reports');
  await fs.mkdir(directory,{recursive:true});
  const headers=['messageId','company','email','url','template','classification','reason','evidence','status'];
  const csvPath=path.join(directory,`email-batch-${stamp}.csv`),mdPath=path.join(directory,`email-batch-${stamp}.md`);
  await fs.writeFile(csvPath,[headers.join(','),...rows.map(row=>headers.map(header=>csv(row[header as keyof typeof row])).join(','))].join('\n'),'utf8');
  const groups={REFRIGERADO_CONGELADO:rows.filter(row=>row.template==='REFRIGERADO_CONGELADO'),GENERAL:rows.filter(row=>row.template==='GENERAL')};
  const markdown=['# Lote de emails preparado','',`Total: ${rows.length}`,`Refrigerado/congelado: ${groups.REFRIGERADO_CONGELADO.length}`,`General: ${groups.GENERAL.length}`,'','| Empresa | Email | Plantilla | Clasificación | URL | Motivo |','|---|---|---|---|---|---|',...rows.map(row=>`| ${row.company.replace(/\|/g,'\\|')} | ${row.email} | ${row.template} | ${row.classification} | ${row.url} | ${row.reason.replace(/\|/g,'\\|')} |`)];
  await fs.writeFile(mdPath,markdown.join('\n'),'utf8');
  console.log(JSON.stringify({total:rows.length,refrigerated:groups.REFRIGERADO_CONGELADO.length,general:groups.GENERAL.length,generalFallback:rows.filter(row=>row.classification==='UNKNOWN').length,csv:csvPath,markdown:mdPath},null,2));
}catch(error){console.error(`EMAIL_BATCH_REPORT_FAILED: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}finally{await closeDb(client)}
