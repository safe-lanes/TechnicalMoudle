import { pgTable, text, integer, boolean, timestamp, decimal, numeric, serial, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ====== NOON REPORT MODULE SCHEMA ======
// All tables use nr_ prefix to avoid collision with existing tables

// Fuel type enum values
export type FuelType = "HFO" | "LSMGO" | "MGO" | "LPG" | "VLSFO";
export type NoonReportStatus = "draft" | "submitted";
export type VesselCondition = "ballast" | "laden" | "in_port";
export type CIIRating = "A" | "B" | "C" | "D" | "E";

// ── nr_noon_reports ─────────────────────────────────────────────────────────
export const nrNoonReports = pgTable("nr_noon_reports", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  status: text("status").notNull().default("draft"), // draft | submitted

  // Submission metadata
  submittedAt: timestamp("submitted_at"),
  submittedBy: text("submitted_by"),
  draftSavedAt: timestamp("draft_saved_at"),

  // Report identification
  reportDate: text("report_date").notNull(), // YYYY-MM-DD
  reportTime: text("report_time"), // HH:MM UTC
  voyageNo: text("voyage_no"),
  portFrom: text("port_from"),
  portTo: text("port_to"),

  // Tab 1: Navigation
  latDegrees: numeric("lat_degrees"),
  latMinutes: numeric("lat_minutes"),
  latDirection: text("lat_direction"), // N | S
  lonDegrees: numeric("lon_degrees"),
  lonMinutes: numeric("lon_minutes"),
  lonDirection: text("lon_direction"), // E | W
  course: numeric("course"), // 0-360 degrees true
  speed: numeric("speed"), // knots
  distanceSailed: numeric("distance_sailed"), // NM

  // Fix 1: Navigation extras
  nextPort: text("next_port"),
  etaNextPort: timestamp("eta_next_port"),
  distanceToGo: numeric("distance_to_go"), // NM

  // Tab 2: Weather
  windDirection: text("wind_direction"),
  windForce: integer("wind_force"), // Beaufort 0-12
  seaState: integer("sea_state"), // Douglas 0-9
  swellHeight: numeric("swell_height"), // metres
  swellDirection: text("swell_direction"),
  visibility: text("visibility"), // Good | Moderate | Poor | Fog
  currentDirection: text("current_direction"),
  currentSpeed: numeric("current_speed"), // knots

  // Fix 2: Temperature fields
  airTemperature: numeric("air_temperature"), // °C
  seaTemperature: numeric("sea_temperature"), // °C

  // Tab 3: Machinery & Fuel
  meLoad: numeric("me_load"), // % MCR
  meRpm: numeric("me_rpm"),
  meHours: numeric("me_hours"), // running hours this period
  aeRunningHours: numeric("ae_running_hours"),
  boilerHours: numeric("boiler_hours"),

  // Fuel consumption (MT) per type
  hfoConsumption: numeric("hfo_consumption"),
  lsmgoConsumption: numeric("lsmgo_consumption"),
  mgoConsumption: numeric("mgo_consumption"),
  vlsfoConsumption: numeric("vlsfo_consumption"),
  lpgConsumption: numeric("lpg_consumption"),

  // ROB (MT) per type — at time of report
  hfoRob: numeric("hfo_rob"),
  lsmgoRob: numeric("lsmgo_rob"),
  mgoRob: numeric("mgo_rob"),
  vlsfoRob: numeric("vlsfo_rob"),
  lpgRob: numeric("lpg_rob"),

  // Fix 3: Consumables
  lubeOilConsumption: numeric("lube_oil_consumption"), // litres
  freshWaterConsumption: numeric("fresh_water_consumption"), // tons
  freshWaterProduced: numeric("fresh_water_produced"), // tons

  // Tab 4: Emissions — legacy aggregate fields
  co2Emissions: numeric("co2_emissions"), // tonnes (legacy)
  soxEmissions: numeric("sox_emissions"),
  noxEmissions: numeric("nox_emissions"),
  eeoi: numeric("eeoi"),
  ciiRating: text("cii_rating"), // A | B | C | D | E
  aer: numeric("aer"),

  // Fix 4: Per-fuel CO₂ breakdown + override
  co2Hfo: numeric("co2_hfo"),
  co2Lsmgo: numeric("co2_lsmgo"),
  co2Mgo: numeric("co2_mgo"),
  co2Vlsfo: numeric("co2_vlsfo"),
  co2Lpg: numeric("co2_lpg"),
  co2Total: numeric("co2_total"),
  emissionOverrideNotes: text("emission_override_notes"), // JSON string

  // Tab 5: Cargo / Remarks
  draftForward: numeric("draft_forward"), // metres
  draftAft: numeric("draft_aft"), // metres
  trim: numeric("trim"), // auto: draftAft - draftForward (stored for querying)
  condition: text("condition"), // ballast | laden | in_port
  cargoQuantity: numeric("cargo_quantity"), // MT
  cargoDescription: text("cargo_description"),

  // Fix 5: Split remarks (keep old remarks for backward compat)
  remarks: text("remarks"), // legacy
  generalRemarks: text("general_remarks"),
  machineryRemarks: text("machinery_remarks"),

  // Audit columns
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Soft-delete / sync flags (established pattern)
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
  uuid: text("uuid").notNull().default(sql`gen_random_uuid()`),
}, (table) => [
  index("idx_nr_reports_vessel_date").on(table.vesselId, table.reportDate),
  index("idx_nr_reports_status").on(table.status),
]);

export const insertNrNoonReportSchema = createInsertSchema(nrNoonReports).omit({
  id: true,
  uuid: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNrNoonReport = z.infer<typeof insertNrNoonReportSchema>;
export type NrNoonReport = typeof nrNoonReports.$inferSelect;

// ── nr_fuel_rob ──────────────────────────────────────────────────────────────
// Tracks the current ROB per vessel per fuel type (updated on each report)
export const nrFuelRob = pgTable("nr_fuel_rob", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  fuelType: text("fuel_type").notNull(), // HFO | LSMGO | MGO | VLSFO | LPG
  currentRob: numeric("current_rob").notNull().default("0"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(), // renamed from last_updated
  lastReportId: integer("last_report_id"),
  // Phase 2: rolling averages and endurance
  avg3Day: numeric("avg3_day"), // 3-day rolling avg consumption (MT/day)
  avg7Day: numeric("avg7_day"), // 7-day rolling avg consumption (MT/day)
  enduranceDays: numeric("endurance_days"), // days of fuel remaining at 7-day avg rate
  enduranceNm: numeric("endurance_nm"), // nautical miles remaining at 7-day avg rate
  // Audit columns
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),

  // Soft-delete / sync flags (established pattern)
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
  uuid: text("uuid").notNull().default(sql`gen_random_uuid()`),
}, (table) => [
  index("idx_nr_rob_vessel_fuel").on(table.vesselId, table.fuelType),
]);

export const insertNrFuelRobSchema = createInsertSchema(nrFuelRob).omit({
  id: true,
  uuid: true,
  updatedAt: true,
});
export type InsertNrFuelRob = z.infer<typeof insertNrFuelRobSchema>;
export type NrFuelRob = typeof nrFuelRob.$inferSelect;

// ── nr_voyage_legs ───────────────────────────────────────────────────────────
export const nrVoyageLegs = pgTable("nr_voyage_legs", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  voyageNo: text("voyage_no").notNull(),
  portFrom: text("port_from"),
  portTo: text("port_to"),
  departureDate: text("departure_date"), // YYYY-MM-DD
  arrivalDate: text("arrival_date"), // YYYY-MM-DD
  status: text("status").notNull().default("active"), // active | completed
  eeoi: numeric("eeoi"), // Phase 2: Energy Efficiency Operational Indicator
  // Audit columns
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Soft-delete / sync flags (established pattern)
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
  uuid: text("uuid").notNull().default(sql`gen_random_uuid()`),
}, (table) => [
  index("idx_nr_voyage_vessel").on(table.vesselId),
]);

export const insertNrVoyageLegSchema = createInsertSchema(nrVoyageLegs).omit({
  id: true,
  uuid: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNrVoyageLeg = z.infer<typeof insertNrVoyageLegSchema>;
export type NrVoyageLeg = typeof nrVoyageLegs.$inferSelect;

// ── nr_alerts ──────────────────────────────────────────────────────────
// Year-to-date CII (Carbon Intensity Indicator) tracking per vessel per year
export const nrCiiTracking = pgTable("nr_cii_tracking", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  year: integer("year").notNull(),
  ytdCo2Mt: numeric("ytd_co2_mt"), // year-to-date CO₂ in metric tonnes
  ytdDistanceNm: numeric("ytd_distance_nm"), // year-to-date distance sailed (NM)
  aer: numeric("aer"), // Annual Efficiency Ratio (null if DWT missing)
  ciiRating: text("cii_rating"), // A | B | C | D | E (null if DWT missing)
  previousCiiRating: text("previous_cii_rating"), // rating before last upsert (for band-drop detection)
  // Audit columns
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Soft-delete / sync flags (established pattern)
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
  nctuuid: text("nctuuid").notNull().default(sql`gen_random_uuid()`),
}, (table) => [
  uniqueIndex("idx_nr_cii_vessel_year").on(table.vesselId, table.year),
]);

export const insertNrCiiTrackingSchema = createInsertSchema(nrCiiTracking).omit({
  id: true,
  nctuuid: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNrCiiTracking = z.infer<typeof insertNrCiiTrackingSchema>;
export type NrCiiTracking = typeof nrCiiTracking.$inferSelect;

// ── nr_alerts ─────────────────────────────────────────────────────────────────
// Threshold-based alerts generated automatically after each noon report submission
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType =
  | 'HIGH_CONSUMPTION'
  | 'VERY_HIGH_CONSUMPTION'
  | 'LOW_ROB'
  | 'CRITICAL_ROB'
  | 'AE_HOURS_SPIKE'
  | 'CII_BAND_DROP'
  | 'NEGATIVE_ROB_RISK';

export const nrAlerts = pgTable("nr_alerts", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  reportId: integer("report_id"), // nullable — links to triggering report
  alertType: text("alert_type").notNull(), // AlertType
  severity: text("severity").notNull(), // 'warning' | 'critical'
  message: text("message").notNull(),
  metricValue: numeric("metric_value"), // actual measured value
  thresholdValue: numeric("threshold_value"), // configured threshold
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: text("acknowledged_by"), // user name or 'system'
  // Audit columns
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  // Soft-delete / sync flags (established pattern)
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
  nauuid: text("nauuid").notNull().default(sql`gen_random_uuid()`),
}, (table) => [
  index("idx_nr_alerts_vessel").on(table.vesselId),
  index("idx_nr_alerts_type_vessel").on(table.vesselId, table.alertType),
]);

export const insertNrAlertSchema = createInsertSchema(nrAlerts).omit({
  id: true,
  nauuid: true,
  createdAt: true,
});
export type InsertNrAlert = z.infer<typeof insertNrAlertSchema>;
export type NrAlert = typeof nrAlerts.$inferSelect;

// ── nr_bunker_records ─────────────────────────────────────────────────────────
// Bunkering Delivery Note (BDN) records — one per bunkering event per fuel type
export const nrBunkerRecords = pgTable("nr_bunker_records", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  voyageNo: text("voyage_no"),            // links to nr_voyage_legs if set
  port: text("port").notNull(),
  bunkeredDate: text("bunkered_date").notNull(), // YYYY-MM-DD
  fuelType: text("fuel_type").notNull(),  // HFO | LSMGO | MGO | VLSFO | LPG
  quantityMt: numeric("quantity_mt").notNull(),
  density: numeric("density"),            // kg/m³
  sulphurPct: numeric("sulphur_pct"),     // % m/m
  pricePmt: numeric("price_pmt"),         // USD per metric tonne
  totalCost: numeric("total_cost"),       // USD (quantity × price, auto-computed on save)
  supplier: text("supplier"),
  bdnNumber: text("bdn_number"),
  sampleSealNumber: text("sample_seal_number"), // MARPOL traceability
  remarks: text("remarks"),
  // Audit columns
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Soft-delete / sync flags (established pattern)
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
  uuid: text("uuid").notNull().default(sql`gen_random_uuid()`),
}, (table) => [
  index("idx_nr_bunker_vessel").on(table.vesselId),
  index("idx_nr_bunker_vessel_date").on(table.vesselId, table.bunkeredDate),
]);

export const insertNrBunkerRecordSchema = createInsertSchema(nrBunkerRecords).omit({
  id: true,
  uuid: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNrBunkerRecord = z.infer<typeof insertNrBunkerRecordSchema>;
export type NrBunkerRecord = typeof nrBunkerRecords.$inferSelect;
