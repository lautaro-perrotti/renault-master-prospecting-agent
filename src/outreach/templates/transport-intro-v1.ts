import {z} from 'zod';

export const TRANSPORT_INTRO_TEMPLATE='transport-intro-v1';

const TemplateInput=z.object({
  companyName:z.string().trim().min(1),
  recipientEmail:z.string().email(),
  evidenceExcerpt:z.string().trim().min(1),
  vehicle:z.string().trim().min(1),
  temperatureCapability:z.string().trim().optional().default(''),
  coverage:z.array(z.string().trim().min(1)).min(1),
  senderName:z.string().trim().min(1),
  senderPhone:z.string().trim().optional().default('')
});

export type TransportIntroTemplateInput=z.input<typeof TemplateInput>;

export function renderTransportIntroV1(input:TransportIntroTemplateInput){
  const data=TemplateInput.parse(input);
  const coverage=data.coverage.join(', ');
  const capability=data.temperatureCapability?` Podemos trabajar con capacidad ${data.temperatureCapability}.`:'';
  const phone=data.senderPhone?`\n${data.senderPhone}`:'';
  return{
    templateKey:TRANSPORT_INTRO_TEMPLATE,
    to:data.recipientEmail,
    subject:`Capacidad de transporte para ${data.companyName}`,
    body:[
      `Hola, ${data.companyName}.`,
      '',
      `Vimos públicamente: ${data.evidenceExcerpt}`,
      '',
      `Estamos ofreciendo ${data.vehicle} para distribución y entregas en ${coverage}.${capability}`,
      'Trabajamos con mercadería seca, refrigerada o mixta según el recorrido y la configuración necesaria.',
      '',
      '¿Les sirve conversar sobre recorridos, picos de demanda o entregas que hoy tercerizan?',
      '',
      'Saludos,',
      `${data.senderName}${phone}`
    ].join('\n')
  };
}
