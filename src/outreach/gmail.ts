import {google,type gmail_v1} from 'googleapis';
import type {Config} from '../config.js';
import {Buffer} from 'node:buffer';

export type GmailMessage={id:string;threadId?:string;from?:string;to?:string;subject?:string;body:string;internalDate?:string;idempotencyKey?:string};
export type OutboundMessage={to:string;subject:string;body:string;threadId?:string;inReplyTo?:string;idempotencyKey:string};
export interface GmailTransport{send(input:OutboundMessage):Promise<{messageId?:string;threadId?:string}>;listInbox():Promise<Array<{id?:string}>>;getMessage(id:string):Promise<GmailMessage>;findByIdempotencyKey?(key:string):Promise<{messageId?:string;threadId?:string}|undefined>;getProfile?():Promise<unknown>}

function decode(data?:string){if(!data)return'';return Buffer.from(data.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')}
function bodyFromPart(part:gmail_v1.Schema$MessagePart|undefined):string{
  if(!part)return'';
  if(part.mimeType==='text/plain'&&part.body?.data)return decode(part.body.data);
  if(part.mimeType==='text/html'&&part.body?.data)return decode(part.body.data);
  return (part.parts??[]).map(bodyFromPart).find(Boolean)??'';
}
export class GmailClient implements GmailTransport{
  private gmail:gmail_v1.Gmail;
  constructor(private config:Config){if(!config.GOOGLE_CLIENT_ID||!config.GOOGLE_CLIENT_SECRET||!config.GOOGLE_REFRESH_TOKEN)throw new Error('NOT_CONFIGURED: Gmail OAuth');const auth=new google.auth.OAuth2(config.GOOGLE_CLIENT_ID,config.GOOGLE_CLIENT_SECRET);auth.setCredentials({refresh_token:config.GOOGLE_REFRESH_TOKEN});this.gmail=google.gmail({version:'v1',auth})}
  async send(input:OutboundMessage){const headers=[`To: ${input.to}`,`Subject: ${input.subject}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=utf-8',`X-Renault-Idempotency-Key: ${input.idempotencyKey}`,input.inReplyTo?`In-Reply-To: ${input.inReplyTo}`:''];const raw=[...headers,'',input.body].join('\r\n');const response=await this.gmail.users.messages.send({userId:'me',requestBody:{raw:Buffer.from(raw).toString('base64url'),threadId:input.threadId}});return{messageId:response.data.id??undefined,threadId:response.data.threadId??undefined}}
  async listInbox(){const response=await this.gmail.users.messages.list({userId:'me',q:'in:anywhere newer_than:30d -from:me'});return (response.data.messages??[]).map(message=>({id:message.id??undefined}))}
  async getMessage(id:string):Promise<GmailMessage>{const response=await this.gmail.users.messages.get({userId:'me',id,format:'full'});const payload=response.data.payload;const headers=Object.fromEntries((payload?.headers??[]).map(header=>[String(header.name).toLowerCase(),header.value??'']));return{id,threadId:response.data.threadId??undefined,from:headers.from,to:headers.to,subject:headers.subject,body:bodyFromPart(payload),internalDate:response.data.internalDate??undefined,idempotencyKey:headers['x-renault-idempotency-key']}}
  async findByIdempotencyKey(key:string){const response=await this.gmail.users.messages.list({userId:'me',q:'in:sent newer_than:30d'});for(const item of response.data.messages??[]){if(!item.id)continue;const message=await this.getMessage(item.id);if(message.idempotencyKey===key)return{messageId:message.id,threadId:message.threadId}}return undefined}
  async getProfile(){return (await this.gmail.users.getProfile({userId:'me'})).data}
}
