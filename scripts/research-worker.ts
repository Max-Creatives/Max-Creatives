import "dotenv/config";
import { processResearch } from "../src/lib/research/queue";
import { db } from "../src/lib/db";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function main() {
  console.log(
    "Research worker started; only queued research jobs are processed. No messages are sent.",
  );
  while (!stopping) {
    try {
      if (!(await processResearch()))
        await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch {
      console.error("Research worker iteration failed; will retry.");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
main().finally(() => db.$disconnect());
