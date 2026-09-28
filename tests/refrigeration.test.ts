import {describe,expect,it} from 'vitest';
import {classifyPersistedRefrigeration,classifyRefrigeration} from '../src/qualification/refrigeration.js';

describe('refrigeration classification',()=>{
  it('classifies clear cold-chain evidence as refrigerated',()=>{
    expect(classifyRefrigeration('REFRIGERATED','UNKNOWN')).toBe('REFRIGERATED');
    expect(classifyRefrigeration('UNKNOWN','REQUIRED')).toBe('REFRIGERATED');
    expect(classifyRefrigeration('MIXED','OPTIONAL_ADVANTAGE')).toBe('UNKNOWN');
    expect(classifyRefrigeration('MIXED','REQUIRED')).toBe('UNKNOWN');
  });
  it('classifies clear dry transport evidence as non refrigerated',()=>{
    expect(classifyRefrigeration('NON_REFRIGERATED','UNKNOWN')).toBe('NON_REFRIGERATED');
    expect(classifyRefrigeration('UNKNOWN','NOT_REQUIRED')).toBe('NON_REFRIGERATED');
  });
  it('keeps ambiguous records out of automatic template selection',()=>{
    expect(classifyPersistedRefrigeration({useCase:'UNKNOWN',refrigerationFit:'OPTIONAL_ADVANTAGE'})).toBe('UNKNOWN');
    expect(classifyPersistedRefrigeration({useCase:'MIXED',refrigerationFit:'OPTIONAL_ADVANTAGE',fallbackUseCase:'REFRIGERATED'})).toBe('UNKNOWN');
    expect(classifyPersistedRefrigeration({useCase:'UNKNOWN',refrigerationFit:'UNKNOWN',fallbackUseCase:'REFRIGERATED'})).toBe('REFRIGERATED');
  });
});

