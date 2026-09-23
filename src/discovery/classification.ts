import {corporateDomain,isPlatformDomain,socialNetwork} from '../enrichment/company.js';

export const RESULT_KINDS=['COMPANY_WEBSITE','SOCIAL_PROFILE','ARTICLE','NEWS','DIRECTORY','ASSOCIATION','JOB_POSTING','MARKETPLACE','BRAND','DOCUMENT','OTHER'] as const;
export type ResultKind=typeof RESULT_KINDS[number];

const directoryDomains=new Set(['google.com','guia.clarin.com','paginasamarillas.com.ar','yelp.com']);
const newsDomains=new Set(['lanacion.com.ar','clarin.com','infobae.com','perfil.com','ambito.com']);

export function classifySearchResult(input:{url:string;title:string;description?:string}):{kind:ResultKind;confidence:number;network?:string}{
  const domain=corporateDomain(input.url); const normalized=input.url.toLowerCase(); const text=`${input.title} ${input.description??''}`.toLowerCase();
  if(isPlatformDomain(input.url))return{kind:'SOCIAL_PROFILE',confidence:98,network:socialNetwork(input.url)};
  if(/\.(pdf|docx?|xlsx?)($|\?)/i.test(normalized))return{kind:'DOCUMENT',confidence:95};
  if([...newsDomains].some(x=>domain===x||domain?.endsWith(`.${x}`))||/noticia|news|entrevista|informe/.test(text))return{kind:'NEWS',confidence:88};
  if([...directoryDomains].some(x=>domain===x||domain?.endsWith(`.${x}`))||/directorio|gu[ií]a comercial|p[aá]ginas amarillas/.test(text))return{kind:'DIRECTORY',confidence:88};
  if(/empleo|trabajo|buscamos|vacante|chofer|repartidor/.test(text))return{kind:'JOB_POSTING',confidence:78};
  if(/marketplace|mercado libre|compr[aá] y venta/.test(text))return{kind:'MARKETPLACE',confidence:75};
  if(domain&&(/distribu|empresa|f[aá]brica|mayorista|frigor|alimentos|log[ií]stica|helado|congel/.test(text)||!input.description))return{kind:'COMPANY_WEBSITE',confidence:70};
  return{kind:'OTHER',confidence:40};
}
