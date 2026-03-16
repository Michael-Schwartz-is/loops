import { Command } from "commander";
import { createInterface } from "readline";
import { getConvexClient } from "../convex.js";
import { api } from "@loops/convex/convex/_generated/api";

export const forgotPasswordCommand = new Command("forgot-password")
  .description("Reset your password")
  .action(async () => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, resolve));

    try {
      const email = await ask("Email: ");

      const client = getConvexClient();
      await client.action(api.passwordResetActions.requestPasswordReset, { email });

      console.log("\nIf that email exists, a reset code has been sent.");
      const code = await ask("Enter the 6-digit code: ");
      const newPassword = await ask("New password: ");

      await client.action(api.passwordResetActions.completePasswordReset, {
        email,
        code,
        newPassword,
      });

      console.log("Password reset! Run: loops login");
    } catch (err: any) {
      console.error("Reset failed:", err.message);
      process.exit(1);
    } finally {
      rl.close();
    }
  });
