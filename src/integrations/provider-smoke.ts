import 'dotenv/config';
import OpenAI from 'openai';
import {z} from 'zod';
import {loadConfig} from '../config.js';
import {BraveSearchProvider} from '../discovery/brave-search.js';
import {GooglePlacesDiscoveryProvider} from '../discovery/google-places.js';

const config=loadConfig();
const provider=process.argv[2];
function output(value:Record<string,unknown>){console.log(JSON.stringify(value,null,2))}
async function main(){
  if(provider==='brave'){
    if(!config.BRAVE_SEARCH_API_KEY)return output({provider:'Brave',status:'NOT_CONFIGURED'});
    const results=await new BraveSearchProvider(config).search('distribución mayorista buenos aires','');if(!results.length)throw new Error('Brave Search returned 0 results');
    return output({provider:'Brave',status:'REAL_API_VALIDATED',requests:1,results:results.length,sampleResults:results.slice(0,5).map(result=>({title:result.name,url:result.sourceUrl,snippet:result.metadata.description??''}))});
  }
  if(provider==='places'){
    if(!config.GOOGLE_MAPS_API_KEY)return output({provider:'Google Places',status:'NOT_CONFIGURED'});
    const results=await new GooglePlacesDiscoveryProvider(config).search('distribuidores mayoristas Buenos Aires','');if(!results.length)throw new Error('Google Places returned 0 places');
    const valid=results.filter(result=>Boolean(result.externalId&&result.name&&result.address));if(!valid.length)throw new Error('Google Places response missing required place fields');
    return output({provider:'Google Places',status:'REAL_API_VALIDATED',requests:1,places:results.length,samplePlaces:valid.slice(0,5).map(result=>({placeId:result.externalId,displayName:result.name,formattedAddress:result.address,websiteUri:result.website, nationalPhoneNumber:result.phone,types:result.category,location:{latitude:result.latitude,longitude:result.longitude},googleMapsUri:result.mapsUrl}))});
  }
  if(provider==='openai'){
    if(!config.OPENAI_API_KEY)return output({provider:'OpenAI',status:'NOT_CONFIGURED'});
    const response=await new OpenAI({apiKey:config.OPENAI_API_KEY}).responses.create({model:config.OPENAI_MODEL,input:'Clasifica esta consulta como transporte. Devuelve solamente el objeto solicitado.',text:{format:{type:'json_schema',name:'provider_smoke',strict:true,schema:{type:'object',properties:{ok:{type:'boolean'},category:{type:'string',enum:['TRANSPORT']}},required:['ok','category'],additionalProperties:false}}}});
    const result=z.object({ok:z.literal(true),category:z.literal('TRANSPORT')}).parse(JSON.parse(response.output_text));return output({provider:'OpenAI',status:'REAL_API_VALIDATED',model:config.OPENAI_MODEL,calls:1,result,usage:response.usage??undefined});
  }
  throw new Error('USAGE: provider-smoke brave|places|openai');
}
main().catch(error=>{const message=error instanceof Error?error.message:String(error);console.error(JSON.stringify({status:'ERROR',error:message.slice(0,300)}));process.exitCode=1});
