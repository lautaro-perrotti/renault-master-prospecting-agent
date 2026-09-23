import 'dotenv/config';
import {loadConfig} from '../config.js';
import {parseAllowedTelegramUserIds} from './bot.js';
import {TelegramNotifier} from './notifier.js';

const config=loadConfig();
const users=[...parseAllowedTelegramUserIds(config.TELEGRAM_ALLOWED_USER_IDS)];
if(users.length===0)throw new Error('NOT_CONFIGURED: TELEGRAM_ALLOWED_USER_IDS');
const notifier=new TelegramNotifier(config);
const message='✅ Telegram outbound notification test';
Promise.all(users.map(async userId=>{await notifier.sendToUser(userId,message);return userId;})).then(sent=>console.log(JSON.stringify({outbound:'PASS',users:sent,message}))).catch(error=>{console.error(error);process.exitCode=1});
