import {describe,expect,it} from 'vitest';
import {eligibleForOutreach,type OutreachCandidate} from '../src/outreach/batch.js';

const base:OutreachCandidate={companyId:'1',companyName:'Empresa',companyStatus:'REVIEW',email:'contacto@empresa.com',verificationStatus:'MX_VALID',invalid:false,suppressed:false,segment:'NON_REFRIGERATED'};

describe('outreach batch eligibility',()=>{
  it('allows classified and verified contacts',()=>{expect(eligibleForOutreach(base)).toBe(true)});
  it('holds unknown, unverified and suppressed contacts',()=>{
    expect(eligibleForOutreach({...base,segment:'UNKNOWN'})).toBe(false);
    expect(eligibleForOutreach({...base,verificationStatus:'PUBLICLY_OBSERVED'})).toBe(false);
    expect(eligibleForOutreach({...base,verificationStatus:'SYNTAX_VALID'})).toBe(false);
    expect(eligibleForOutreach({...base,suppressed:true})).toBe(false);
  });
});
