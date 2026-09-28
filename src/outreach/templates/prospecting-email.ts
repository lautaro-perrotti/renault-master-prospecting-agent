import {z} from 'zod';

export const PROSPECTING_EMAIL_TEMPLATE='prospecting-email-v1';
export const DEFAULT_WHATSAPP_URL='https://wa.me/541160397716?text=Hola%2C%20quer%C3%ADa%20consultar%20por%20los%20servicios%20de%20log%C3%ADstica%20de%20R%26M%20hnos.';
export const DEFAULT_VALUE_PROPOSITION='Podemos asignar una unidad de uso exclusivo para su empresa, de carga seca, refrigerada o congelada, con modalidad permanente o por hora, seg\u00fan la necesidad de la operaci\u00f3n.';
export const DEFAULT_DRIVER_SERVICE_DESCRIPTION='Adem\u00e1s, contamos con choferes capacitados para realizar recorridos extensos, entregas y cobranzas, incluso sin acompa\u00f1amiento de personal de su empresa. Cuando la operaci\u00f3n lo requiere, tambi\u00e9n pueden tratar directamente con sus clientes. Brindamos un servicio personalizado y adaptado a sus necesidades, con una persona de confianza a cargo de cada recorrido.';
export const DEFAULT_CTA_QUESTION='\u00bfActualmente trabajan con transporte tercerizado o suelen necesitar capacidad adicional para distribuci\u00f3n y reparto?';
export const DEFAULT_WEBSITE_URL='https://rymhermanos.com.ar';

const TemplateDataSchema=z.object({
  companyName:z.string().trim().min(1),
  recipientGreeting:z.string().trim().min(1),
  personalizedEvidence:z.string().trim().min(1),
  valueProposition:z.string().trim().min(1).default(DEFAULT_VALUE_PROPOSITION),
  driverServiceDescription:z.string().trim().min(1).default(DEFAULT_DRIVER_SERVICE_DESCRIPTION),
  ctaQuestion:z.string().trim().min(1).default(DEFAULT_CTA_QUESTION),
  logoUrl:z.string().url().optional(),
  whatsappUrl:z.string().url().default(DEFAULT_WHATSAPP_URL).refine(value=>{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='wa.me'},{message:'whatsappUrl must use https://wa.me'}),
  websiteUrl:z.string().url().default(DEFAULT_WEBSITE_URL),
  showRefrigerationCapability:z.boolean().default(false),
  senderName:z.string().trim().min(1),
  senderEmail:z.string().email().optional(),
  senderPhone:z.string().trim().optional().default(''),
  fleetDescription:z.string().trim().min(1).default('4 Renault Master'),
  coverageDescription:z.string().trim().min(1).default('CABA y GBA'),
  capabilities:z.array(z.string().trim().min(1)).min(1).max(3).default(['Unidad exclusiva','Carga seca, refrigerada o congelada','Permanente o por hora'])
});

export type ProspectingEmailTemplateData=z.input<typeof TemplateDataSchema>;
export type ParsedProspectingEmailTemplateData=z.output<typeof TemplateDataSchema>;

export function escapeHtml(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function safeUrl(value:string){return escapeHtml(value)}
function renderLogo(data:ParsedProspectingEmailTemplateData){const logo=data.logoUrl?`<img src="${safeUrl(data.logoUrl)}" width="180" alt="R&amp;M hermanos" style="display:block;width:180px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;">`:'<div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:30px;font-weight:700;color:#08254A;">R&amp;M hermanos</div>';return `<a href="${safeUrl(data.websiteUrl)}" target="_blank" style="display:inline-block;color:#08254A;text-decoration:none;">${logo}</a>`}
function renderCapabilities(data:ParsedProspectingEmailTemplateData){return data.capabilities.map(item=>`<td style="padding:0 4px 0 0;vertical-align:top;"><div style="border:1px solid #E5EAF1;border-radius:6px;padding:10px 8px;color:#08254A;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;text-align:center;">${escapeHtml(item)}</div></td>`).join('')}
function renderFooter(data:ParsedProspectingEmailTemplateData){return`<p style="margin:28px 0 0;color:#667085;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;">Este mensaje fue enviado porque encontramos informaci\u00f3n p\u00fablica de contacto de ${escapeHtml(data.companyName)} y consideramos que nuestros servicios podr\u00edan ser relevantes para su operaci\u00f3n.</p><p style="margin:6px 0 0;color:#667085;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;">Si prefieren no recibir nuevos mensajes de nuestra parte, respondan indicando \u201cNo contactar\u201d.</p>`}

export function renderProspectingEmailHtml(input:ProspectingEmailTemplateData){
  const data=TemplateDataSchema.parse(input);
  const refrigeration=data.showRefrigerationCapability?`<p style="margin:20px 0 0;padding:12px 14px;border-left:3px solid #1E6BD6;background:#F6F8FB;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;">Contamos con una unidad con capacidad para transportar productos refrigerados y congelados.</p>`:'';
  const email=data.senderEmail?`<br><a href="mailto:${escapeHtml(data.senderEmail)}" style="color:#1E6BD6;text-decoration:underline;">${escapeHtml(data.senderEmail)}</a>`:'';
  const phone=data.senderPhone?`<br><a href="${safeUrl(data.whatsappUrl)}" target="_blank" style="color:#1E6BD6;text-decoration:underline;">${escapeHtml(data.senderPhone)}</a>`:'';
  const website=`<br><a href="${safeUrl(data.websiteUrl)}" target="_blank" style="color:#1E6BD6;text-decoration:underline;font-weight:700;">rymhermanos.com.ar</a>`;
  return`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(`Unidad exclusiva de transporte para ${data.companyName}`)}</title></head><body style="margin:0;padding:0;background:#F6F8FB;color:#111827;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#F6F8FB;"><tr><td align="center" style="padding:28px 12px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:10px;"><tr><td style="padding:30px 34px 0;">${renderLogo(data)}<div style="height:2px;margin-top:18px;background:#1E6BD6;font-size:1px;line-height:1px;"></div></td></tr><tr><td style="padding:28px 34px 0;"><p style="margin:0 0 18px;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;">Hola ${escapeHtml(data.recipientGreeting)},</p><p style="margin:0;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;">${escapeHtml(data.personalizedEvidence)}</p><p style="margin:18px 0 0;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;">Desde <a href="${safeUrl(data.websiteUrl)}" target="_blank" style="color:#08254A;font-weight:700;text-decoration:underline;">R&amp;M hermanos</a> brindamos servicios de distribuci\u00f3n y reparto para empresas en ${escapeHtml(data.coverageDescription)}, con una flota de ${escapeHtml(data.fleetDescription)}.</p><p style="margin:12px 0 0;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;">${escapeHtml(data.valueProposition)}</p><p style="margin:12px 0 0;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;">${escapeHtml(data.driverServiceDescription)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:22px;"><tr>${renderCapabilities(data)}</tr></table>${refrigeration}<p style="margin:24px 0 0;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;">${escapeHtml(data.ctaQuestion)}</p><p style="margin:22px 0 0;"><a href="${safeUrl(data.whatsappUrl)}" target="_blank" style="display:inline-block;background:#08254A;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:5px;">Consultar disponibilidad</a></p><p style="margin:14px 0 0;color:#475467;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;">O simplemente respondan este correo y seguimos por ac\u00e1.</p><p style="margin:26px 0 0;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;">Saludos,<br><strong style="color:#08254A;">${escapeHtml(data.senderName)}</strong><br><span style="color:#475467;">Soluciones que mueven tu empresa${phone}${email}${website}<br>CABA y GBA</span></p>${renderFooter(data)}</td></tr><tr><td style="height:30px;font-size:1px;line-height:1px;"></td></tr></table></td></tr></table></body></html>`
}

export function renderProspectingEmailText(input:ProspectingEmailTemplateData){
  const data=TemplateDataSchema.parse(input);
  const capabilities=data.capabilities.join(' | ');
  const refrigeration=data.showRefrigerationCapability?'\nContamos con una unidad con capacidad para transportar productos refrigerados y congelados.\n':'';
  const signature=[data.senderName,'Soluciones que mueven tu empresa',data.senderPhone,data.senderEmail,data.websiteUrl,'CABA y GBA'].filter(Boolean).join('\n');
  return[`Hola ${data.recipientGreeting},`,'',data.personalizedEvidence,'',`Desde R&M hermanos brindamos servicios de distribuci\u00f3n y reparto para empresas en ${data.coverageDescription}, con una flota de ${data.fleetDescription}.`,data.valueProposition,data.driverServiceDescription,'',capabilities,refrigeration,data.ctaQuestion,'',`Consultar disponibilidad: ${data.whatsappUrl}`,'','O simplemente respondan este correo y seguimos por ac\u00e1.','',`Saludos,\n${signature}`,'',`Este mensaje fue enviado porque encontramos informaci\u00f3n p\u00fablica de contacto de ${data.companyName} y consideramos que nuestros servicios podr\u00edan ser relevantes para su operaci\u00f3n.`,'Si prefieren no recibir nuevos mensajes de nuestra parte, respondan indicando "No contactar".'].join('\n').replace(/\n{3,}/g,'\n\n')
}

export function renderProspectingEmail(input:ProspectingEmailTemplateData){const data=TemplateDataSchema.parse(input);const subject=data.showRefrigerationCapability?'Contacto comercial | Transporte refrigerado y congelado':'Contacto comercial | Distribución y reparto';return{templateKey:PROSPECTING_EMAIL_TEMPLATE,subject,htmlBody:renderProspectingEmailHtml(data),body:renderProspectingEmailText(data)}}
