const SUBJECTS=new Set(['Contacto comercial | Distribución y reparto','Contacto comercial | Transporte refrigerado y congelado']);
const GENERIC_COMPANY_NAMES=new Set(['inicio','nosotros','productos','contacto','menu','menú','servicios','home','carrito']);
const REQUIRED_TEXT=['Desde R&M hermanos brindamos servicios de distribución y reparto para empresas en CABA y GBA,','Podemos asignar una unidad de uso exclusivo para su empresa,','Contamos con una unidad con capacidad para transportar productos refrigerados y congelados.','O simplemente respondan este correo y seguimos por acá.','Si prefieren no recibir nuevos mensajes de nuestra parte, respondan indicando "No contactar".'];
const BAD_BODY_MARKERS=[/CONFIGURAR/i,/CABA y GBA y AMBA/i,/flota de Renault Master refrigerada/i];
const BAD_EVIDENCE_MARKERS=[/La página publica|La pagina publica/i,/mailto:/i,/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,/HAGA SU PEDIDO/i,/NOSOTROS\s+SERVICIOS/i,/Proveedores\s+Nosotros/i,/\b(?:Menú|Menu|Rastreo|Mi carrito|Burakko)\b/i];

export type PreparedMessageForPreflight={companyName?:unknown;toEmail?:unknown;subject?:unknown;body?:unknown;htmlBody?:unknown};

export function validatePreparedMessage(message:PreparedMessageForPreflight){
  const issues:string[]=[];
  const companyName=String(message.companyName??'').trim();
  const toEmail=String(message.toEmail??'').trim();
  const subject=String(message.subject??'').trim();
  const body=String(message.body??'');
  const htmlBody=String(message.htmlBody??'');
  if(!companyName)issues.push('MISSING_COMPANY');
  if(GENERIC_COMPANY_NAMES.has(companyName.toLocaleLowerCase('es-AR')))issues.push('GENERIC_COMPANY_NAME');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail))issues.push('INVALID_RECIPIENT');
  if(!SUBJECTS.has(subject))issues.push('UNEXPECTED_SUBJECT');
  for(const required of REQUIRED_TEXT)if(!body.includes(required))issues.push(`MISSING_TEXT:${required.slice(0,24)}`);
  for(const marker of BAD_BODY_MARKERS)if(marker.test(body))issues.push(`BAD_BODY:${marker.source}`);
  const evidence=body.split(/\r?\n\r?\n/)[1]?.trim()??'';
  if(!evidence||evidence.length>240)issues.push('INVALID_EVIDENCE_LENGTH');
  for(const marker of BAD_EVIDENCE_MARKERS)if(marker.test(evidence))issues.push(`BAD_EVIDENCE:${marker.source}`);
  if(!body.includes('rymhermanos.com.ar'))issues.push('MISSING_WEBSITE');
  if(!body.includes('wa.me/541160397716'))issues.push('MISSING_WHATSAPP');
  if(htmlBody&&/CONFIGURAR|CABA y GBA y AMBA|La página publica|HAGA SU PEDIDO|NOSOTROS\s+SERVICIOS/i.test(htmlBody))issues.push('BAD_HTML');
  return [...new Set(issues)];
}
