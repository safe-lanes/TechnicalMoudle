import type { Express } from "express";
import runningHoursRouter from "./routes";

export function registerV2RunningHoursModule(app: Express) {
  app.use("/technical/api/v2", runningHoursRouter);
  console.log("V2 Running Hours module registered at /technical/api/v2/running-hours/* and /technical/api/v2/rh-config/*");
}
