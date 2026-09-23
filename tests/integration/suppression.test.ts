import {describe,expect,it,beforeAll,afterAll,beforeEach} from 'vitest';
import {createDb,closeDb} from '../../src/db/client.js';
import {migrate} from '../../src/db/migrate.js';
import {createSuppression,getSuppressionDecision} from '../../src/outreach/suppression.js';
const url=process.env.TEST_DATABASE_URL;const enabled=process.env.RUN_PG_INTEGRATION==='1'&&Boolean(url);const client=enabled?createDb({DATABASE_URL:url!,OUTREACH_MODE:'MANUAL'} as any):undefined;
describe.skipIf(!enabled)('suppression invariants',()=>{
  beforeAll(async()=>migrate(client!.pool));beforeEach(async()=>client!.pool.query('TRUNCATE companies,suppressions CASCADE'));afterAll(async()=>closeDb(client!));
  it('blocks email-only suppression without a company/domain join',async()=>{const company=(await client!.pool.query("INSERT INTO companies(name,normalized_name,domain) VALUES('Frozen','frozen','frozen.example.com') RETURNING id")).rows[0];await createSuppression(client!.db,{email:'ventas@frozen.example.com',reason:'OPT_OUT'});const result=await getSuppressionDecision(client!.db,company.id,'ventas@frozen.example.com','frozen.example.com');expect(result.suppressed).toBe(true);expect(result.reasons).toContain('OPT_OUT')});
});
