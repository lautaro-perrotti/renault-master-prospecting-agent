import {describe,expect,it} from 'vitest';
import {validateResearchResult} from '../src/qualification/ai-research.js';
describe('validación de evidencia de investigación',()=>{
  it('rechaza referencias desconocidas',()=>{const result:any={companyType:'DISTRIBUTOR',summary:'x',confidence:'MEDIUM',detectedSignals:[{evidenceId:'missing',signal:'x'}],relevance:0.5,recommendedAction:'REVIEW'};expect(()=>validateResearchResult(result,['e1'])).toThrow('AI_INVALID_EVIDENCE_REFERENCE')});
  it('acepta referencias persistidas',()=>{const result:any={companyType:'DISTRIBUTOR',summary:'x',confidence:'MEDIUM',detectedSignals:[{evidenceId:'e1',signal:'x'}],transportFitSignals:[{evidenceId:'e1',signal:'y'}],relevance:0.5,recommendedAction:'REVIEW'};expect(validateResearchResult(result,['e1']).detectedSignals[0].evidenceId).toBe('e1')});
});
