import 'dotenv/config';
import {sql} from 'drizzle-orm';
import {loadConfig} from '../src/config.js';
import {closeDb,createDb} from '../src/db/client.js';
import {migrate} from '../src/db/migrate.js';
import {audit} from '../src/audit.js';
import {GmailClient} from '../src/outreach/gmail.js';
import {renderTransportIntroV1} from '../src/outreach/templates/transport-intro-v1.js';

const recipient='lautaroperrotti@gmail.com';
const logicalMessageId='test:template:general:lautaroperrotti';
const companyName='Distribuidora Ficticia';

if(!process.argv.includes('--confirm-test-send'))throw new Error('TEST_SEND_REQUIRES_CONFIRMATION');

const config=loadConfig(),client=createDb(config);
try{
  await migrate(client.pool);
  const gmail=new GmailClient(config);
  const existing=await gmail.findByIdempotencyKey?.(logicalMessageId);
  if(existing?.messageId){console.log(JSON.stringify({mode:'ALREADY_SENT',recipient,logicalMessageId,gmailMessageId:existing.messageId},null,2));process.exit(0)}
  const rendered=renderTransportIntroV1({companyName,recipientEmail:recipient,evidenceExcerpt:'Vi que realizan distribución a comercios en CABA y GBA.',vehicle:'4 Renault Master',coverage:config.SERVICE_COVERAGE.split(',').map(value=>value.trim()).filter(Boolean),senderName:config.SENDER_NAME,senderPhone:config.SENDER_PHONE,senderEmail:config.SENDER_EMAIL,showRefrigerationCapability:true,subjectVariant:'GENERAL'});
  const sent=await gmail.send({to:rendered.to,subject:rendered.subject,body:rendered.body,htmlBody:rendered.htmlBody,idempotencyKey:logicalMessageId});
  await audit(client.db,'EMAIL_TEST_SENT',{logicalMessageId,recipient,companyName,subject:rendered.subject,gmailMessageId:sent.messageId??null});
  await client.db.execute(sql`INSERT INTO configuration(key,value) VALUES('LAST_EMAIL_TEST_SENT',${new Date().toISOString()}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  console.log(JSON.stringify({mode:'TEST_SENT',recipient,companyName,subject:rendered.subject,logicalMessageId,gmailMessageId:sent.messageId??null,previewMarkersPresent:/\[PREVIEW\]/i.test(`${rendered.subject}\n${rendered.body}`)},null,2));
}catch(error){console.error(`EMAIL_TEST_SEND_FAILED: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}finally{await closeDb(client)}
