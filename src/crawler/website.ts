import * as cheerio from 'cheerio';
import {chromium,type Browser} from 'playwright';
import type {Config} from '../config.js';

const valuable=['contact','contacto','about','empresa','nosotros','servicio','producto','distribu','logistica','logística','mayorista','entrega','sucursal','frio','frío','congel'];
export type PageSnapshot={url:string;title:string;text:string;status:number;sourceType:'HTTP'|'PLAYWRIGHT';links:string[];contactSignals:string[];businessSignals:string[];observedAt:string};
function scoreLink(url:string){const lower=url.toLowerCase();return valuable.reduce((score,term)=>score+(lower.includes(term)?2:0),0)}
function signals(text:string){const lower=text.toLowerCase();return{contactSignals:[...(lower.match(/ventas|contacto|whatsapp|mailto:|tel[eé]fono|tel\.?/g)??[])],businessSignals:[...(lower.match(/refriger|congel|distribu|entrega|mayorista|log[ií]stica|cadena de fr[ií]o/g)??[])]}}

export class WebsiteCrawler{
  constructor(private config:Config){}
  async crawl(base:string){
    const root=new URL(base);const queue=[root.href];const seen=new Set<string>();const pages:PageSnapshot[]=[];let browser:Browser|undefined;
    try{
      while(queue.length&&pages.length<this.config.MAX_PAGES_PER_DOMAIN){
        const candidate=queue.shift()!;if(seen.has(candidate))continue;seen.add(candidate);
        try{
          const response=await fetch(candidate,{redirect:'follow',signal:AbortSignal.timeout(10000)});const html=await response.text();const $=cheerio.load(html);const text=$('body').text().replace(/\s+/g,' ').trim();
          const links=[...new Set($('a[href]').map((_,el)=>{try{const href=$(el).attr('href');return href?new URL(href,root).href:undefined}catch{return undefined}}).get().filter((url):url is string=>Boolean(url&&new URL(url).hostname===root.hostname)))];
          const signal=signals(text);pages.push({url:response.url||candidate,title:$('title').text().trim()||candidate,text,status:response.status,sourceType:'HTTP',links,contactSignals:signal.contactSignals,businessSignals:signal.businessSignals,observedAt:new Date().toISOString()});
          for(const link of links.sort((a,b)=>scoreLink(b)-scoreLink(a)))if(!seen.has(link))queue.push(link);
          if(response.ok&&text.length<80){browser??=await chromium.launch({headless:true});pages.push(await this.browserPage(browser,response.url||candidate))}
        }catch{continue}
      }
      return pages;
    }finally{if(browser)await browser.close()}
  }
  private async browserPage(browser:Browser,url:string):Promise<PageSnapshot>{const page=await browser.newPage();try{const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});const text=(await page.locator('body').innerText()).replace(/\s+/g,' ').trim();const signal=signals(text);return{url,title:await page.title(),text,status:response?.status()??0,sourceType:'PLAYWRIGHT',links:[],contactSignals:signal.contactSignals,businessSignals:signal.businessSignals,observedAt:new Date().toISOString()}}finally{await page.close()}}
}
