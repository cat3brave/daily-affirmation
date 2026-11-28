#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const CONFIDENCE_VALUES = new Set(["high", "medium", "low", "unknown"]);
const GATE_STATUS_VALUES = new Set(["pass", "fail", "unknown"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasEvidence(evidence) {
  return (
    Array.isArray(evidence) &&
    evidence.length > 0 &&
    evidence.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

export function validateAssessment(assessment, rubric) {
  const errors = [];

  if (!isRecord(assessment)) {
    return ["assessment: JSONオブジェクトである必要があります"];
  }
  if (!isRecord(rubric)) {
    return ["rubric: JSONオブジェクトである必要があります"];
  }

  const dimensions = isRecord(assessment.dimensions) ? assessment.dimensions : {};
  const gates = isRecord(assessment.gates) ? assessment.gates : {};
  const rubricDimensions = Array.isArray(rubric.dimensions) ? rubric.dimensions : [];
  const rubricGates = Array.isArray(rubric.gates) ? rubric.gates : [];

  for (const field of ["assessmentVersion", "app", "scope", "baseCommit", "headCommit"]) {
    if (typeof assessment[field] !== "string" || assessment[field].trim().length === 0) {
      errors.push(`${field}: 空でない文字列にしてください`);
    }
  }
  if (
    typeof assessment.evaluatedAt !== "string" ||
    (assessment.evaluatedAt !== "YYYY-MM-DD" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(assessment.evaluatedAt))
  ) {
    errors.push("evaluatedAt: YYYY-MM-DD形式にしてください");
  }
  if (
    typeof assessment.assessmentVersion === "string" &&
    typeof rubric.version === "string" &&
    assessment.assessmentVersion !== rubric.version
  ) {
    errors.push("assessmentVersion: rubric.versionと一致させてください");
  }

  if (!isRecord(assessment.dimensions)) {
    errors.push("dimensions: オブジェクトである必要があります");
  }
  if (!isRecord(assessment.gates)) {
    errors.push("gates: オブジェクトである必要があります");
  }

  const dimensionIds = new Set(rubricDimensions.map(({ id }) => id));
  for (const { id } of rubricDimensions) {
    const dimension = dimensions[id];
    const path = `dimensions.${id}`;

    if (!isRecord(dimension)) {
      errors.push(`${path}: rubricにある評価軸がありません`);
      continue;
    }

    const scoreIsValid =
      dimension.score === null ||
      (Number.isInteger(dimension.score) && dimension.score >= 0 && dimension.score <= 4);
    if (!scoreIsValid) {
      errors.push(`${path}.score: 0〜4の整数またはnullにしてください`);
    }
    if (!CONFIDENCE_VALUES.has(dimension.confidence)) {
      errors.push(`${path}.confidence: high/medium/low/unknownのいずれかにしてください`);
    }
    if (!Array.isArray(dimension.evidence)) {
      errors.push(`${path}.evidence: 文字列配列にしてください`);
    }

    if (dimension.score === null && dimension.confidence !== "unknown") {
      errors.push(`${path}: scoreがnullの場合はconfidenceをunknownにしてください`);
    }
    if (dimension.score !== null && scoreIsValid) {
      if (dimension.confidence === "unknown") {
        errors.push(`${path}: scoreを付ける場合はconfidenceをunknown以外にしてください`);
      }
      if (!hasEvidence(dimension.evidence)) {
        errors.push(`${path}: scoreを付ける場合は空でないevidenceが必要です`);
      }
    }
  }

  for (const id of Object.keys(dimensions)) {
    if (!dimensionIds.has(id)) {
      errors.push(`dimensions.${id}: rubricにない評価軸です`);
    }
  }

  const gateIds = new Set(rubricGates.map(({ id }) => id));
  for (const { id } of rubricGates) {
    const gate = gates[id];
    const path = `gates.${id}`;

    if (!isRecord(gate)) {
      errors.push(`${path}: rubricにある必須ゲートがありません`);
      continue;
    }
    if (!GATE_STATUS_VALUES.has(gate.status)) {
      errors.push(`${path}.status: pass/fail/unknownのいずれかにしてください`);
    }
    if (!Array.isArray(gate.evidence)) {
      errors.push(`${path}.evidence: 文字列配列にしてください`);
    }
    if (gate.status === "pass" && !hasEvidence(gate.evidence)) {
      errors.push(`${path}: passには空でないevidenceが必要です`);
    }
  }

  for (const id of Object.keys(gates)) {
    if (!gateIds.has(id)) {
      errors.push(`gates.${id}: rubricにない必須ゲートです`);
    }
  }

  if (!Array.isArray(assessment.findings)) {
    errors.push("findings: 配列である必要があります");
  } else {
    const findingIds = new Set();
    for (const [index, finding] of assessment.findings.entries()) {
      const path = `findings[${index}]`;
      if (!isRecord(finding)) {
        errors.push(`${path}: オブジェクトにしてください`);
        continue;
      }

      for (const field of ["id", "title", "severity", "proposal", "verification"]) {
        if (typeof finding[field] !== "string" || finding[field].trim().length === 0) {
          errors.push(`${path}.${field}: 空でない文字列にしてください`);
        }
      }
      if (typeof finding.id === "string" && finding.id.trim().length > 0) {
        if (findingIds.has(finding.id)) errors.push(`${path}.id: findings内で重複しています`);
        findingIds.add(finding.id);
      }
      if (!dimensionIds.has(finding.dimension)) {
        errors.push(`${path}.dimension: rubricにある評価軸を指定してください`);
      }
      for (const field of ["impact", "reach", "confidence", "effort", "risk"]) {
        if (!Number.isInteger(finding[field]) || finding[field] < 1 || finding[field] > 3) {
          errors.push(`${path}.${field}: 1〜3の整数にしてください`);
        }
      }
      if (!hasEvidence(finding.evidence)) {
        errors.push(`${path}.evidence: 空でない文字列配列にしてください`);
      }
    }
  }

  return errors;
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`${label}を読み込めません: ${error.message}`);
  }
}

async function main() {
  const assessmentPath = process.argv[2];
  const rubricPath =
    process.argv[3] ?? fileURLToPath(new URL("./rubric.json", import.meta.url));

  if (!assessmentPath) {
    console.error(
      "使い方: node docs/ai-improvement-harness/validate-assessment.mjs <assessment.json> [rubric.json]",
    );
    process.exitCode = 2;
    return;
  }

  const assessment = await readJson(assessmentPath, "評価JSON");
  const rubric = await readJson(rubricPath, "rubric");
  const errors = validateAssessment(assessment, rubric);

  if (errors.length > 0) {
    console.error(`評価JSONに${errors.length}件の不整合があります:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("評価JSONの構造と根拠条件を確認しました。");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
