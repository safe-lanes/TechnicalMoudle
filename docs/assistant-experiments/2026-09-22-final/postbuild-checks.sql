-- Post-build checks for the corrected candidate index kb-xref-d (reviewer step 2 + 3). Read-only.
\echo '=== 1. document rows (fed to manifest_check.py index) ==='
select count(*) as documents, sum(chunks) as chunks from assistant_documents where index_set='kb-xref-d';
\echo '=== 2. build key(s) in use (must be ONE key = the frozen candidate key, xrefs=2026-09-22.3, repairs=2026-09-14.1) ==='
select count(*), regexp_replace(build_key, '^[^|]*\|', '') from assistant_documents where index_set='kb-xref-d' and build_key is not null group by 2;
\echo '=== 3. KB files present (want 5) and chunk identity vs kb-pilot-e (4 identical, 1 changed = how-work-orders) ==='
select d.file, d.chunks, (select md5(c.content) from assistant_chunks c where c.index_set='kb-xref-d' and c.file=d.file limit 1) = (select md5(c.content) from assistant_chunks c where c.index_set='kb-pilot-e' and c.file=d.file limit 1) as same_as_kb_pilot_e
from assistant_documents d where d.index_set='kb-xref-d' and d.file like '%KB pilot%' order by 1;
\echo '=== 4. PDF chunk sets vs the frozen candidate kb-xref-c (want 0 / 0: the resolver output is unchanged) ==='
with a as (select file, md5(content) h from assistant_chunks where index_set='kb-xref-c' and file like '%.pdf'),
     b as (select file, md5(content) h from assistant_chunks where index_set='kb-xref-d' and file like '%.pdf')
select 'only in kb-xref-c' as which, count(*) from (select * from a except select * from b) x
union all select 'only in kb-xref-d', count(*) from (select * from b except select * from a) y;
\echo '=== 5. R3 docx chunk sets vs kb-pilot-e (want 0 / 0 for the four unchanged operational documents) ==='
with a as (select file, md5(content) h from assistant_chunks where index_set='kb-pilot-e' and file like '%.docx' and file not like '%Recent Updates%'),
     b as (select file, md5(content) h from assistant_chunks where index_set='kb-xref-d' and file like '%.docx' and file not like '%Recent Updates%')
select 'only in kb-pilot-e' as which, count(*) from (select * from a except select * from b) x
union all select 'only in kb-xref-d', count(*) from (select * from b except select * from a) y;
\echo '=== 6. resolved cross-references: chunks carrying "Cross-reference resolved" and source_quote metadata (want 41 / 41 as in kb-xref-c) ==='
select index_set, count(*) filter (where content ilike '%cross-reference resolved%') as resolved_chunks,
       count(*) filter (where metadata::text like '%source_quote%') as with_source_quote
from assistant_chunks where index_set in ('kb-xref-c','kb-xref-d') group by 1 order by 1;
\echo '=== 7. known facts in the indexed text of kb-xref-d ==='
select 'R2 wrong: Job Code must be filled' as fact, count(*) from assistant_chunks where index_set='kb-xref-d' and file like '%Bulk Data%' and content ilike '%must be filled in%'
union all select 'R3 right: Job Code optional', count(*) from assistant_chunks where index_set='kb-xref-d' and file like '%Bulk Data%' and content ilike '%optional%' and content ilike '%job code%'
union all select 'R2 wrong: Sync Masters populates vessel code', count(*) from assistant_chunks where index_set='kb-xref-d' and content ilike '%sync masters%'
union all select 'R3 right: vessel code via provisioning', count(*) from assistant_chunks where index_set='kb-xref-d' and file like '%Recent Updates%' and content ilike '%provision%' and content ilike '%vessel code%'
union all select 'R2 wrong: HOD can do everything an office user can', count(*) from assistant_chunks where index_set='kb-xref-d' and content ilike '%everything an office user%'
union all select 'R3 right: HOD Me / My Team', count(*) from assistant_chunks where index_set='kb-xref-d' and file like '%Roles%' and content ilike '%my team%'
union all select 'R2 wrong: one Sync Now press clears backlog', count(*) from assistant_chunks where index_set='kb-xref-d' and content ilike '%single press can clear%'
union all select 'R3 right: Sync Now backlog wording', count(*) from assistant_chunks where index_set='kb-xref-d' and file like '%Sync (Op%' and content ilike '%sync now%' and content ilike '%backlog%'
union all select 'R5 wrong: Both refusals belong to Generate Now only', count(*) from assistant_chunks where index_set='kb-xref-d' and content ilike '%both refusals%'
union all select 'R6 right: only the ROLE refusal belongs to Generate Now', count(*) from assistant_chunks where index_set='kb-xref-d' and content ilike '%only the role refusal%'
union all select 'R6 right: per-job Generate WO requires the switch (Recent Updates 1.1.14.6.3)', count(*) from assistant_chunks where index_set='kb-xref-d' and file like '%Recent Updates%' and content ilike '%1.1.14.6.3%' and content ilike '%switch must be enabled%'
union all select 'R6 right: Generate Now = Sail Admin AND switch (1.1.14.6.1)', count(*) from assistant_chunks where index_set='kb-xref-d' and file like '%Recent Updates%' and content ilike '%role must be Sail Admin%'
union all select 'R6 right: unplanned needs neither (1.1.14.6.4)', count(*) from assistant_chunks where index_set='kb-xref-d' and content ilike '%neither the Sail Admin rule nor the office work-order generation switch%'
union all select 'kb-r6: switch applies to BOTH office routes', count(*) from assistant_chunks where index_set='kb-xref-d' and file like '%KB pilot%' and content ilike '%BOTH office routes%'
union all select 'KB: Sail Admin requirement belongs to Generate Now only', count(*) from assistant_chunks where index_set='kb-xref-d' and file like '%KB pilot%' and content ilike '%Sail Admin requirement belongs to%'
union all select 'KB provenance line present (want 5)', count(*) from assistant_chunks where index_set='kb-xref-d' and file like '%KB pilot%' and content like 'Provenance note:%' or (index_set='kb-xref-d' and file like '%KB pilot%' and content like '%Provenance note: draft code-derived%');
\echo '=== 8. the one R6 sentence, as indexed ==='
select left(substring(content from position('Only the ROLE refusal' in content) for 420), 420) from assistant_chunks where index_set='kb-xref-d' and content like '%Only the ROLE refusal%';
