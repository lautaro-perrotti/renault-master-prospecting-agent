import {Bot} from 'grammy';
import type {Config} from '../config.js';
import {parseAllowedTelegramUserIds} from './bot.js';
export type NotificationEvent='HIGH_SCORE_LEAD'|'REVIEW_REQUIRED'|'EMAIL_SENT'|'REPLY_INTERESTED'|'REPLY_QUESTION'|'PROVIDER_DEGRADED'|'JOB_DEAD'|'DAILY_SUMMARY';
export interface Notifier{notify(event:NotificationEvent,message:string):Promise<void>}
export class TelegramNotifier implements Notifier{
  private bot?:Bot;
  constructor(private config:Config){if(config.TELEGRAM_BOT_TOKEN)this.bot=new Bot(config.TELEGRAM_BOT_TOKEN)}
  async sendToUser(userId:number|string,message:string){if(!this.bot)throw new Error('NOT_CONFIGURED: TELEGRAM_BOT_TOKEN');await this.bot.api.sendMessage(String(userId),message)}
  async notify(_event:NotificationEvent,message:string){if(!this.bot)return;for(const id of parseAllowedTelegramUserIds(this.config.TELEGRAM_ALLOWED_USER_IDS))await this.sendToUser(id,message)}
}
export class NullNotifier implements Notifier{async notify(){return}}
