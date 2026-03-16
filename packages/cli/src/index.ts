#!/usr/bin/env node

import { Command } from "commander";
import { signupCommand } from "./commands/signup.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { forgotPasswordCommand } from "./commands/forgotPassword.js";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { publishCommand } from "./commands/publish.js";
import { unpublishCommand } from "./commands/unpublish.js";

const program = new Command();

program
  .name("loops")
  .description("Live coding tool for Webflow")
  .version("0.3.0");

// Auth
program.addCommand(signupCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(forgotPasswordCommand);

// Project management
program.addCommand(initCommand);

// Script management
program.addCommand(addCommand);
program.addCommand(removeCommand);

// Development
program.addCommand(startCommand);

// Publishing
program.addCommand(publishCommand);
program.addCommand(unpublishCommand);

// Utility
program.addCommand(statusCommand);

program.parse();
