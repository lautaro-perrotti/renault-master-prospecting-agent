import type {Config} from '../config.js';
import {renderTransportIntroV1,TRANSPORT_INTRO_TEMPLATE} from './templates/transport-intro-v1.js';

export type ServiceProfile={vehicle:string;temperatureCapability:string;baseLocation:string;coverage:string[];availability:string;cargoTypes:string[];certifications:string[];documentation:string[];contactPerson:string;phone:string;videoUrl:string};

export function composeEmail(company:string,email:string,evidence:string[],profile:ServiceProfile,config:Config){
  if(config.EMAIL_TEMPLATE!==TRANSPORT_INTRO_TEMPLATE)throw new Error(`UNSUPPORTED_EMAIL_TEMPLATE:${config.EMAIL_TEMPLATE}`);
  const evidenceExcerpt=evidence.find(item=>item.trim())?.trim();
  if(!email||!evidenceExcerpt)throw new Error('Cannot draft without verified contact and evidence');
  return renderTransportIntroV1({companyName:company,recipientEmail:email,evidenceExcerpt,vehicle:profile.vehicle,temperatureCapability:profile.temperatureCapability,coverage:profile.coverage,senderName:profile.contactPerson||config.SENDER_NAME,senderPhone:profile.phone||config.SENDER_PHONE,senderEmail:config.SENDER_EMAIL});
}
