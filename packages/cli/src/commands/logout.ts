import { Command } from "commander";
import { deleteCredentials } from "../credentials.js";

export const logoutCommand = new Command("logout")
  .description("Log out of your Loops account")
  .action(() => {
    deleteCredentials();
    console.log("Logged out. Credentials removed.");
  });
