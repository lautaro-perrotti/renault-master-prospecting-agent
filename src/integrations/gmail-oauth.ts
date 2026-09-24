import 'dotenv/config';
import {google} from 'googleapis';
import readline from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';

const clientId=process.env.GOOGLE_CLIENT_ID;
const clientSecret=process.env.GOOGLE_CLIENT_SECRET;
if(!clientId||!clientSecret)throw new Error('NOT_CONFIGURED: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET');

const auth=new google.auth.OAuth2(clientId,clientSecret,'http://localhost');
const url=auth.generateAuthUrl({access_type:'offline',prompt:'consent',scope:['https://www.googleapis.com/auth/gmail.modify']});
console.log(`Abrí esta URL en el navegador y autorizá la cuenta de Gmail:\n${url}`);
const rl=readline.createInterface({input,output});
try{
  const code=(await rl.question('Pegá el code o redirect URL: ')).trim();
  const parsed=code.includes('code=')?new URL(code).searchParams.get('code')??'':code;
  if(!parsed)throw new Error('GMAIL_OAUTH_CODE_MISSING');
  const token=await auth.getToken(parsed);
  if(!token.tokens.refresh_token)throw new Error('GMAIL_REFRESH_TOKEN_MISSING');
  console.log(JSON.stringify({refreshToken:token.tokens.refresh_token,scope:token.tokens.scope},null,2));
}finally{rl.close()}
