-- Fixed registry UUIDs and natural keys make independent schema provisioning replay-safe.
-- DO NOTHING preserves authorized edits, retired values and original audit metadata.
DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('187_section_h_master_seed'));
  INSERT INTO master_list_types (mltuuid, list_type_key, label, section, is_system, display_order)
  VALUES
    ('8eb5b00d-55cb-4c0f-8b62-000000000187','classificationSociety','Classification Society','Components',true,80),
    ('8eb5b00d-55cb-4c0f-8b62-000000000188','surveyType','Survey Type','Components',true,81)
  ON CONFLICT (list_type_key) DO NOTHING;

  INSERT INTO master_lists (list_type,list_key,list_value,country,display_order)
  VALUES
    ('classificationSociety','ABS','American Bureau of Shipping','USA',1),
    ('classificationSociety','BV','Bureau Veritas','France',2),
    ('classificationSociety','CCS','China Classification Society','China',3),
    ('classificationSociety','DNV','DNV','Norway',4),
    ('classificationSociety','LR','Lloyd''s Register','United Kingdom',5),
    ('classificationSociety','KR','Korean Register','South Korea',6),
    ('classificationSociety','NK','Nippon Kaiji Kyokai (ClassNK)','Japan',7),
    ('classificationSociety','RINA','RINA','Italy',8),
    ('classificationSociety','IRS','Indian Register of Shipping','India',9),
    ('classificationSociety','PRS','Polish Register of Shipping','Poland',10),
    ('classificationSociety','CRS','Croatian Register of Shipping','Croatia',11),
    ('classificationSociety','RS','Russian Maritime Register of Shipping','Russia',12),
    ('classificationSociety','TL','Türk Loydu','Türkiye',13),
    ('classificationSociety','HRS','Hellenic Register of Shipping','Greece',14),
    ('classificationSociety','RBNA','Registro Brasileiro de Navios','Brazil',15),
    ('classificationSociety','IRS-US','International Register of Shipping','USA',16),
    ('classificationSociety','KST','Korean Ship Safety Technology Authority','South Korea',17),
    ('classificationSociety','MLIT','Maritime Bureau of the Ministry of Land, Infrastructure, Transport and Tourism','Japan',18),
    ('classificationSociety','BV-ES','Spanish Maritime Register / Bureau Veritas Spain','Spain',19)
  ON CONFLICT (list_type,list_key) DO NOTHING;

  INSERT INTO master_lists (list_type,list_key,list_value,category,description,display_order)
  VALUES
    ('surveyType','CLS-INI','Initial Survey','Class','Initial survey for assignment of Class',1),
    ('surveyType','CLS-ANN','Annual Survey','Class','Annual Class survey',2),
    ('surveyType','CLS-INT','Intermediate Survey','Class','Intermediate Class survey',3),
    ('surveyType','CLS-SPC','Special Survey','Class','Comprehensive Class survey, normally at 5-year intervals',4),
    ('surveyType','CLS-REN','Renewal Survey','Class','Survey for renewal of Class',5),
    ('surveyType','CLS-CON','Continuous Survey','Class','Survey carried out progressively during the Class cycle',6),
    ('surveyType','CLS-OCC','Occasional Survey','Class','Survey resulting from a specific event, alteration, or requirement',7),
    ('surveyType','CLS-DMG','Damage Survey','Class','Survey following damage or casualty',8),
    ('surveyType','CLS-RPR','Repair Survey','Class','Survey to verify repairs',9),
    ('surveyType','CLS-MOD','Modification Survey','Class','Survey following modification or alteration',10),
    ('surveyType','CLS-ADD','Additional Survey','Class','Additional survey required by Class',11),
    ('surveyType','CLS-DCK','Docking Survey','Class','Class survey requiring dry-docking',12),
    ('surveyType','CLS-IWS','In-Water Survey','Class','Underwater survey carried out without dry-docking',13),
    ('surveyType','CLS-BTM','Bottom Survey','Class','Inspection of the underwater hull/bottom',14),
    ('surveyType','STT-INI','Initial Survey','Statutory','Initial statutory survey',15),
    ('surveyType','STT-ANN','Annual Survey','Statutory','Annual statutory survey',16),
    ('surveyType','STT-INT','Intermediate Survey','Statutory','Intermediate statutory survey',17),
    ('surveyType','STT-PER','Periodical Survey','Statutory','Statutory survey performed at specified intervals',18),
    ('surveyType','STT-REN','Renewal Survey','Statutory','Survey for renewal of a statutory certificate',19),
    ('surveyType','STT-ADD','Additional Survey','Statutory','Additional statutory survey',20),
    ('surveyType','STT-OCC','Occasional Survey','Statutory','Statutory survey due to a specific event or change',21),
    ('surveyType','FLG-INI','Initial Survey','Flag State','Initial Flag State survey',22),
    ('surveyType','FLG-ANN','Annual Survey','Flag State','Annual Flag State survey',23),
    ('surveyType','FLG-INT','Intermediate Survey','Flag State','Intermediate Flag State survey',24),
    ('surveyType','FLG-REN','Renewal Survey','Flag State','Renewal survey of a Flag certificate',25),
    ('surveyType','FLG-ADD','Additional Survey','Flag State','Additional Flag State survey',26),
    ('surveyType','PSC-INS','PSC Inspection','Port State','Port State Control inspection',27),
    ('surveyType','ISM-INI','Initial Verification','ISM','Initial verification related to ISM',28),
    ('surveyType','ISM-ANN','Annual Verification','ISM','Annual ISM verification/audit',29),
    ('surveyType','ISM-INT','Intermediate Verification','ISM','Intermediate ISM verification',30),
    ('surveyType','ISM-REN','Renewal Verification','ISM','Renewal verification for ISM certification',31),
    ('surveyType','ISP-INI','Initial Verification','ISPS','Initial ISPS verification',32),
    ('surveyType','ISP-INT','Intermediate Verification','ISPS','Intermediate ISPS verification',33),
    ('surveyType','ISP-REN','Renewal Verification','ISPS','Renewal ISPS verification',34),
    ('surveyType','ISP-ADD','Additional Verification','ISPS','Additional ISPS verification',35),
    ('surveyType','MLC-INI','Initial Inspection','MLC','Initial MLC inspection',36),
    ('surveyType','MLC-INT','Intermediate Inspection','MLC','Intermediate MLC inspection',37),
    ('surveyType','MLC-REN','Renewal Inspection','MLC','Renewal MLC inspection',38),
    ('surveyType','MLC-ADD','Additional Inspection','MLC','Additional MLC inspection',39),
    ('surveyType','OTH-CON','Condition Survey','Other','General condition assessment',40),
    ('surveyType','OTH-PPS','Pre-Purchase Survey','Other','Survey before purchase/acquisition',41),
    ('surveyType','OTH-ONH','On-Hire Survey','Other','Survey when entering a charter',42),
    ('surveyType','OTH-OFH','Off-Hire Survey','Other','Survey when leaving a charter',43),
    ('surveyType','OTH-BNK','Bunker Survey','Other','Survey related to bunker quantity/condition',44),
    ('surveyType','OTH-DMG','Damage Survey','Other','General damage assessment',45),
    ('surveyType','OTH-OTH','Other Survey','Other','Survey not covered by the standard types',46)
  ON CONFLICT (list_type,list_key) DO NOTHING;
END
$migration$;
