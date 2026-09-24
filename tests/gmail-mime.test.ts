import {describe,expect,it} from 'vitest';
import {encodeHeader,rawMime} from '../src/outreach/gmail.js';

describe('Gmail MIME',()=>{
  it('encodes non-ASCII subjects as UTF-8 headers',()=>{
    expect(encodeHeader('Distribución Frío')).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
  });
  it('keeps the logical idempotency key in a draft payload',()=>{
    const raw=rawMime({to:'contacto@example.com',subject:'Prueba',body:'Hola',idempotencyKey:'sequence:DAY_0'});
    expect(raw).toContain('To: contacto@example.com');
    expect(raw).toContain('X-Renault-Idempotency-Key: sequence:DAY_0');
    expect(raw).toContain('\r\n\r\nHola');
  });
});
