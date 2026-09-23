import type {SourceType} from '../domain.js';
export type DiscoveryResult={externalId?:string;name:string;address?:string;phone?:string;website?:string;mapsUrl?:string;category?:string;latitude?:number;longitude?:number;sourceType:SourceType;sourceUrl:string;metadata:Record<string,unknown>};
export interface DiscoveryProvider{readonly name:string;search(query:string,location:string):Promise<DiscoveryResult[]>}
export type RawSearchResult={provider:string;query:string;url:string;title:string;description?:string;sourceType:SourceType;metadata:Record<string,unknown>};
