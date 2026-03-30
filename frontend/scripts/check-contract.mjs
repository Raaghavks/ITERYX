import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..", "..");
const contractPath = path.join(rootDir, "contracts", "api-contract.json");
const apiPath = path.join(rootDir, "frontend", "lib", "api.ts");
const typesPath = path.join(rootDir, "frontend", "types", "index.ts");

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const apiSource = fs.readFileSync(apiPath, "utf8");
const typesSource = fs.readFileSync(typesPath, "utf8");

const failures = [];

for (const marker of contract.frontendMarkers) {
  if (!apiSource.includes(marker)) {
    failures.push(`Missing frontend API marker: ${marker}`);
  }
}

function extractUnion(name) {
  const pattern = new RegExp(`export type ${name} = ([^;]+);`);
  const match = typesSource.match(pattern);
  if (!match) {
    failures.push(`Could not find union type ${name} in frontend/types/index.ts`);
    return [];
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

const priorityLevels = extractUnion("Priority");
const bedStatuses = extractUnion("BedStatus");

if (JSON.stringify(priorityLevels) !== JSON.stringify(contract.enums.priorityLevels)) {
  failures.push(
    `Priority union mismatch. Expected ${contract.enums.priorityLevels.join(", ")}, got ${priorityLevels.join(", ")}`
  );
}

if (JSON.stringify(bedStatuses) !== JSON.stringify(contract.enums.bedStatuses)) {
  failures.push(
    `BedStatus union mismatch. Expected ${contract.enums.bedStatuses.join(", ")}, got ${bedStatuses.join(", ")}`
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("Frontend contract verification passed.");
