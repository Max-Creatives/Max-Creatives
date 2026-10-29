import "dotenv/config";
import { getGenerators } from "@prisma/internals";
import { PrismaClientJsGenerator } from "@prisma/client-generator-js";
// The standard CLI eagerly fetches a native migration engine even for generation.
// Use the same version-pinned Prisma generator in process; this client uses WASM.
async function main() {
  const generators = await getGenerators({
    schemaPath: "prisma/schema.prisma",
    cliCommand: "npm run db:generate",
    skipDownload: true,
    registry: {
      "prisma-client-js": {
        type: "in-process",
        generator: new PrismaClientJsGenerator({
          cliCommand: "npm run db:generate",
        }),
      },
    },
  });
  try {
    for (const generator of generators) await generator.generate();
  } finally {
    for (const generator of generators) generator.stop();
  }
  console.log("Prisma client generated using the npm-supplied WASM compiler.");
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Client generation failed.",
  );
  process.exitCode = 1;
});
