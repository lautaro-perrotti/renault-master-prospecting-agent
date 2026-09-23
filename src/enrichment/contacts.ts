const emailPattern=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const emailGlobalPattern=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phonePattern=/(?:\+?\d[\d\s().-]{7,}\d)/g;
const priority=['logistica','logística','ventas','comercial','operaciones','contacto','info','administracion','administración'];
export type VerificationStatus='PUBLICLY_OBSERVED'|'SYNTAX_VALID'|'DOMAIN_VALID'|'MX_VALID'|'DELIVERY_VALIDATED';
export type ContactFinding={email?:string;phone?:string;kind:'email'|'phone';sourceUrl:string;priority:number;verificationStatus:VerificationStatus};
export function normalizeEmail(value:string){return value.trim().toLowerCase()}
export function validEmail(value:string){return emailPattern.test(value.trim())}
export function extractContacts(text:string,sourceUrl:string){
  const findings:ContactFinding[]=[];
  const mailto=(text.match(/mailto:([^\s"'>]+)/gi)??[]).map(x=>x.replace(/^mailto:/i,''));
  const emails=[...new Set([...(text.match(emailGlobalPattern)??[]),...mailto])]
    .map(normalizeEmail).filter(validEmail);
  for(const email of emails){const local=email.split('@')[0];const p=priority.indexOf(local);findings.push({email,kind:'email',sourceUrl,priority:p>=0?p:priority.length,verificationStatus:'SYNTAX_VALID'})}
  for(const phone of [...new Set(text.match(phonePattern)??[])])findings.push({phone:phone.trim(),kind:'phone',sourceUrl,priority:99,verificationStatus:'PUBLICLY_OBSERVED'});
  return findings.sort((a,b)=>a.priority-b.priority);
}
