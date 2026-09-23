import 'dotenv/config';
import {loadConfig} from '../config.js';
import {parseAllowedTelegramUserIds} from './bot.js';
import {TelegramNotifier} from './notifier.js';

const config=loadConfig();
const userArgIndex=process.argv.indexOf('--user');
const userId=userArgIndex>=0?process.argv[userArgIndex+1]:undefined;
if(!userId||!/^[0-9]+$/.test(userId))throw new Error('Uso: npm run telegram:test-send -- --user <TELEGRAM_USER_ID>');
if(!parseAllowedTelegramUserIds(config.TELEGRAM_ALLOWED_USER_IDS).has(Number(userId)))throw new Error('El usuario indicado no está en TELEGRAM_ALLOWED_USER_IDS');
const notifier=new TelegramNotifier(config);
notifier.sendToUser(userId,'✅ Renault Master agent Telegram test').then(()=>console.log(JSON.stringify({outbound:'PASS',userId}))).catch(error=>{console.error(error);process.exitCode=1});
