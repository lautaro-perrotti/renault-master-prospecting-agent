import {describe,expect,it} from 'vitest';
import {mainMenuKeyboard,modeLabel,stateLabel,statusLabel,transportTypeLabel} from '../src/telegram/presentation.js';

describe('Telegram presentation',()=>{
  it('translates internal modes, states and statuses',()=>{
    expect(modeLabel('SEMI_AUTO')).toBe('Semiautomático');
    expect(stateLabel('RUNNING')).toContain('Activo');
    expect(statusLabel('SEQUENCE_ACTIVE')).toBe('Seguimiento activo');
    expect(transportTypeLabel('NON_REFRIGERATED')).toBe('Transporte convencional');
  });

  it('exposes the operational menu instead of technical commands',()=>{
    const labels=mainMenuKeyboard().inline_keyboard.flat().map(button=>button.text);
    expect(labels).toEqual(expect.arrayContaining(['🔎 Buscar oportunidades','📋 Ver oportunidades','💬 Respuestas','📊 Estado','⚙️ Configuración']));
    expect(labels).not.toContain('/status');
  });
});
