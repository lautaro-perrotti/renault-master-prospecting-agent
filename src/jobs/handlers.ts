import type {Config} from '../config.js';
import type {Db} from '../db/client.js';
import type {JobDependencies} from './dependencies.js';
import {discoveryHandler} from './handlers/discovery-handler.js';
import {crawlHandler} from './handlers/crawl-handler.js';
import {researchHandler} from './handlers/research-handler.js';
import {qualifyHandler} from './handlers/qualify-handler.js';
import {draftHandler} from './handlers/draft-handler.js';
import {sendHandler} from './handlers/send-handler.js';
import {replyPollHandler,followupHandler} from './handlers/reply-handler.js';
import {sheetsHandler} from './handlers/sheets-handler.js';

export function createJobHandler(db:Db,config:Config,deps:JobDependencies={}){return async(job:any)=>{
  switch(job.type){
    case'DISCOVERY':return discoveryHandler(db,config,job,deps);
    case'CRAWL':return crawlHandler(db,config,job,deps);
    case'RESEARCH':return researchHandler(db,config,job,deps);
    case'ENRICH':return researchHandler(db,config,job,deps);
    case'QUALIFY':return qualifyHandler(db,config,job,deps);
    case'DRAFT':return draftHandler(db,config,job,deps);
    case'SEND':return sendHandler(db,config,job,deps);
    case'CHECK_REPLIES':return replyPollHandler(db,config,job,deps);
    case'FOLLOW_UP':return followupHandler(db,config,job,deps);
    case'SHEETS_SYNC':return sheetsHandler(db,config,job,deps);
    default:throw new Error(`Unsupported job type ${job.type}`);
  }
}}
export async function handleJob(db:Db,config:Config,job:any){return createJobHandler(db,config)(job)}
