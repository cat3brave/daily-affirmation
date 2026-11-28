import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateAssessment } from "./validate-assessment.mjs";

const template = JSON.parse(
  await readFile(new URL("./assessment-template.json", import.meta.url), "utf8"),
);
const rubric = JSON.parse(await readFile(new URL("./rubric.json", import.meta.url), "utf8"));

function copyTemplate() {
  return structuredClone(template);
}

test("未確認を明示した既存テンプレートを受け入れる", () => {
  assert.deepEqual(validateAssessment(template, rubric), []);
});

test("根拠と確信度がある評価済みの軸を受け入れる", () => {
  const assessment = copyTemplate();
  assessment.dimensions.operability = {
    score: 3,
    confidence: "medium",
    evidence: ["固定fixtureによる操作テスト: 5件成功"],
    note: "実端末は未確認",
  };
  assessment.gates.verification = {
    status: "pass",
    evidence: ["node --test: 成功"],
  };

  assert.deepEqual(validateAssessment(assessment, rubric), []);
});

test("根拠なしの自己採点とpassを検出する", () => {
  const assessment = copyTemplate();
  assessment.dimensions.operability = {
    score: 4,
    confidence: "high",
    evidence: [],
    note: "",
  };
  assessment.gates.verification = { status: "pass", evidence: [] };

  const errors = validateAssessment(assessment, rubric);

  assert.ok(errors.some((error) => error.includes("dimensions.operability")));
  assert.ok(errors.some((error) => error.includes("gates.verification")));
});

test("未確認スコアと確信度の矛盾を検出する", () => {
  const assessment = copyTemplate();
  assessment.dimensions.readability.confidence = "high";

  assert.ok(
    validateAssessment(assessment, rubric).some((error) =>
      error.includes("scoreがnullの場合はconfidenceをunknown"),
    ),
  );
});

test("rubricとの評価軸・ゲートのずれを検出する", () => {
  const assessment = copyTemplate();
  delete assessment.dimensions.reliability;
  assessment.dimensions.extra = {
    score: null,
    confidence: "unknown",
    evidence: [],
    note: "",
  };
  delete assessment.gates.scope;
  assessment.gates.extra = { status: "unknown", evidence: [] };

  const errors = validateAssessment(assessment, rubric);

  assert.ok(errors.some((error) => error.includes("dimensions.reliability")));
  assert.ok(errors.some((error) => error.includes("dimensions.extra")));
  assert.ok(errors.some((error) => error.includes("gates.scope")));
  assert.ok(errors.some((error) => error.includes("gates.extra")));
});

test("評価メタデータと改善候補の不完全な記録を検出する", () => {
  const assessment = copyTemplate();
  assessment.baseCommit = "";
  assessment.evaluatedAt = "2026/11/28";
  assessment.findings = [
    {
      id: "FINDING-001",
      title: "根拠のない候補",
      dimension: "unknown-dimension",
      severity: "medium",
      impact: 4,
      reach: 2,
      confidence: 1,
      effort: 1,
      risk: 1,
      evidence: [],
      proposal: "候補",
      verification: "確認",
    },
  ];

  const errors = validateAssessment(assessment, rubric);

  assert.ok(errors.some((error) => error.includes("baseCommit")));
  assert.ok(errors.some((error) => error.includes("evaluatedAt")));
  assert.ok(errors.some((error) => error.includes("findings[0].dimension")));
  assert.ok(errors.some((error) => error.includes("findings[0].impact")));
  assert.ok(errors.some((error) => error.includes("findings[0].evidence")));
});
