ALTER TABLE vessel_org_chart_nodes
  ADD COLUMN IF NOT EXISTS node_layer TEXT NOT NULL DEFAULT 'department';
