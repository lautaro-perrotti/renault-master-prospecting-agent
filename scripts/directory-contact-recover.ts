import 'dotenv/config';
import {load} from 'cheerio';
import {sql} from 'drizzle-orm';
import {loadConfig} from '../src/config.js';
import {closeDb,createDb} from '../src/db/client.js';
import {migrate} from '../src/db/migrate.js';
import {audit} from '../src/audit.js';
import {normalizeCompanyName,normalizeDomain} from '../src/enrichment/company.js';
import {normalizeEmail,validEmail} from '../src/enrichment/contacts.js';

const sourceUrl='https://cammesaweb.cammesa.com/listado-generadores-comerc-distribuidores/';
type DirectoryRow={name:string;normalizedName:string;emails:string[]};

async function readRows(){
  const response=await fetch(sourceUrl);
  if(!response.ok)throw new Error(`DIRECTORY_FETCH_FAILED:${response.status}`);
  const $=load(await response.text());
  const rows:DirectoryRow[]=[];
  $('tr').each((_,element)=>{
    const name=$(element).find('.column-1').first().text().trim();
    const emails=[...new Set($(element).find('a[href^="mailto:"]').map((__,link)=>normalizeEmail(String($(link).attr('href')??'').replace(/^mailto:/i,'').split('?')[0])).get().filter(email=>validEmail(email)))];
    if(name&&emails.length)rows.push({name,normalizedName:normalizeCompanyName(name),emails});
  });
  return rows;
}

const config=loadConfig(),client=createDb(config),apply=process.argv.includes('--apply');
try{
  await migrate(client.pool);
  const rows=await readRows(),emails=[...new Set(rows.flatMap(row=>row.emails))];
  if(!apply)console.log(JSON.stringify({mode:'DRY_RUN',sourceUrl,companies:rows.length,emails:emails.length,sample:rows.slice(0,8)},null,2));
  else{
    const run=(await client.db.execute(sql`INSERT INTO runs(type,status,metadata) VALUES('DIRECTORY_CONTACT_RECOVERY','RUNNING',${JSON.stringify({sourceUrl})}::jsonb) RETURNING id`)).rows[0] as any;
    let companiesCreated=0,contactsRecovered=0;
    for(const row of rows){
      let company=(await client.db.execute(sql`SELECT id,status FROM companies WHERE normalized_name=${row.normalizedName} ORDER BY created_at LIMIT 1`)).rows[0] as any;
      if(!company){
        const domain=normalizeDomain(row.emails[0].split('@')[1]);
        const domainInUse=domain?Boolean((await client.db.execute(sql`SELECT 1 FROM companies WHERE domain=${domain} LIMIT 1`)).rows[0]):false;
        company=(await client.db.execute(sql`INSERT INTO companies(name,normalized_name,domain,website,status) VALUES(${row.name},${row.normalizedName},${domainInUse?null:domain},${sourceUrl},'DISCOVERED') RETURNING id,status`)).rows[0];
        companiesCreated++;
      }
      await client.db.execute(sql`INSERT INTO sources(company_id,source_type,url,metadata) VALUES(${String(company.id)},'PUBLIC_DIRECTORY',${sourceUrl},${JSON.stringify({parser:'mailto-row',companyName:row.name})}::jsonb) ON CONFLICT(company_id,url) DO UPDATE SET metadata=excluded.metadata`);
      for(const email of row.emails){
        await client.db.execute(sql`INSERT INTO contacts(company_id,email,kind,role,source_url,verification_status,verified,invalid) VALUES(${String(company.id)},${email},'email','UNKNOWN',${sourceUrl},'SYNTAX_VALID',false,false) ON CONFLICT(company_id,email) DO UPDATE SET source_url=excluded.source_url,verification_status='SYNTAX_VALID',verified=false,invalid=false`);
        await client.db.execute(sql`INSERT INTO evidence(company_id,source_type,source_url,title,excerpt,signal_type,confidence) VALUES(${String(company.id)},'PUBLIC_DIRECTORY',${sourceUrl},${`Email público de ${row.name}`},${`La página publica ${email} como contacto de ${row.name}.`},'PUBLIC_CONTACT',85) ON CONFLICT DO NOTHING`);
        contactsRecovered++;
      }
      await audit(client.db,'DIRECTORY_CONTACT_RECOVERED',{sourceUrl,companyName:row.name,emails:row.emails},String(company.id),undefined,String(run.id));
    }
    const synthetic=(await client.db.execute(sql`SELECT id FROM companies WHERE normalized_name=${normalizeCompanyName('Listado Generadores, Comerc. Distribuidores')} LIMIT 1`)).rows[0] as any;
    let superseded=0;
    if(synthetic){
      const result=await client.db.execute(sql`UPDATE contacts SET invalid=true,verified=false WHERE company_id=${String(synthetic.id)} AND source_url=${sourceUrl} AND invalid=false`);
      superseded=Number(result.rowCount??0);
      await audit(client.db,'CONTACT_DATA_SUPERSEDED',{sourceUrl,count:superseded,reason:'REPLACED_BY_STRUCTURED_DIRECTORY_ROWS'},String(synthetic.id),undefined,String(run.id));
    }
    await client.db.execute(sql`UPDATE runs SET status='DONE',finished_at=now(),metadata=${JSON.stringify({sourceUrl,companies:rows.length,companiesCreated,contactsRecovered,superseded})}::jsonb WHERE id=${String(run.id)}`);
    console.log(JSON.stringify({mode:'APPLY',sourceUrl,companies:rows.length,companiesCreated,contactsRecovered,superseded,note:'No se enviaron correos.'},null,2));
  }
}catch(error){console.error(`DIRECTORY_CONTACT_RECOVERY_FAILED: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}finally{await closeDb(client)}
