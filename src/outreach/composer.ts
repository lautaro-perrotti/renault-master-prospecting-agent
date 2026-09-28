import type {Config} from '../config.js';
import {renderTransportIntroV1,TRANSPORT_INTRO_TEMPLATE} from './templates/transport-intro-v1.js';

export type ServiceProfile={vehicle:string;temperatureCapability:string;baseLocation:string;coverage:string[];availability:string;cargoTypes:string[];certifications:string[];documentation:string[];contactPerson:string;phone:string;videoUrl:string;showRefrigerationCapability?:boolean;subjectVariant?:'GENERAL'|'COLD_CHAIN';logoUrl?:string};

export function emailEvidence(excerpts:string[]){
  const raw=excerpts.find(item=>item.trim())?.trim();
  if(!raw)throw new Error('Cannot draft without verified contact and evidence');
  if(raw.length>240||/p[aá]gina\s+(?:p[uú]blica|publica).*contacto|contacto.*p[aá]gina|mailto:|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:nosotros|productos|proveedores|menu|menú|inicio|categor[ií]as|rastreo|mi carrito|haga su pedido|burakko|donde estamos)\b/i.test(raw))return'Vi que realizan distribución y reparto para empresas en CABA y GBA.';
  return raw;
}

export function composeEmail(company:string,email:string,evidence:string[],profile:ServiceProfile,config:Config){
  if(config.EMAIL_TEMPLATE!==TRANSPORT_INTRO_TEMPLATE)throw new Error(`UNSUPPORTED_EMAIL_TEMPLATE:${config.EMAIL_TEMPLATE}`);
  const evidenceExcerpt=emailEvidence(evidence);
  if(!email)throw new Error('Cannot draft without verified contact and evidence');
  return renderTransportIntroV1({companyName:company,recipientEmail:email,evidenceExcerpt,vehicle:profile.vehicle,temperatureCapability:profile.temperatureCapability,coverage:profile.coverage,senderName:profile.contactPerson||config.SENDER_NAME,senderPhone:profile.phone||config.SENDER_PHONE,senderEmail:config.SENDER_EMAIL,showRefrigerationCapability:profile.showRefrigerationCapability,subjectVariant:profile.subjectVariant,logoUrl:profile.logoUrl||config.EMAIL_LOGO_URL});
}
