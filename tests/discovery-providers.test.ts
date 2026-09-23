import {describe,expect,it} from 'vitest';
import {parseBraveResults} from '../src/discovery/brave-search.js';
import {parsePlacesResults} from '../src/discovery/google-places.js';
describe('parsers de proveedores de discovery',()=>{
  it('normaliza resultados Brave sin inventar campos',()=>{const results=parseBraveResults({web:{results:[{title:'Empresa',url:'https://empresa.example',description:'Reparto AMBA'},{title:'Sin URL'}]}},'reparto','AMBA');expect(results).toHaveLength(1);expect(results[0]).toMatchObject({name:'Empresa',website:'https://empresa.example',sourceUrl:'https://empresa.example'});expect(results[0].metadata?.description).toBe('Reparto AMBA')});
  it('persiste identidad y datos de Places',()=>{const results=parsePlacesResults({places:[{id:'places/123',displayName:{text:'Distribuidora'},formattedAddress:'CABA',nationalPhoneNumber:'+54 11',websiteUri:'https://distribuidora.example',googleMapsUri:'https://maps.google.com/?cid=123',types:['warehouse'],location:{latitude:-34.6,longitude:-58.4}}]},'distribución','CABA');expect(results[0]).toMatchObject({externalId:'places/123',name:'Distribuidora',address:'CABA',phone:'+54 11',website:'https://distribuidora.example',mapsUrl:'https://maps.google.com/?cid=123',latitude:-34.6,longitude:-58.4});});
});
