import {InlineKeyboard} from 'grammy';

export function modeLabel(mode:string):string{
  if(mode==='SEMI_AUTO')return 'Semiautom\u00e1tico';
  if(mode==='AUTO')return 'Autom\u00e1tico';
  return 'Manual';
}

export function stateLabel(state:string):string{
  if(state==='PAUSED')return '\uD83D\uDFE1 Pausado';
  if(state==='STOPPED')return '\uD83D\uDD34 Detenido';
  return '\uD83D\uDFE2 Activo';
}

export function statusLabel(status:string):string{
  const labels:Record<string,string>={DISCOVERED:'Encontrada',RESEARCHING:'En investigaci\u00f3n',QUALIFIED:'Relevante',REVIEW:'Para revisar',APPROVED:'Aprobada',DRAFTED:'Mensaje preparado',SENT:'Contactada',SEQUENCE_ACTIVE:'Seguimiento activo',REPLIED:'Respondi\u00f3',STOPPED:'Detenida',DISCARDED:'Descartada',BLOCKED:'No contactar'};
  return labels[status]??'En revisi\u00f3n';
}

export function transportTypeLabel(value:string|undefined):string{
  if(value==='REFRIGERATED')return 'Refrigerado';
  if(value==='NON_REFRIGERATED')return 'Transporte convencional';
  if(value==='MIXED')return 'Mixto';
  return value==='UNKNOWN'?'Sin clasificar':value??'Sin clasificar';
}

export function mainMenuKeyboard():InlineKeyboard{return new InlineKeyboard().text('\uD83D\uDD0E Buscar oportunidades','menu:search').row().text('\uD83D\uDCCB Ver oportunidades','menu:opportunities').row().text('\uD83D\uDCAC Respuestas','menu:replies').row().text('\uD83D\uDCCA Estado','menu:status').row().text('\u2699\uFE0F Configuraci\u00f3n','menu:settings');}
export function searchKeyboard():InlineKeyboard{return new InlineKeyboard().text('\uD83D\uDE80 B\u00fasqueda autom\u00e1tica','search:auto').row().text('\u270D\uFE0F Escribir b\u00fasqueda','search:write').row().text('\u21A9\uFE0F Volver','menu:home');}
export function opportunitiesKeyboard():InlineKeyboard{return new InlineKeyboard().text('\uD83D\uDFE2 Mejores oportunidades','opps:best').row().text('\uD83D\uDFE1 Para revisar','opps:review').row().text('\uD83D\uDD35 Contactadas','opps:contacted').row().text('\uD83D\uDCAC Con respuesta','opps:replied').row().text('\u21A9\uFE0F Volver','menu:home');}
export function statusKeyboard(state:string):InlineKeyboard{const keyboard=new InlineKeyboard().text('\uD83D\uDD0E Buscar ahora','menu:search').row();if(state==='RUNNING')keyboard.text('\u23F8\uFE0F Pausar','menu:pause');else keyboard.text('\u25B6\uFE0F Reanudar','menu:resume');return keyboard.row().text('\u2699\uFE0F Configuraci\u00f3n','menu:settings').row().text('\u21A9\uFE0F Volver','menu:home');}
export function settingsKeyboard():InlineKeyboard{return new InlineKeyboard().text('\uD83C\uDFAF Cambiar modo','settings:mode').row().text('\u2709\uFE0F L\u00edmites','settings:limits').row().text('\uD83D\uDCCD Zona','settings:zone').row().text('\uD83D\uDEAB Bloqueados','settings:blocked').row().text('\uD83D\uDD27 Diagn\u00f3stico','settings:doctor').row().text('\u21A9\uFE0F Volver','menu:home');}
export function modeKeyboard():InlineKeyboard{return new InlineKeyboard().text('\uD83D\uDC64 Manual','mode:select:MANUAL').row().text('\uD83D\uDFE1 Semiautom\u00e1tico','mode:select:SEMI_AUTO').row().text('\uD83E\uDD16 Autom\u00e1tico','mode:select:AUTO').row().text('\u21A9\uFE0F Volver','menu:settings');}
export function modeConfirmKeyboard(mode:string):InlineKeyboard{return new InlineKeyboard().text('\u2705 Activar',`mode:confirm:${mode}`).text('\u274C Cancelar','settings:mode');}
export function leadKeyboard(id:string):InlineKeyboard{return new InlineKeyboard().text('\u2709\uFE0F Ver mensaje',`lead:${id}:message`).text('\uD83D\uDD0E Investigar',`lead:${id}:research`).row().text('\u2705 Contactar',`lead:${id}:send`).text('\u274C Descartar',`lead:${id}:skip`).row().text('\uD83D\uDEAB No contactar nunca',`lead:${id}:block`).row().text('\u21A9\uFE0F Volver','opps:best');}
export function leadMessageKeyboard(id:string):InlineKeyboard{return new InlineKeyboard().text('\u2705 Contactar',`lead:${id}:send`).text('\u270F\uFE0F Editar',`lead:${id}:edit`).row().text('\uD83D\uDD0E Investigar m\u00e1s',`lead:${id}:research`).text('\u274C Cancelar',`lead:${id}:detail`);}
export function leadListKeyboard(rows:Array<{id:string;name:string}>):InlineKeyboard{const keyboard=new InlineKeyboard();for(const row of rows)keyboard.text(`\uD83C\uDFE2 ${row.name.slice(0,42)}`,`lead:${row.id}:detail`).row();return keyboard.text('\u21A9\uFE0F Volver','menu:opportunities');}
export function replyListKeyboard(rows:Array<{id:string;name:string}>):InlineKeyboard{const keyboard=new InlineKeyboard();for(const row of rows)keyboard.text(`\uD83D\uDCAC ${row.name.slice(0,42)}`,`reply:${row.id}`).row();return keyboard.text('\u21A9\uFE0F Volver','menu:home');}
