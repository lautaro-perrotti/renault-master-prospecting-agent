import type {Config} from '../config.js';
import type {DiscoveryProvider,DiscoveryResult} from './types.js';

export function parseBraveResults(data:unknown,query:string,location:string):DiscoveryResult[]{
  const results=(data as {web?:{results?:Array<Record<string,unknown>>}})?.web?.results??[];
  return results.flatMap(item=>{const url=typeof item.url==='string'?item.url:'';const title=typeof item.title==='string'?item.title:'Sin tÃ­tulo';if(!url)return[];return[{name:title,website:url,sourceType:'WEB_SEARCH',sourceUrl:url,metadata:{description:typeof item.description==='string'?item.description:'',query,location}}]});
}
export class BraveSearchProvider implements DiscoveryProvider{readonly name='brave-search';constructor(private readonly config:Config){}async search(query:string,location:string){if(!this.config.BRAVE_SEARCH_API_KEY)throw new Error('NOT_CONFIGURED: BRAVE_SEARCH_API_KEY');const u=new URL('https://api.search.brave.com/res/v1/web/search');u.searchParams.set('q',location?`${query} ${location}`:query);u.searchParams.set('country','AR');u.searchParams.set('search_lang','es');const response=await fetch(u,{headers:{Accept:'application/json','X-Subscription-Token':this.config.BRAVE_SEARCH_API_KEY}});if(!response.ok)throw new Error(`Brave Search HTTP_${response.status}: ${(await response.text()).slice(0,240)}`);return parseBraveResults(await response.json(),query,location)}}
