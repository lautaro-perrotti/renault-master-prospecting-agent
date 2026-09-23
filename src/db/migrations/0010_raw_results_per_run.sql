ALTER TABLE raw_search_results DROP CONSTRAINT IF EXISTS raw_search_results_provider_query_result_url_key;
CREATE UNIQUE INDEX IF NOT EXISTS raw_search_run_provider_query_url_uq ON raw_search_results(run_id,provider,query,result_url);
