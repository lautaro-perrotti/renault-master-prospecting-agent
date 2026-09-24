import {describe,expect,it} from 'vitest';
import {composeEmail} from '../src/outreach/composer.js';
import {renderTransportIntroV1} from '../src/outreach/templates/transport-intro-v1.js';

const profile={vehicle:'Renault Master refrigerada',temperatureCapability:'-18 a 4 C',baseLocation:'CABA',coverage:['CABA','GBA'],availability:'configurada',cargoTypes:['alimentos'],certifications:[],documentation:[],contactPerson:'Operaciones',phone:'',videoUrl:''};
const config={SENDER_NAME:'Sender',EMAIL_TEMPLATE:'transport-intro-v1'} as any;

describe('email composition',()=>{
  it('uses persisted evidence and profile',()=>{const message=composeEmail('Empresa','logistica@empresa.com',['Distribución pública en CABA'],profile,config);expect(message.body).toContain('Distribución pública en CABA');expect(message.body).toContain('Renault Master refrigerada');expect(message.subject).toContain('Empresa')});
  it('rejects missing evidence',()=>{expect(()=>composeEmail('Empresa','a@b.com',[],profile,config)).toThrow()});
  it('rejects missing recipient',()=>{expect(()=>composeEmail('Empresa','',['evidence'],profile,config)).toThrow()});
  it('rejects an unsupported template',()=>{expect(()=>composeEmail('Empresa','a@b.com',['evidence'],profile,{...config,EMAIL_TEMPLATE:'other'})).toThrow('UNSUPPORTED_EMAIL_TEMPLATE')});
  it('validates template recipients and renders sender contact details',()=>{const message=renderTransportIntroV1({companyName:'Empresa',recipientEmail:'compras@empresa.com',evidenceExcerpt:'entregas programadas en CABA',vehicle:'Renault Master',temperatureCapability:'refrigerada',coverage:['CABA','GBA'],senderName:'R&M hnos. logistica',senderPhone:'1160397716',senderEmail:'rymhermanos.logistica@gmail.com'});expect(message.to).toBe('compras@empresa.com');expect(message.body).toContain('entregas programadas en CABA');expect(message.body).toContain('1160397716');expect(message.body).toContain('rymhermanos.logistica@gmail.com')});
});
