
import { ModuleFederationPlugin } from "@module-federation/enhanced/webpack";

export const moduleFederationConfig = {
  name: "element-crew-appraisals",
  filename: "remoteEntry.js",
  exposes: {
    "./App": "./client/src/App.tsx"
  },
  shared: {
    react: {
      singleton: true,
      requiredVersion: "^18.3.1"
    },
    "react-dom": {
      singleton: true,
      requiredVersion: "^18.3.1"
    },
    "@tanstack/react-query": {
      singleton: true
    }
  }
};
