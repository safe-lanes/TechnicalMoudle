import { pgTable, text, integer, boolean, timestamp, decimal, numeric, serial, date, index } from "drizzle-orm/pg-core";
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

  // Tab 2: Weather
  windDirection: text("wind_direction"),
  windForce: integer("wind_force"), // Beaufort 0-12
  seaState: integer("sea_state"), // Douglas 0-9
  swellHeight: numeric("swell_height"), // metres
  swellDirection: text("swell_direction"),
  visibility: text("visibility"), // Good | Moderate | Poor | Fog
  currentDirection: text("current_direction"),
  currentSpeed: numeric("current_speed"), // knots

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

  // Tab 4: Emissions (some calculated server-side)
  co2Emissions: numeric("co2_emissions"), // tonnes
  soxEmissions: numeric("sox_emissions"),
  noxEmissions: numeric("nox_emissions"),
  eeoi: numeric("eeoi"),
  ciiRating: text("cii_rating"), // A | B | C | D | E
  aer: numeric("aer"),

  // Tab 5: Cargo / Remarks
  draftForward: numeric("draft_forward"), // metres
  draftAft: numeric("draft_aft"), // metres
  trim: numeric("trim"), // auto: draftAft - draftForward (stored for querying)
  condition: text("condition"), // ballast | laden | in_port
  cargoQuantity: numeric("cargo_quantity"), // MT
  cargoDescription: text("cargo_description"),
  remarks: text("remarks"),

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
