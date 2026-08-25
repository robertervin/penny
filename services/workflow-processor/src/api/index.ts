import { loadConfig } from "../config/env.js";
import { startApiServer } from "./server.js";

const config = loadConfig();
startApiServer(config).catch((err) => {
  console.error(err);
  process.exit(1);
});
