import {renderProspectingEmail, type ProspectingEmailTemplateData} from './prospecting-email.js';
import {z} from 'zod';

export const TRANSPORT_INTRO_TEMPLATE='transport-intro-v1';
export type TransportIntroTemplateInput={companyName:string;recipientEmail:string;evidenceExcerpt:string;vehicle:string;temperatureCapability?:string;coverage:string[];senderName:string;senderPhone?:string;senderEmail?:string;showRefrigerationCapability?:boolean;subjectVariant?:'GENERAL'|'COLD_CHAIN';logoUrl?:string};

export function renderTransportIntroV1(input:TransportIntroTemplateInput){
  const recipientEmail=z.string().email().parse(input.recipientEmail);
  const data:ProspectingEmailTemplateData={companyName:input.companyName,recipientGreeting:`equipo de ${input.companyName}`,personalizedEvidence:input.evidenceExcerpt,valueProposition:'Podemos asignar una unidad de uso exclusivo para su empresa, de carga seca, refrigerada o congelada, con modalidad permanente o por hora, seg\u00fan la necesidad de la operaci\u00f3n.',logoUrl:input.logoUrl,showRefrigerationCapability:input.showRefrigerationCapability??true,subjectVariant:input.subjectVariant,senderName:input.senderName,senderPhone:input.senderPhone,senderEmail:input.senderEmail,fleetDescription:input.vehicle,coverageDescription:input.coverage.join(' y '),capabilities:['Unidad exclusiva','Carga seca, refrigerada o congelada','Permanente o por hora']};
  const rendered=renderProspectingEmail(data);
  return{templateKey:TRANSPORT_INTRO_TEMPLATE,to:recipientEmail,subject:rendered.subject,body:rendered.body,htmlBody:rendered.htmlBody};
}
