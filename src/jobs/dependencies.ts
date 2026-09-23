import type {Config} from '../config.js';
import type {DiscoveryProvider} from '../discovery/types.js';
import type {ResearchProvider} from '../qualification/ai-research.js';
import type {GmailTransport} from '../outreach/gmail.js';
import type {SheetProjectionService} from '../integrations/sheets-projection.js';
import type {WebsiteCrawler} from '../crawler/website.js';
import type {Notifier} from '../telegram/notifier.js';
import type {ReplyClassification} from '../replies/classifier.js';

export type JobDependencies={providers?:DiscoveryProvider[];research?:ResearchProvider;gmail?:GmailTransport;sheets?:SheetProjectionService;crawler?:Pick<WebsiteCrawler,'crawl'>;notifier?:Notifier;classifyReply?:(text:string)=>Promise<ReplyClassification>|ReplyClassification};
export function defaultDependencies(_config:Config):JobDependencies{return{}}
