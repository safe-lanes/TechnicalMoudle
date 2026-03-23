import { pgTable, text, integer, boolean, timestamp, decimal, numeric, serial, date, index, uniqueIndex } from "drizzle-orm/pg-core";
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

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_nr_reports_vessel_date").on(table.vesselId, table.reportDate),
  index("idx_nr_reports_status").on(table.status),
]);

export const insertNrNoonReportSchema = createInsertSchema(nrNoonReports).omit({
  id: true,
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
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  lastReportId: integer("last_report_id"),
  // Phase 2: rolling averages and endurance
  avg3Day: numeric("avg3_day"), // 3-day rolling avg consumption (MT/day)
  avg7Day: numeric("avg7_day"), // 7-day rolling avg consumption (MT/day)
  enduranceDays: numeric("endurance_days"), // days of fuel remaining at 7-day avg rate
  enduranceNm: numeric("endurance_nm"), // nautical miles remaining at 7-day avg rate
}, (table) => [
  index("idx_nr_rob_vessel_fuel").on(table.vesselId, table.fuelType),
]);

export const insertNrFuelRobSchema = createInsertSchema(nrFuelRob).omit({
  id: true,
  lastUpdated: true,
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_nr_voyage_vessel").on(table.vesselId),
]);

export const insertNrVoyageLegSchema = createInsertSchema(nrVoyageLegs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNrVoyageLeg = z.infer<typeof insertNrVoyageLegSchema>;
export type NrVoyageLeg = typeof nrVoyageLegs.$inferSelect;

// ── nr_cii_tracking ──────────────────────────────────────────────────────────
// Year-to-date CII (Carbon Intensity Indicator) tracking per vessel per year
export const nrCiiTracking = pgTable("nr_cii_tracking", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  year: integer("year").notNull(),
  ytdCo2Mt: numeric("ytd_co2_mt"), // year-to-date CO₂ in metric tonnes
  ytdDistanceNm: numeric("ytd_distance_nm"), // year-to-date distance sailed (NM)
  aer: numeric("aer"), // Annual Efficiency Ratio (null if DWT missing)
  ciiRating: text("cii_rating"), // A | B | C | D | E (null if DWT missing)
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_nr_cii_vessel_year").on(table.vesselId, table.year),
]);

export const insertNrCiiTrackingSchema = createInsertSchema(nrCiiTracking).omit({
  id: true,
  updatedAt: true,
});
export type InsertNrCiiTracking = z.infer<typeof insertNrCiiTrackingSchema>;
export type NrCiiTracking = typeof nrCiiTracking.$inferSelect;
