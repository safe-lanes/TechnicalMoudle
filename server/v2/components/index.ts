import type { Express } from "express";
import componentRoutes from "./routes";

const V2_COMPONENT_PREFIX = "/technical/api/v2/components/component";

export function registerV2ComponentRoutes(app: Express) {
  app.use(V2_COMPONENT_PREFIX, componentRoutes);
}
