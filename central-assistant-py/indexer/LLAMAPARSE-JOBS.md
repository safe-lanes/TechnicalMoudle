# LlamaParse job register — SAIL AI Assistant knowledge base

All jobs: LlamaParse API v2, tier `agentic`, `version: "latest"` (never pinned before 11-Sep-2026),
project `0d9f6915-9661-45af-97ae-bd6b8fd35c91`. Source: the cached job/result JSON written by the
indexer at parse time (PROVEN — not reconstructed).

## Run A — the parses behind the live `migrated` set (907 chunks). THREE dates, not one.

| Parsed (UTC) | Job id | Document |
|---|---|---|
| 2026-07-02 10:26 | pjb-47me1yl49cb28kefhvmcf165xtqc | Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026.pdf |
| 2026-07-02 10:27 | pjb-orlqwdkyyn84v99j65py1g56dwdf | Technical - Defects User Manual For Office_Sail Admin_R2_13.06.2026.pdf |
| 2026-07-02 10:28 | pjb-tj9bbrpdzgrho3ydc2djy6a9brmq | Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf |
| 2026-09-09 07:39 | pjb-27ut8r5rfcxn27jwsy5wrvivwlrh | Technical - Bulk Data Import (Operational) User Manual.docx |
| 2026-09-09 07:39 | pjb-ep8tlaxs8wzy9sifwcqiwu0h7gqo | Technical - Recent Updates & Changed Behaviours (Operational) Notes.docx |
| 2026-09-09 07:40 | pjb-9cd5o9nde1obgdlpr3u57lo9ssc9 | Technical - Roles & Permissions (Operational) User Manual.docx |
| 2026-09-09 07:41 | pjb-85lpionxokq98oqbwygwmci6jt2f | Technical - Ship-Side (Vessel Crew) Operational Notes.docx |
| 2026-09-09 07:42 | pjb-a89zt3c7spv530lxubiky3stp68j | Technical - Sync (Operational) User Manual.docx |
| 2026-09-10 08:40 | pjb-sm9seuw8uy0jyxu6tfcb5vhgdzi2 | Audit - Fleet Sharing Manual- Office_R1_30.06.2026.pdf |
| 2026-09-10 08:40 | pjb-pn8tcqfbh49vtwmljzg8rx5alqh6 | Audit - Fleet Sharing Manual- Vessel_R1_30.06.2026.pdf |
| 2026-09-10 08:41 | pjb-lmiio82abpt4h1024ojpq42kqka7 | Audit - History Manual_R1_30.06.2026.pdf |
| 2026-09-10 08:41 | pjb-r2hkseqtkfzqidr39apyqfhvy6zn | Audit - Preparation Manual_Office_R1_30.06.2026.pdf |
| 2026-09-10 08:42 | pjb-bwkd6c8b9rlsmxz5u6jvs07tmugb | Crewing - Crewing User Manual R2_10.06.2026.pdf |
| 2026-09-10 08:44 | pjb-ecm9ms32operq2jz1xo5imj8tgt2 | Incident - Fleet Notification User Manual_Vessel_ R0_20.03.2026.pdf |
| 2026-09-10 08:44 | pjb-dnhgm0eibmzh5uy18i1lts5nci35 | Incident - Incident User Manual R0_20.05.2026.pdf |
| 2026-09-10 08:45 | pjb-56z21j1ykspivn1bepr3aocowf09 | Incident - Lesson Learnt User Manual_Vessel_R0_30.05.2026.pdf |
| 2026-09-10 08:46 | pjb-flcnp4kar88h8cwh5eyrgqwppqy4 | Incident - Near Miss User Manual R1_30.05.2026.pdf |
| 2026-09-10 08:46 | pjb-g7n01i9td7iqkpf5fgcyk1wde60w | Safety - Master Review Manual R1_10.06.2026.pdf |
| 2026-09-10 08:47 | pjb-vw5k1zkcanlah2roviovuhansvux | Safety - MOC User Manual_Office_R0_31.03.2026.pdf |
| 2026-09-10 08:48 | pjb-j1nrlewrxizyfs48gdwjpxq5bjsq | Safety - MOC User Manual_Vessel_R0_31.03.2026.pdf |
| 2026-09-10 08:48 | pjb-myl3rfk6c4qhpqnar6bss2vsnpte | Safety - Risk Assessment User Manual_Office_R1_30.05.2026.pdf |
| 2026-09-10 08:50 | pjb-pifbmmczmlfilhkhxteb0k9jz6dv | Safety - Risk Assessment User Manual_Vessel_R1_30.05.2026.pdf |
| 2026-09-10 08:50 | pjb-umm4ctgekptav14altpkix3sy9vm | Safety - Safety Meeting User Manual_R1_31.05.2026.pdf |
| 2026-09-10 08:51 | pjb-1bwi09k19oay2z3ga39bh7mf7u5s | Safety - SMS User Manual_Office_R0_31.01.2026.pdf |
| 2026-09-10 08:52 | pjb-l2ze0ezrctshln8easylcdpukf7j | Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf |

Note: the three 2-Jul jobs now return HTTP 404 from `GET /api/v2/parse/{id}` (LlamaCloud appears
to purge job records after ~2 months); the 9/10-Sep jobs still resolve.

## Run B — fresh re-parse 11-Sep-2026 through the Python indexer (`py-llamaparse` set, 908 chunks)
`disable_cache: true` (LlamaCloud-side cache bypassed), tier `agentic`, `version: "latest"`.

| Parsed (UTC) | Job id | Document |
|---|---|---|
| 2026-09-11 10:31 | pjb-y56p9ttbi6y49scgigth2slok6dx | Incident - Lesson Learnt User Manual_Vessel_R0_30.05.2026.pdf |
| 2026-09-11 10:31 | pjb-ghhukdx2e10u3wllsd0dbobnsn3s | Audit - Fleet Sharing Manual- Office_R1_30.06.2026.pdf |
| 2026-09-11 10:32 | pjb-1pp395li719ftn8z0b3lao9bjska | Audit - Fleet Sharing Manual- Vessel_R1_30.06.2026.pdf |
| 2026-09-11 10:33 | pjb-jh20dc5yne1fyivcg9pmjuselamk | Audit - History Manual_R1_30.06.2026.pdf |
| 2026-09-11 10:33 | pjb-p1dpo2welbesmet0a9kwocrwtmqh | Audit - Preparation Manual_Office_R1_30.06.2026.pdf |
| 2026-09-11 10:35 | pjb-vm4ier6jjnx2c91oa0t8oocf2art | Crewing - Crewing User Manual R2_10.06.2026.pdf |
| 2026-09-11 10:36 | pjb-5my3tzug250swiogd0817lvovvo5 | Incident - Fleet Notification User Manual_Vessel_ R0_20.03.2026.pdf |
| 2026-09-11 10:36 | pjb-chveuq34sxpvz0ea4xl0xkt2c7rf | Incident - Incident User Manual R0_20.05.2026.pdf |
| 2026-09-11 10:37 | pjb-qae0a5thk7yor2xdquribcomew1m | Incident - Near Miss User Manual R1_30.05.2026.pdf |
| 2026-09-11 10:38 | pjb-ttsilghy77gxu8ub5bwhs8tgt1ia | Safety - MOC User Manual_Office_R0_31.03.2026.pdf |
| 2026-09-11 10:40 | pjb-4xeb39afbllqeoi1ezbvo9yvy4qz | Safety - MOC User Manual_Vessel_R0_31.03.2026.pdf |
| 2026-09-11 10:41 | pjb-cytbsp6fdtbrvvwh3ru99keevebx | Safety - Master Review Manual R1_10.06.2026.pdf |
| 2026-09-11 10:41 | pjb-yxwuhgn13aqlc9taa68ko5ksg5ws | Safety - Risk Assessment User Manual_Office_R1_30.05.2026.pdf |
| 2026-09-11 10:42 | pjb-epk17p0nd53rhksqpx0q24igw36l | Safety - Risk Assessment User Manual_Vessel_R1_30.05.2026.pdf |
| 2026-09-11 10:43 | pjb-03ve6em8i57n8mb379i6k8cl5d1h | Safety - SMS User Manual_Office_R0_31.01.2026.pdf |
| 2026-09-11 10:44 | pjb-9y0or4cswn62jtdv6u4ki0xi5ufk | Safety - Safety Meeting User Manual_R1_31.05.2026.pdf |
| 2026-09-11 10:45 | pjb-ovyr8uxljt9jgoejcg0hu5au0z68 | Technical - Bulk Data Import (Operational) User Manual.docx |
| 2026-09-11 10:46 | pjb-jxzigooowsw8rp3qpb8kw1ambxht | Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026.pdf |
| 2026-09-11 10:47 | pjb-l6rkeao7nf5xr1wqu43xqg50op4p | Technical - Defects User Manual For Office_Sail Admin_R2_13.06.2026.pdf |
| 2026-09-11 10:47 | pjb-afhmnqsjyac2pf8ml33pjr61hc4q | Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf |
| 2026-09-11 10:49 | pjb-fh8v7ntc9p95n3h2t2mhf8xskddd | Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf |
| 2026-09-11 10:51 | pjb-3f9cndoy659k6z72yqavmu3200hs | Technical - Recent Updates & Changed Behaviours (Operational) Notes.docx |
| 2026-09-11 10:51 | pjb-gi50samddvdkxhm3222oqk8kc0ic | Technical - Roles & Permissions (Operational) User Manual.docx |
| 2026-09-11 10:52 | pjb-cqdfuoce7a4awlkqd5t9y27hiekm | Technical - Ship-Side (Vessel Crew) Operational Notes.docx |
| 2026-09-11 10:52 | pjb-j2h70i6g49ducqdrwib5s093hwbv | Technical - Sync (Operational) User Manual.docx |

(A first dry-run job for Lesson Learnt, pjb-pvy7sr4f4lx4hn6uxd3faaugjrv4 at 10:29, completed
but its result was not written — cache-dir permission — so the document was parsed twice.)

## Run C — pinned-version re-parse (to be filled in when run)
