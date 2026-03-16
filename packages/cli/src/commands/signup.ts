import { Command } from "commander";
import { createInterface } from "readline";
import { getConvexClient } from "../convex.js";
import { saveCredentials } from "../credentials.js";
import { api } from "@loops/convex/convex/_generated/api";

export const signupCommand = new Command("signup")
  .description("Create a Loops account")
  .action(async () => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, resolve));

    try {
      const email = await ask("Email: ");
      const password = await ask("Password: ");

      const client = getConvexClient();
      const result = await client.action(api.userActions.createUser, {
        email,
        password,
      });

      saveCredentials({
        email,
        publicKey: result.publicKey,
        privateKey: result.privateKey,
      });

      console.log("\nAccount created!");
      console.log(`Public key: ${result.publicKey}`);
      console.log("Credentials saved to ~/.loops/credentials");
    } catch (err: any) {
      console.error("Signup failed:", err.message);
      process.exit(1);
    } finally {
      rl.close();
    }
  });
