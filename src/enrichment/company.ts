const platformDomains=new Set(['instagram.com','facebook.com','linkedin.com','x.com','twitter.com','tiktok.com','youtube.com']);

export function normalizeCompanyName(value:string){
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}

export function normalizeDomain(value?:string){
  if(!value)return undefined;
  try{
    const url=value.includes('://')?new URL(value):new URL(`https://${value}`);
    const host=url.hostname.replace(/^www\./,'').toLowerCase();
    return host&&host.includes('.')?host:undefined;
  }catch{return undefined}
}

export function isPlatformDomain(value?:string){const domain=normalizeDomain(value);return Boolean(domain&&[...platformDomains].some(platform=>domain===platform||domain.endsWith(`.${platform}`)))}
export function corporateDomain(value?:string){const domain=normalizeDomain(value);return domain&&!isPlatformDomain(domain)?domain:undefined}
export function socialNetwork(value?:string){
  const domain=normalizeDomain(value); if(!domain)return undefined;
  if(domain==='instagram.com'||domain.endsWith('.instagram.com'))return'INSTAGRAM';
  if(domain==='facebook.com'||domain.endsWith('.facebook.com'))return'FACEBOOK';
  if(domain==='linkedin.com'||domain.endsWith('.linkedin.com'))return'LINKEDIN';
  if(domain==='x.com'||domain==='twitter.com')return'X';
  if(domain==='tiktok.com'||domain.endsWith('.tiktok.com'))return'TIKTOK';
  if(domain==='youtube.com'||domain.endsWith('.youtube.com'))return'YOUTUBE';
  return undefined;
}
