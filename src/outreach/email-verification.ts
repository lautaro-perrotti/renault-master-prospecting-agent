import {resolve4,resolve6,resolveMx} from 'node:dns/promises';
import {validEmail} from '../enrichment/contacts.js';

export type EmailDnsVerification='MX_VALID'|'DOMAIN_VALID'|'DNS_UNVERIFIED';
export type EmailDnsResult={email:string;domain:string;status:EmailDnsVerification;mxHosts:string[];errorCode?:string};

function code(error:unknown){return error&&typeof error==='object'&&'code' in error?String((error as {code?:unknown}).code??'UNKNOWN'):'UNKNOWN'}
async function hasAddress(domain:string){try{return (await resolve4(domain)).length>0}catch{}try{return (await resolve6(domain)).length>0}catch{return false}}

export async function verifyEmailDomain(email:string):Promise<EmailDnsResult>{
  const normalized=email.trim().toLowerCase(),at=normalized.lastIndexOf('@'),domain=at>0?normalized.slice(at+1):'';
  if(!domain||!validEmail(normalized))return{email:normalized,domain,status:'DNS_UNVERIFIED',mxHosts:[],errorCode:'INVALID_EMAIL_SYNTAX'};
  try{
    const records=await resolveMx(domain),mxHosts=records.sort((a,b)=>a.priority-b.priority).map(record=>record.exchange.toLowerCase());
    if(mxHosts.length)return{email:normalized,domain,status:'MX_VALID',mxHosts};
    return{email:normalized,domain,status:'DNS_UNVERIFIED',mxHosts,errorCode:'NO_MX_RECORD'};
  }catch(error){
    const errorCode=code(error);
    if(['ENODATA','ENOTFOUND','SERVFAIL'].includes(errorCode)&&await hasAddress(domain))return{email:normalized,domain,status:'DOMAIN_VALID',mxHosts:[],errorCode:'NO_MX_RECORD_DOMAIN_RESOLVES'};
    return{email:normalized,domain,status:'DNS_UNVERIFIED',mxHosts:[],errorCode};
  }
}
