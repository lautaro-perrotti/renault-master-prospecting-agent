import {describe,expect,it} from 'vitest';
import {parseAllowedTelegramUserIds} from '../src/telegram/bot.js';

describe('Telegram allowlist',()=>{
  it('normalizes numeric ids and ignores malformed values',()=>{
    expect([...parseAllowedTelegramUserIds(' 1598514837, 42, nope, -1, 0 ')].sort((a,b)=>a-b)).toEqual([42,1598514837]);
  });
  it('allows an empty configured list to represent unrestricted development mode',()=>{
    expect(parseAllowedTelegramUserIds('').size).toBe(0);
  });
});
