import { execFileSync } from "node:child_process";

const allowedHighVulnerabilities = new Set(["xlsx"]);

let auditJson = "";

try {
  const command =
    process.platform === "win32"
      ? ["cmd.exe", ["/d", "/s", "/c", "npm audit --audit-level=high --json"]]
      : ["npm", ["audit", "--audit-level=high", "--json"]];

  auditJson = execFileSync(command[0], command[1], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  auditJson = String(error.stdout || "");
  if (!auditJson) {
    console.error(String(error.stderr || error.message || error));
    process.exit(1);
  }
}

const audit = JSON.parse(auditJson);
const vulnerabilities = audit.vulnerabilities || {};
const blocked = Object.entries(vulnerabilities)
  .filter(([, info]) => info?.severity === "high" || info?.severity === "critical")
  .filter(([name]) => !allowedHighVulnerabilities.has(name));

if (blocked.length > 0) {
  console.error("Blocked high/critical npm audit findings:");
  for (const [name, info] of blocked) {
    console.error(`- ${name}: ${info.severity}`);
  }
  process.exit(1);
}

const allowedPresent = Object.entries(vulnerabilities)
  .filter(([name, info]) => allowedHighVulnerabilities.has(name) && info?.severity === "high")
  .map(([name]) => name);

if (allowedPresent.length > 0) {
  console.warn(
    `Allowed high npm audit findings remain: ${allowedPresent.join(", ")}. See ADMIN_RUNBOOK.md for mitigation notes.`,
  );
}

console.log("High/critical npm audit gate passed.");
