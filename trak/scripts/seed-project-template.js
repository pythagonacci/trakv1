#!/usr/bin/env node

const path = require("node:path");
const dotenv = require("dotenv");

const projectRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(projectRoot, ".env.local") });
dotenv.config({ path: path.join(projectRoot, ".env") });

try {
  require("tsconfig-paths").register({
    baseUrl: projectRoot,
    paths: {
      "@/*": ["src/*"],
    },
  });
} catch (_error) {
  // Best effort only. Jiti can still load relative imports without path aliases.
}

const { createJiti } = require("jiti");
const jiti = createJiti(__filename);
const {
  seedProjectTemplateFromMarkdownFile,
} = jiti(path.join(projectRoot, "src/lib/project-templates/source-project-seeder.ts"));

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file || !args["workspace-id"]) {
    console.error(
      "Usage: node scripts/seed-project-template.js --file <markdown-path> --workspace-id <workspace-id> [--slug <slug>] [--template-name <name>] [--description <text>] [--category <name>] [--icon <icon>] [--visibility global|workspace] [--min-plan free|standard|business] [--sort-order <n>] [--actor-user-id <user-id>]"
    );
    process.exit(1);
  }

  const result = await seedProjectTemplateFromMarkdownFile({
    filePath: args.file,
    sourceWorkspaceId: args["workspace-id"],
    slug: args.slug,
    templateName: args["template-name"],
    description: args.description ?? null,
    category: args.category ?? null,
    icon: args.icon ?? null,
    visibility: args.visibility,
    minPlan: args["min-plan"],
    sortOrder: args["sort-order"] ? Number(args["sort-order"]) : undefined,
    actorUserId: args["actor-user-id"] ?? null,
    replaceExisting: args["replace-existing"] !== "false",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
