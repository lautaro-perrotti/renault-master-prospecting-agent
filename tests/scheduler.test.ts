import {describe,expect,it} from 'vitest';
import {matchesCron} from '../src/scheduler.js';
describe('scheduler slots',()=>{it('matches configured minute and hour fields',()=>{expect(matchesCron('*/5 * * * *',new Date('2026-09-23T15:10:00'))).toBe(true);expect(matchesCron('0 8,14,18 * * *',new Date('2026-09-23T14:00:00'))).toBe(true);expect(matchesCron('0 8,14,18 * * *',new Date('2026-09-23T15:00:00'))).toBe(false)})});
