import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const CASES = {
  "TC-01": {
    title: "Flowchart: order processing",
    terms: [
      /\bstart\b/i, /\bpayment\b/i, /\bapproved\b/i, /\bdeclined\b/i,
      /\binventory\b/i, /\bcancel(?:led|ed|lation)?\b/i, /\brefund\b/i,
      /\bship(?:ped|ping)?\b/i, /\bnotif(?:y|ies|ication)\b/i, /\bend\b/i,
    ],
  },
  "TC-02": {
    title: "ER diagram: library borrowing",
    terms: [
      /\bmembers?\b/i, /\bbooks?\b/i, /\bbookcopies\b/i, /\bloans?\b/i,
      /\bloan.?date\b/i, /\bdue.?date\b/i, /\breturn.?date\b/i,
      /\bstatus\b/i, /\b(?:primary.?key|\bPK\b)/i, /\b(?:foreign.?key|\bFK\b)/i,
    ],
  },
  "TC-03": {
    title: "UML class diagram: course registration",
    terms: [
      /\bstudents?\b/i, /\bcourses?\b/i, /\binstructors?\b/i,
      /\benrollments?\b/i, /\benrollment.?date\b/i, /\bstatus\b/i,
    ],
  },
  "TC-04": {
    title: "DFA: binary strings ending in 01",
    terms: [
      /\bstart\b/i, /\baccept(?:ing|ed)?\b/i, /\b0\b/, /\b1\b/,
    ],
  },
  "TC-05": {
    title: "NFA: strings containing ab",
    terms: [
      /\bstart\b/i, /\baccept(?:ing|ed)?\b/i, /\ba\b/, /\bb\b/,
    ],
  },
  "TC-06": {
    title: "Data structure: singly linked list",
    terms: [
      /\bhead\b/i, /\b12\b/, /\b24\b/, /\b36\b/, /\bdata\b/i,
      /\bnext\b/i, /\bnull\b/i,
    ],
  },
};

function checkDot(source) {
  const hasGraphDeclaration = /^\s*(?:strict\s+)?(?:di)?graph\b/im.test(source);
  const open = [];
  const closing = { ")": "(", "]": "[", "}": "{" };
  let quote = null;
  let escaped = false;

  for (const char of source) {
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
    } else if ("([{".includes(char)) {
      open.push(char);
    } else if (")]}".includes(char)) {
      if (open.pop() !== closing[char]) return false;
    }
  }

  return hasGraphDeclaration && !quote && open.length === 0;
}

function validateOutput(output) {
  const testCase = CASES[output.caseId];
  if (!testCase) {
    return {
      caseId: output.caseId ?? null,
      model: output.model ?? "unspecified",
      status: "INVALID_INPUT",
      error: "Unknown caseId. Use TC-01 through TC-06.",
    };
  }

  const source = typeof output.rawOutput === "string" ? output.rawOutput : "";
  const termChecks = testCase.terms.map((pattern) => ({
    check: pattern.source,
    found: pattern.test(source),
  }));
  const syntaxValid = checkDot(source);
  const allTermsFound = termChecks.every((item) => item.found);

  return {
    caseId: output.caseId,
    caseTitle: testCase.title,
    model: output.model || "unspecified",
    modelVersion: output.modelVersion || "not provided",
    checks: {
      rawOutputProvided: source.trim().length > 0,
      basicDotStructure: syntaxValid ? "PASS" : "FAIL",
      requiredTermsFound: `${termChecks.filter((item) => item.found).length}/${termChecks.length}`,
      termDetails: termChecks,
    },
    overall: source.trim() && syntaxValid && allTermsFound ? "PASS" : "FAIL",
    limitations: [
      "Keyword matching is a basic screening check, not semantic validation.",
      "DOT parsing, visual layout, and diagram correctness were not verified.",
      "Acceptance examples and subjective quality require manual review.",
    ],
    manualReview: "NOT PERFORMED",
  };
}

function runSelfTest() {
  const valid = checkDot('digraph G { start -> payment [label="approved"]; }');
  const invalid = checkDot("digraph G { start -> end;");
  if (!valid || invalid) throw new Error("Validator self-test failed.");
  console.log("Validator self-test passed (no model outputs were tested).");
}

async function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const inputPath = process.argv[2];
  if (!inputPath || inputPath.startsWith("--")) {
    console.error("Usage: node validate-test-cases.mjs <outputs.json> [report.json]");
    console.error("Use --self-test to check the validator itself.");
    process.exitCode = 2;
    return;
  }

  const input = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  if (!Array.isArray(input.outputs)) {
    throw new Error('Input JSON must contain an "outputs" array.');
  }

  const results = input.outputs.map(validateOutput);
  const report = {
    generatedAt: new Date().toISOString(),
    reportType: "Local output screening; not an external model comparison",
    source: inputPath,
    outputsSupplied: results.length,
    passed: results.filter((result) => result.overall === "PASS").length,
    failed: results.filter((result) => result.overall === "FAIL").length,
    results,
    note: "A PASS only means the basic checks passed; it is not proof of diagram correctness or a model comparison.",
  };

  const reportPath = process.argv[3];
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (reportPath) {
    await writeFile(resolve(reportPath), serialized, "utf8");
    console.log(`Report written to ${reportPath}`);
  } else {
    console.log(serialized);
  }
  if (report.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
