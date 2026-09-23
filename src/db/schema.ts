import {boolean,integer,jsonb,pgTable,text,timestamp,uniqueIndex,uuid,index} from 'drizzle-orm/pg-core';

const json=()=>jsonb('metadata').$type<Record<string,unknown>>().notNull().default({});

export const companies=pgTable('companies',{
  id:uuid('id').defaultRandom().primaryKey(),name:text('name').notNull(),normalizedName:text('normalized_name').notNull(),
  domain:text('domain'),placeId:text('google_place_id'),address:text('address'),phone:text('phone'),website:text('website'),
  status:text('status').notNull().default('DISCOVERED'),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).defaultNow().notNull()
},t=>[uniqueIndex('companies_domain_uq').on(t.domain),uniqueIndex('companies_place_uq').on(t.placeId),index('companies_normalized_name_idx').on(t.normalizedName)]);

export const contacts=pgTable('contacts',{
  id:uuid('id').defaultRandom().primaryKey(),companyId:uuid('company_id').references(()=>companies.id).notNull(),email:text('email'),phone:text('phone'),kind:text('kind'),sourceUrl:text('source_url'),
  verificationStatus:text('verification_status').notNull().default('PUBLICLY_OBSERVED'),verified:boolean('verified').default(false).notNull(),invalid:boolean('invalid').default(false).notNull()
},t=>[uniqueIndex('contacts_company_email_uq').on(t.companyId,t.email),uniqueIndex('contacts_company_phone_uq').on(t.companyId,t.phone),index('contacts_email_idx').on(t.email)]);

export const socialProfiles=pgTable('social_profiles',{
  id:uuid('id').defaultRandom().primaryKey(),companyId:uuid('company_id').references(()=>companies.id).notNull(),network:text('network').notNull(),url:text('url').notNull()
},t=>[uniqueIndex('social_profiles_uq').on(t.companyId,t.network,t.url)]);

export const sources=pgTable('sources',{
  id:uuid('id').defaultRandom().primaryKey(),companyId:uuid('company_id').references(()=>companies.id),sourceType:text('source_type').notNull(),url:text('url').notNull(),metadata:json(),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[uniqueIndex('sources_company_url_uq').on(t.companyId,t.url)]);

export const evidence=pgTable('evidence',{
  id:uuid('id').defaultRandom().primaryKey(),companyId:uuid('company_id').references(()=>companies.id).notNull(),sourceType:text('source_type').notNull(),sourceUrl:text('source_url').notNull(),title:text('title').notNull(),excerpt:text('excerpt').notNull(),signalType:text('signal_type').notNull(),confidence:integer('confidence').notNull(),observedAt:timestamp('observed_at',{withTimezone:true}).defaultNow().notNull()
},t=>[uniqueIndex('evidence_company_url_excerpt_uq').on(t.companyId,t.sourceUrl,t.excerpt),index('evidence_company_idx').on(t.companyId)]);

export const runs=pgTable('runs',{
  id:uuid('id').defaultRandom().primaryKey(),type:text('type').notNull(),status:text('status').notNull(),startedAt:timestamp('started_at',{withTimezone:true}).defaultNow().notNull(),finishedAt:timestamp('finished_at'),metadata:jsonb('metadata').$type<Record<string,unknown>>().notNull().default({})
});

export const searchQueries=pgTable('search_queries',{
  id:uuid('id').defaultRandom().primaryKey(),runId:uuid('run_id').references(()=>runs.id),source:text('source').notNull(),query:text('query').notNull(),strategy:text('strategy'),fingerprint:text('fingerprint'),resultsCount:integer('results_count').notNull().default(0),stopReason:text('stop_reason'),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[uniqueIndex('search_queries_run_fingerprint_uq').on(t.runId,t.fingerprint)]);

export const rawSearchResults=pgTable('raw_search_results',{
  id:uuid('id').defaultRandom().primaryKey(),runId:uuid('run_id').references(()=>runs.id),provider:text('provider').notNull(),query:text('query').notNull(),resultUrl:text('result_url').notNull(),title:text('title').notNull(),description:text('description'),classification:text('classification').notNull().default('OTHER'),classificationConfidence:integer('classification_confidence').notNull().default(0),metadata:json(),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[uniqueIndex('raw_search_run_provider_query_url_uq').on(t.runId,t.provider,t.query,t.resultUrl),index('raw_search_run_idx').on(t.runId)]);

export const entityCandidates=pgTable('entity_candidates',{
  id:uuid('id').defaultRandom().primaryKey(),rawResultId:uuid('raw_result_id').references(()=>rawSearchResults.id).notNull(),name:text('name').notNull(),normalizedName:text('normalized_name').notNull(),corporateDomain:text('corporate_domain'),sourceUrl:text('source_url').notNull(),confidence:integer('confidence').notNull().default(0),metadata:json(),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[uniqueIndex('entity_candidate_raw_uq').on(t.rawResultId)]);

export const providerExecutions=pgTable('provider_executions',{
  id:uuid('id').defaultRandom().primaryKey(),runId:uuid('run_id').references(()=>runs.id),provider:text('provider').notNull(),query:text('query').notNull(),status:text('status').notNull(),attempts:integer('attempts').notNull().default(1),resultCount:integer('result_count').notNull().default(0),errorCode:text('error_code'),errorMessage:text('error_message'),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
});

export const qualifications=pgTable('qualifications',{
  id:uuid('id').defaultRandom().primaryKey(),companyId:uuid('company_id').references(()=>companies.id).notNull(),fit:integer('fit').notNull(),need:integer('need').notNull(),geography:integer('geography').notNull(),contactQuality:integer('contact_quality').notNull(),recency:integer('recency').notNull(),total:integer('total').notNull(),transportNeed:integer('transport_need').notNull().default(0),vehicleFit:integer('vehicle_fit').notNull().default(0),recurrence:integer('recurrence').notNull().default(0),transportFit:integer('transport_fit').notNull().default(0),useCase:text('use_case').notNull().default('UNKNOWN'),refrigerationFit:text('refrigeration_fit').notNull().default('UNKNOWN'),confidence:text('confidence').notNull(),decision:text('decision').notNull(),reasoning:jsonb('reasoning').$type<Record<string,unknown>>().notNull().default({}),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[index('qualifications_company_idx').on(t.companyId,t.createdAt)]);

export const researchResults=pgTable('research_results',{
  id:uuid('id').defaultRandom().primaryKey(),companyId:uuid('company_id').references(()=>companies.id).notNull(),model:text('model').notNull(),modelUsed:text('model_used'),escalated:boolean('escalated').notNull().default(false),escalationReason:text('escalation_reason'),businessModel:text('business_model').notNull(),refrigerationRelevance:integer('refrigeration_relevance').notNull(),distributionModel:text('distribution_model').notNull(),geography:text('geography').notNull(),potentialTransportNeed:text('potential_transport_need').notNull(),signals:jsonb('signals').$type<Array<{evidenceId:string;signal:string}>>().notNull().default([]),uncertainties:jsonb('uncertainties').$type<string[]>().notNull().default([]),summary:text('summary').notNull(),confidence:integer('confidence').notNull(),usage:jsonb('usage').$type<Record<string,unknown>>(),movesPhysicalGoods:boolean('moves_physical_goods'),transportOperation:text('transport_operation').notNull().default('unknown'),transportFitSignals:jsonb('transport_fit_signals').$type<Array<{evidenceId:string;signal:string}>>().notNull().default([]),useCase:text('use_case').notNull().default('UNKNOWN'),refrigerationFit:text('refrigeration_fit').notNull().default('UNKNOWN'),recurrenceSignals:jsonb('recurrence_signals').$type<Array<{evidenceId:string;signal:string}>>().notNull().default([]),buyingSignals:jsonb('buying_signals').$type<Array<{evidenceId:string;signal:string}>>().notNull().default([]),contactAssessment:text('contact_assessment').notNull().default('unknown'),evidenceIds:jsonb('evidence_ids').$type<string[]>().notNull().default([]),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
});

export const campaigns=pgTable('campaigns',{id:uuid('id').defaultRandom().primaryKey(),name:text('name').notNull(),status:text('status').notNull()},t=>[uniqueIndex('campaign_name_uq').on(t.name)]);
export const messageSequences=pgTable('message_sequences',{
  id:uuid('id').defaultRandom().primaryKey(),companyId:uuid('company_id').references(()=>companies.id).notNull(),campaignId:uuid('campaign_id').references(()=>campaigns.id),status:text('status').notNull(),nextStep:text('next_step'),nextRunAt:timestamp('next_run_at',{withTimezone:true}),humanResponse:boolean('human_response').default(false).notNull()
},t=>[uniqueIndex('message_sequence_company_campaign_uq').on(t.companyId,t.campaignId)]);
export const messages=pgTable('messages',{
  id:uuid('id').defaultRandom().primaryKey(),companyId:uuid('company_id').references(()=>companies.id).notNull(),sequenceId:uuid('sequence_id').references(()=>messageSequences.id),direction:text('direction').notNull(),toEmail:text('to_email'),subject:text('subject'),body:text('body').notNull(),gmailMessageId:text('gmail_message_id'),gmailThreadId:text('gmail_thread_id'),sentAt:timestamp('sent_at',{withTimezone:true}),preparedAt:timestamp('prepared_at',{withTimezone:true}),reconciliationAt:timestamp('reconciliation_at',{withTimezone:true}),failureCode:text('failure_code'),idempotencyKey:text('idempotency_key'),sequenceStep:text('sequence_step'),outboundState:text('outbound_state').default('DRAFT').notNull()
},t=>[uniqueIndex('messages_idempotency_uq').on(t.idempotencyKey),uniqueIndex('messages_gmail_message_uq').on(t.gmailMessageId),uniqueIndex('messages_sequence_step_uq').on(t.sequenceId,t.sequenceStep)]);
export const replies=pgTable('replies',{id:uuid('id').defaultRandom().primaryKey(),companyId:uuid('company_id').references(()=>companies.id).notNull(),messageId:uuid('message_id').references(()=>messages.id),gmailMessageId:text('gmail_message_id'),body:text('body').notNull(),classification:text('classification').notNull(),receivedAt:timestamp('received_at',{withTimezone:true}).defaultNow().notNull()},t=>[uniqueIndex('replies_gmail_message_uq').on(t.gmailMessageId)]);

export const suppressions=pgTable('suppressions',{id:uuid('id').defaultRandom().primaryKey(),email:text('email'),domain:text('domain'),companyId:uuid('company_id').references(()=>companies.id),reason:text('reason').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()},t=>[index('suppressions_company_idx').on(t.companyId),index('suppressions_domain_idx').on(t.domain),index('suppressions_email_idx').on(t.email)]);
export const outreachSendReservations=pgTable('outreach_send_reservations',{id:uuid('id').defaultRandom().primaryKey(),messageId:uuid('message_id').references(()=>messages.id).notNull(),period:text('period').notNull(),scope:text('scope').notNull(),reservedAt:timestamp('reserved_at',{withTimezone:true}).defaultNow().notNull()},t=>[uniqueIndex('send_reservation_uq').on(t.messageId,t.period,t.scope)]);

export const jobs=pgTable('jobs',{id:uuid('id').defaultRandom().primaryKey(),type:text('type').notNull(),payload:jsonb('payload').$type<Record<string,unknown>>().notNull(),status:text('status').notNull().default('PENDING'),attempts:integer('attempts').notNull().default(0),maxAttempts:integer('max_attempts').notNull().default(5),runAt:timestamp('run_at',{withTimezone:true}).defaultNow().notNull(),lockedAt:timestamp('locked_at'),finishedAt:timestamp('finished_at'),lastError:text('last_error'),idempotencyKey:text('idempotency_key'),priority:integer('priority').notNull().default(0),leaseOwner:text('lease_owner'),leaseExpiresAt:timestamp('lease_expires_at'),heartbeatAt:timestamp('heartbeat_at'),runId:uuid('run_id').references(()=>runs.id)},t=>[uniqueIndex('jobs_idempotency_uq').on(t.idempotencyKey),index('jobs_ready_idx').on(t.status,t.runAt,t.priority)]);
export const auditEvents=pgTable('audit_events',{id:uuid('id').defaultRandom().primaryKey(),action:text('action').notNull(),companyId:uuid('company_id').references(()=>companies.id),jobId:uuid('job_id'),runId:uuid('run_id'),details:jsonb('details').$type<Record<string,unknown>>().notNull().default({}),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()},t=>[index('audit_company_idx').on(t.companyId,t.createdAt)]);
export const configuration=pgTable('configuration',{key:text('key').primaryKey(),value:text('value').notNull()});
export const operationalState=pgTable('operational_state',{id:boolean('id').primaryKey().default(true),state:text('state').notNull().default('RUNNING'),updatedAt:timestamp('updated_at',{withTimezone:true}).defaultNow().notNull(),updatedBy:text('updated_by')});
export const migrationHistory=pgTable('migration_history',{version:text('version').primaryKey(),appliedAt:timestamp('applied_at',{withTimezone:true}).defaultNow().notNull()});
