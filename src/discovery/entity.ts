import {corporateDomain,normalizeCompanyName} from '../enrichment/company.js';
import type {ResultKind} from './classification.js';

export type CompanyCandidate={name:string;normalizedName:string;domain?:string;sourceUrl:string;confidence:number;metadata:Record<string,unknown>};
export function entityFromResult(input:{title:string;url:string;kind:ResultKind;confidence:number;description?:string}):CompanyCandidate|undefined{
  if(input.kind!=='COMPANY_WEBSITE')return undefined;
  const domain=corporateDomain(input.url); if(!domain)return undefined;
  const name=input.title.replace(/\s*[|–-]\s*.+$/,'').replace(/\s+(sitio oficial|p[aá]gina oficial)$/i,'').trim();
  if(name.length<2)return undefined;
  return{name,normalizedName:normalizeCompanyName(name),domain,sourceUrl:input.url,confidence:input.confidence,metadata:{description:input.description??'',classification:input.kind}};
}
