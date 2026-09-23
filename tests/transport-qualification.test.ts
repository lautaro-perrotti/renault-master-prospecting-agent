import {describe,expect,it} from 'vitest';
import {inferRefrigerationFit,inferUseCase,scoreTransportOpportunity} from '../src/qualification/scorer.js';

const evidence=(excerpt:string,signalType='BUSINESS')=>[{id:'e1',excerpt,signalType,observedAt:new Date().toISOString(),confidence:90}];
describe('calificación de oportunidades de transporte',()=>{
  it('A: detecta distribución diaria no refrigerada',()=>{const text='Distribución mayorista con reparto diario en CABA y Zona Norte';const score=scoreTransportOpportunity({evidence:evidence(text),address:'CABA',contact:true});expect(inferUseCase(text)).toBe('NON_REFRIGERATED');expect(score.transportFit).toBeGreaterThanOrEqual(60)});
  it('B: detecta cadena de frío',()=>{const text='Distribución de productos congelados con entregas en AMBA';expect(inferUseCase(text)).toBe('REFRIGERATED');expect(inferRefrigerationFit(text)).toBe('REQUIRED')});
  it('C: detecta operación mixta',()=>{const text='Mayorista de mercadería seca y alimentos refrigerados';expect(inferUseCase(text)).toBe('MIXED')});
  it('D: descarta actividad sin transporte',()=>{const score=scoreTransportOpportunity({evidence:evidence('Agencia de marketing digital para empresas'),contact:false});expect(score.transportFit).toBeLessThanOrEqual(15);expect(score.useCase).toBe('UNKNOWN')});
  it('E: distingue frío sin evidencia de reparto',()=>{const score=scoreTransportOpportunity({evidence:evidence('Heladería con un único local en CABA'),address:'CABA',contact:false});expect(score.refrigerationFit).toBe('STRONG_ADVANTAGE');expect(score.transportFit).toBeLessThan(60)});
  it('F: prioriza fletero con vehículo y recurrencia',()=>{const score=scoreTransportOpportunity({evidence:evidence('Fletero con vehículo propio, recorridos diarios y reparto AMBA'),address:'AMBA',contact:true});expect(score.transportFit).toBeGreaterThanOrEqual(80);expect(score.useCase).toBe('NON_REFRIGERATED')});
});
