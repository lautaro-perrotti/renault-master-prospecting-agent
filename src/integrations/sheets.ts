import {google} from 'googleapis';
import type {Config} from '../config.js';
export type SheetsApi={spreadsheets:{values:{get(input:any):Promise<any>;update(input:any):Promise<any>;append(input:any):Promise<any>};batchUpdate?(input:any):Promise<any>}};
export function reconcileRows(existing:string[][],desired:string[][]){const rows=desired[0]?.[0]==='internal_id'?desired.slice(1):desired;const index=new Map(existing.slice(1).map((row,i)=>[row[0],i+2]));return rows.map(row=>({row,rowNumber:index.get(row[0])}))}
export class SheetsSync{
  private api?:SheetsApi;
  constructor(private config:Config,api?:SheetsApi){this.api=api}
  private async client(){if(this.api)return this.api;if(!this.config.GOOGLE_SHEET_ID||!this.config.GOOGLE_REFRESH_TOKEN)throw new Error('NOT_CONFIGURED: Google Sheets');const auth=new google.auth.OAuth2(this.config.GOOGLE_CLIENT_ID,this.config.GOOGLE_CLIENT_SECRET);auth.setCredentials({refresh_token:this.config.GOOGLE_REFRESH_TOKEN});this.api=google.sheets({version:'v4',auth}) as unknown as SheetsApi;return this.api}
  async syncTab(tab:string,rows:string[][]){
    if(!this.config.GOOGLE_SHEET_ID)throw new Error('NOT_CONFIGURED: GOOGLE_SHEET_ID');const api=await this.client();let existing:string[][]=[];try{existing=(await api.spreadsheets.values.get({spreadsheetId:this.config.GOOGLE_SHEET_ID,range:`${tab}!A:Z`})).data.values??[]}catch(error){if(!api.spreadsheets.batchUpdate)throw error;await api.spreadsheets.batchUpdate({spreadsheetId:this.config.GOOGLE_SHEET_ID,requestBody:{requests:[{addSheet:{properties:{title:tab}}}]}})}
    if(!existing.length&&rows[0])await api.spreadsheets.values.append({spreadsheetId:this.config.GOOGLE_SHEET_ID,range:`${tab}!A:Z`,valueInputOption:'USER_ENTERED',requestBody:{values:[rows[0]]}});
    for(const item of reconcileRows(existing,rows)){if(item.rowNumber)await api.spreadsheets.values.update({spreadsheetId:this.config.GOOGLE_SHEET_ID,range:`${tab}!A${item.rowNumber}:Z${item.rowNumber}`,valueInputOption:'USER_ENTERED',requestBody:{values:[item.row]}});else await api.spreadsheets.values.append({spreadsheetId:this.config.GOOGLE_SHEET_ID,range:`${tab}!A:Z`,valueInputOption:'USER_ENTERED',requestBody:{values:[item.row]}})}
  }
  async syncTabs(tabs:Record<string,string[][]>){for(const [tab,rows] of Object.entries(tabs))await this.syncTab(tab,rows)}
}
