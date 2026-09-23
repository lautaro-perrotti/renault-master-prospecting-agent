import {classifyScore,scoreSignals,type ScoreBreakdown} from '../domain.js';
export type ScoringEvidence={id:string;excerpt:string;signalType:string;observedAt:Date|string;confidence:number};
export function scoreCompany(input:{evidence?:ScoringEvidence[];signals?:string[];address?:string;contact:boolean;recent?:boolean}){
  const evidence=input.evidence??(input.signals??[]).map((excerpt,index)=>({id:`legacy-${index}`,excerpt,signalType:'OTHER',observedAt:new Date(),confidence:50}));
  const text=evidence.map(x=>`${x.signalType} ${x.excerpt}`).join(' ').toLowerCase();
  const fit=/refriger|congel|cadena de fr[ií]o|ultracongel|helad|l[aá]cte/.test(text)?40:/alimento|gastron|carnic/.test(text)?20:0;
  const need=/distribu|entrega|mayorista|log[ií]st|tercer|horeca|repart/.test(text)?25:/venta|producci/.test(text)?10:0;
  const geography=/caba|gba|gran buenos|am[bm]a|buenos aires/i.test(input.address??'')?15:0;
  const contact=input.contact?10:0;
  const dates=evidence.map(x=>new Date(x.observedAt).getTime()).filter(Number.isFinite);const latest=dates.length?Math.max(...dates):0;const ageDays=latest?Math.max(0,(Date.now()-latest)/86_400_000):Infinity;const recency=input.recent===true?10:ageDays<=90?10:ageDays<=365?5:0;
  const confidence=evidence.length>=3&&evidence.every(x=>x.confidence>=70)?'HIGH':evidence.length?'MEDIUM':'LOW';
  return{...scoreSignals({fit,need,geography,contact,recency,confidence}),reasoning:{fit:fit?evidence.filter(x=>/refriger|congel|fr[ií]o|helad|l[aá]cte/i.test(`${x.signalType} ${x.excerpt}`)).map(x=>x.id):[],need:need?evidence.filter(x=>/distribu|entrega|mayorista|log[ií]st|tercer|horeca|repart/i.test(x.excerpt)).map(x=>x.id):[],geography:geography?evidence.filter(x=>/caba|gba|gran buenos|am[bm]a|buenos aires/i.test(`${input.address??''} ${x.excerpt}`)).map(x=>x.id):[],contact:contact?['verified-contact']:[],recency:recency?evidence.filter(x=>new Date(x.observedAt).getTime()===latest).map(x=>x.id):[]}}
}
export {classifyScore};
export type {ScoreBreakdown};
