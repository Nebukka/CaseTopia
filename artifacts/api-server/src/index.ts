import app from "./app";
import { logger } from "./lib/logger";
import { seedOfficialCases, seedAdminUser, seedDailyCases } from "./seed";
import cron from "node-cron";
import { runImportJob } from "./services/gameImporter";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  seedAdminUser().catch((e) => logger.error({ err: e }, "Seed admin user error"));
  seedOfficialCases().catch((e) => logger.error({ err: e }, "Seed error"));
  seedDailyCases().catch((e) => logger.error({ err: e }, "Seed daily cases error"));

  // Run initial game catalog seed on startup (won't duplicate — upsert logic)
  runImportJob("pragmaticplay").then(r => {
    logger.info({ imported: r.imported, updated: r.updated, source: r.source }, "Game catalog import complete");
  }).catch((e) => logger.error({ err: e }, "Game catalog import error"));

  // Schedule daily re-import at midnight to pick up any new games from providers
  cron.schedule("0 0 * * *", () => {
    logger.info("Running scheduled game catalog import");
    runImportJob("pragmaticplay").catch((e) => logger.error({ err: e }, "Scheduled import error"));
  });
});
