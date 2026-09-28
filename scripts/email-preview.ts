import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {renderProspectingEmail} from '../src/outreach/templates/prospecting-email.js';

const common={senderName:'R&M hermanos',senderEmail:'rymhermanos.logistica@gmail.com',senderPhone:'1160397716',whatsappUrl:'https://wa.me/541160397716?text=Hola%2C%20quer%C3%ADa%20consultar%20por%20los%20servicios%20de%20log%C3%ADstica%20de%20R%26M%20hermanos',showRefrigerationCapability:true,subjectVariant:'GENERAL' as const,capabilities:['Unidad exclusiva','Carga seca, refrigerada o congelada','Permanente o por hora']};
const variants=[
  {name:'GENERAL_TRANSPORT',data:{...common,companyName:'Distribuidora Ejemplo [PREVIEW]',recipientGreeting:'equipo de Distribuidora Ejemplo [PREVIEW]',personalizedEvidence:'Vi que realizan distribuci\u00f3n a comercios en CABA y GBA.'}},
  {name:'COLD_CHAIN',data:{...common,companyName:'Frigor\u00edfico Ejemplo [PREVIEW]',recipientGreeting:'equipo de Frigor\u00edfico Ejemplo [PREVIEW]',personalizedEvidence:'Vi que trabajan con productos congelados y distribuci\u00f3n en AMBA.',showRefrigerationCapability:true,subjectVariant:'COLD_CHAIN' as const}},
  {name:'OUTSOURCING_SIGNAL',data:{...common,companyName:'Operador Ejemplo [PREVIEW]',recipientGreeting:'equipo de Operador Ejemplo [PREVIEW]',personalizedEvidence:'Vi que est\u00e1n incorporando fleteros para reforzar su operaci\u00f3n de distribuci\u00f3n.',ctaQuestion:'\u00bfSiguen incorporando proveedores de transporte?'}}
];
function bodyOf(html:string){return html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1]??html}
const sections=variants.map(variant=>{const rendered=renderProspectingEmail(variant.data);return`<section><h2>${variant.name}</h2><p><strong>Asunto:</strong> ${rendered.subject}</p>${bodyOf(rendered.htmlBody)}</section>`}).join('');
const page=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview email R&amp;M hermanos</title><style>body{margin:0;background:#e9edf3;font-family:Arial,Helvetica,sans-serif}main{max-width:720px;margin:0 auto;padding:24px 12px}h1{color:#08254A;font-size:22px}h2{color:#08254A;font-size:16px;border-bottom:1px solid #ccd5e2;padding-bottom:8px;margin:28px 0 0}section>table{margin-top:0!important}</style></head><body><main><h1>PREVIEW - R&amp;M hermanos email template</h1><p>Datos ficticios. Esta pagina no envia emails.</p>${sections}</main></body></html>`;
const output=path.resolve('dev/email-preview.html');
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,page,'utf8');
console.log(JSON.stringify({preview:output,variants:variants.map(variant=>variant.name),sent:false}));
