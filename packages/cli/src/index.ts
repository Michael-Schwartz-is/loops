#!/usr/bin/env node
import { program } from "commander";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { exportCommand } from "./commands/exportCmd.js";
import { clearLogsCommand } from "./commands/clearLogs.js";

program
  .name("loops")
  .description("Live coding tool for Webflow")
  .version("0.1.0");

program
  .command("init <project-name>")
  .description("Create a new Loops project")
  .option("--api-url <url>", "API URL", "http://localhost:8787")
  .action(initCommand);

program
  .command("add <project> <script-name>")
  .description("Add a script to a project")
  .action(addCommand);

program
  .command("remove <project> <script-name>")
  .description("Remove a script from a project")
  .action(removeCommand);

program
  .command("start")
  .description("Watch all projects and sync scripts/logs")
  .option("--poll-interval <ms>", "Log poll interval in ms", "3000")
  .action(startCommand);

program
  .command("status")
  .description("Show all projects and scripts")
  .action(statusCommand);

program
  .command("export <project>")
  .description("Export scripts for self-hosting")
  .option("--inline", "Output code ready to paste in Webflow")
  .action(exportCommand);

program
  .command("clear-logs <project>")
  .description("Delete all logs for a project (remote + local)")
  .action(clearLogsCommand);

program.parse();
