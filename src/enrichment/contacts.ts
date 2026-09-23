const emailPattern=/\b[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.(?:com\.ar|net\.ar|org\.ar|gov\.ar|edu\.ar|com|net|org|ar|io|co|biz|info|app|dev)(?![A-Z0-9.])/i;
const emailGlobalPattern=/\b[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.(?:com\.ar|net\.ar|org\.ar|gov\.ar|edu\.ar|com|net|org|ar|io|co|biz|info|app|dev)(?![A-Z0-9.])/gi;
const phonePattern=/(?:\+?\d[\d\s().-]{7,}\d)/g;
const priority=['logistica','logística','ventas','comercial','operaciones','contacto','info','administracion','administración'];
export type VerificationStatus='PUBLICLY_OBSERVED'|'SYNTAX_VALID'|'DOMAIN_VALID'|'MX_VALID'|'DELIVERY_VALIDATED';
export type ContactFinding={email?:string;phone?:string;kind:'email'|'phone';sourceUrl:string;priority:number;verificationStatus:VerificationStatus};
export function normalizeEmail(value:string){
  const normalized=value.trim().toLowerCase();
  const [local,domain]=normalized.split('@');
  const labelPrefixes=['escribinos','email','mail'];
  const cleanedLocal=labelPrefixes.reduce((candidate,prefix)=>candidate.startsWith(prefix)&&candidate.length>prefix.length+2?candidate.slice(prefix.length):candidate,local);
  return domain?`${cleanedLocal}@${domain}`:normalized;
}
export function validEmail(value:string){return emailPattern.test(value.trim())}
export function normalizePhone(value:string){return value.replace(/[^\d+]/g,'')}
function validPhone(value:string){const trimmed=value.trim();if(/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed))return false;const digits=trimmed.replace(/\D/g,'');return digits.length>=8&&digits.length<=15}
export function extractContacts(text:string,sourceUrl:string){
  const findings:ContactFinding[]=[];
  const mailto=(text.match(/mailto:([^\s"'>]+)/gi)??[]).map(x=>x.replace(/^mailto:/i,''));
  const emails=[...new Set([...(text.match(emailGlobalPattern)??[]),...mailto])]
    .map(normalizeEmail).filter(validEmail);
  for(const email of emails){const local=email.split('@')[0];const p=priority.indexOf(local);findings.push({email,kind:'email',sourceUrl,priority:p>=0?p:priority.length,verificationStatus:'SYNTAX_VALID'})}
  for(const phone of [...new Set((text.match(phonePattern)??[]).filter(validPhone).map(normalizePhone))])findings.push({phone,kind:'phone',sourceUrl,priority:99,verificationStatus:'PUBLICLY_OBSERVED'});
  return findings.sort((a,b)=>a.priority-b.priority);
}
