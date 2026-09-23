import type {Config} from '../../config.js';
import type {Db} from '../../db/client.js';
import {SheetsSync} from '../../integrations/sheets.js';
import {SheetProjectionService} from '../../integrations/sheets-projection.js';
import type {JobDependencies} from '../dependencies.js';
import {operationallyAllowed} from '../../operations/state.js';
export async function sheetsHandler(db:Db,config:Config,_job:any,deps:JobDependencies){if(!await operationallyAllowed(db,'SHEETS_SYNC'))return;const service=deps.sheets??new SheetProjectionService(db,new SheetsSync(config));await service.syncDatabase()}
