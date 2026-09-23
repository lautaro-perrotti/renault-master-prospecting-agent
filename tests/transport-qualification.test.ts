import {describe,expect,it} from 'vitest';
import {inferRefrigerationFit,inferUseCase,legacyVehicleFit,scoreTransportOpportunity} from '../src/qualification/scorer.js';

const evidence=(excerpt:string,signalType='BUSINESS')=>[{id:'e1',excerpt,signalType,observedAt:new Date().toISOString(),confidence:90}];
describe('calificaciÃ³n de oportunidades de transporte',()=>{
  it('A: detecta distribuciÃ³n diaria no refrigerada',()=>{const text='DistribuciÃ³n mayorista con reparto diario en CABA y Zona Norte';const score=scoreTransportOpportunity({evidence:evidence(text),address:'CABA',contact:true});expect(inferUseCase(text)).toBe('NON_REFRIGERATED');expect(score.transportFit).toBeGreaterThanOrEqual(60)});
  it('B: detecta cadena de frÃ­o',()=>{const text='DistribuciÃ³n de productos congelados con entregas en AMBA';expect(inferUseCase(text)).toBe('REFRIGERATED');expect(inferRefrigerationFit(text)).toBe('REQUIRED')});
  it('C: detecta operaciÃ³n mixta',()=>{const text='Mayorista de mercaderÃ­a seca y alimentos refrigerados';expect(inferUseCase(text)).toBe('MIXED')});
  it('D: descarta actividad sin transporte',()=>{const score=scoreTransportOpportunity({evidence:evidence('Agencia de marketing digital para empresas'),contact:false});expect(score.transportFit).toBeLessThanOrEqual(15);expect(score.useCase).toBe('UNKNOWN')});
  it('E: distingue frÃ­o sin evidencia de reparto',()=>{const score=scoreTransportOpportunity({evidence:evidence('HeladerÃ­a con un Ãºnico local en CABA'),address:'CABA',contact:false});expect(score.refrigerationFit).toBe('STRONG_ADVANTAGE');expect(score.transportFit).toBeLessThan(60)});
  it('F: no premia a un fletero sin demanda externa demostrada',()=>{const score=scoreTransportOpportunity({evidence:evidence('Fletero con vehiculo propio, recorridos diarios y reparto AMBA'),address:'AMBA',contact:true});expect(score.externalTransportDemand).toBe(0);expect(score.transportFit).toBeLessThan(60);expect(score.useCase).toBe('NON_REFRIGERATED')});
  it('G: conserva el limite legacy de vehicle_fit al persistir el modelo 0..30',()=>{expect(legacyVehicleFit(30)).toBe(25);expect(legacyVehicleFit(0)).toBe(0)});
});
