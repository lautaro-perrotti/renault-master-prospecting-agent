import {describe,expect,it} from 'vitest';
import {classifySearchResult} from '../src/discovery/classification.js';
import {entityFromResult} from '../src/discovery/entity.js';
import {corporateDomain} from '../src/enrichment/company.js';
import {classifyReplyDeterministic} from '../src/replies/classifier.js';
import {SearchPlanner} from '../src/discovery/planner.js';
describe('discovery safety boundaries',()=>{
  it('does not turn an article into a company',()=>{const result=classifySearchResult({url:'https://lanacion.com.ar/noticia',title:'Los desafios de la cadena de frio',description:'Una noticia'});expect(result.kind).toBe('NEWS');expect(entityFromResult({title:'Los desafios de la cadena de frio',url:'https://lanacion.com.ar/noticia',kind:result.kind,confidence:result.confidence})).toBeUndefined()});
  it('does not use social platform domain as corporate identity',()=>{expect(corporateDomain('https://instagram.com/frozen')).toBeUndefined();expect(classifySearchResult({url:'https://instagram.com/frozen',title:'Frozen HORECA'}).kind).toBe('SOCIAL_PROFILE')});
  it('keeps reply UNKNOWN non-destructive',()=>{expect(classifyReplyDeterministic('Recibido, gracias')).toEqual({classification:'AUTO_REPLY',summary:'Respuesta automática'});expect(classifyReplyDeterministic('texto ambiguo').classification).toBe('UNKNOWN')});
  it('derives a new search term from observed vocabulary',()=>{const planner=new SearchPlanner('CABA,GBA');const derived=planner.derive({location:'CABA',goal:'',maxSearchRequests:4,maxNewCompanies:4,maxRuntimeSeconds:30,minMarginalNovelty:0.1},['ultracongelados horeca'],[]);expect(derived.some(strategy=>strategy.query.includes('ultracongelados'))).toBe(true);expect(derived.some(strategy=>strategy.name==='DERIVED')).toBe(true)});
});
