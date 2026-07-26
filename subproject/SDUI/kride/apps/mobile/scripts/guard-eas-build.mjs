#!/usr/bin/env node
/**
 * EAS 중복 빌드 가드.
 *
 * 2026-07-23 에 같은 SHA/runtime/versionCode 로 preview 빌드가 2건 실행됐다
 * (약 8.9분 + 9.9분). DEPLOYMENT.md 에 사전 확인 절차가 있었지만
 * `npm run eas:build:preview` 가 그 절차를 건너뛰고 바로 `eas build` 를
 * 호출했기 때문이다. 이 스크립트를 빌드 명령 앞에 두어 우회를 막는다.
 *
 * 사용법:
 *   node scripts/guard-eas-build.mjs <profile> [--allow-duplicate]
 *
 * 종료 코드:
 *   0  같은 좌표의 빌드가 없다. 진행해도 된다.
 *   1  이미 존재하거나(진행 중/완료) 확인에 실패했다. 빌드하지 않는다.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MOBILE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM = "android";
// 아직 산출물이 나올 수 있거나 이미 나온 상태. 이 좌표로 또 빌드하면 낭비다.
const BLOCKING_STATUSES = new Set(["NEW", "IN_QUEUE", "IN_PROGRESS", "PENDING", "FINISHED"]);

const [, , profileArg, ...flags] = process.argv;
const profile = profileArg ?? "preview";
const allowDuplicate = flags.includes("--allow-duplicate");

function run(command, args) {
  return execFileSync(command, args, {
    cwd: MOBILE_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  }).trim();
}

function fail(message) {
  console.error(`\n[eas-guard] ${message}\n`);
  process.exit(1);
}

const appJson = JSON.parse(readFileSync(resolve(MOBILE_DIR, "app.json"), "utf8")).expo;
const version = appJson.version;
const versionCode = String(appJson.android?.versionCode ?? "");
// runtimeVersion policy 가 appVersion 이면 runtime 은 곧 app version 이다.
const runtimeVersion =
  typeof appJson.runtimeVersion === "string" ? appJson.runtimeVersion : version;

if (!version || !versionCode) {
  fail("app.json 에서 version 또는 android.versionCode 를 읽지 못했습니다.");
}

let sha;
try {
  sha = run("git", ["rev-parse", "HEAD"]);
} catch {
  fail("git SHA 를 확인하지 못했습니다.");
}

const isDirty = (() => {
  try {
    return run("git", ["status", "--porcelain"]).length > 0;
  } catch {
    return false;
  }
})();

console.log(
  `[eas-guard] profile=${profile} platform=${PLATFORM} version=${version} ` +
    `runtime=${runtimeVersion} versionCode=${versionCode} sha=${sha.slice(0, 9)}` +
    (isDirty ? " (working tree dirty)" : "")
);

// 플래그 이름은 eas-cli 기준이다: 빌드 프로필 필터는 --profile 이 아니라
// --build-profile 이며, 잘못 주면 build:list 전체가 실패한다.
const listArgs = [
  "build:list",
  "--platform",
  PLATFORM,
  "--build-profile",
  profile,
  "--runtime-version",
  runtimeVersion,
  "--app-build-version",
  versionCode,
  "--limit",
  "30",
  "--json",
  "--non-interactive",
];
// 워킹 트리가 깨끗할 때만 SHA 로 서버측 필터링을 건다. 더러우면 커밋 SHA 가
// 실제 산출물을 대표하지 못하므로 좌표(runtime/versionCode)로만 조회한다.
if (!isDirty) {
  listArgs.push("--git-commit-hash", sha);
}

let raw;
try {
  raw = run("eas", listArgs);
} catch (error) {
  const detail = (error.stderr || error.stdout || error.message || "").toString().trim();
  fail(
    "eas build:list 를 실행하지 못해 중복 여부를 확인할 수 없습니다. " +
      "확인 없이 빌드하지 않습니다 (fail-closed).\n" +
      detail
  );
}

let builds;
try {
  builds = JSON.parse(raw);
} catch {
  fail(`eas build:list 출력을 JSON 으로 해석하지 못했습니다.\n${raw.slice(0, 500)}`);
}

if (!Array.isArray(builds)) {
  fail("eas build:list 가 배열을 반환하지 않았습니다.");
}

// 워킹 트리가 더러우면 커밋 SHA 로는 산출물이 같다고 보장할 수 없다.
// 그때는 SHA 대신 runtime/versionCode 좌표만으로 진행 중 빌드를 막는다.
const duplicates = builds.filter((build) => {
  if (!BLOCKING_STATUSES.has(String(build.status ?? "").toUpperCase())) return false;
  if (isDirty) return String(build.status).toUpperCase() !== "FINISHED";
  return build.gitCommitHash === sha;
});

if (duplicates.length === 0) {
  console.log("[eas-guard] 같은 좌표의 기존 빌드가 없습니다. 빌드를 진행합니다.");
  process.exit(0);
}

console.error(
  `\n[eas-guard] 같은 좌표(runtime ${runtimeVersion} / versionCode ${versionCode}` +
    `${isDirty ? "" : ` / SHA ${sha.slice(0, 9)}`})의 빌드가 ${duplicates.length}건 있습니다:`
);
for (const build of duplicates) {
  const url = build.id
    ? `https://expo.dev/accounts/${build.project?.ownerAccount?.name ?? "_"}/projects/${
        build.project?.slug ?? "kride-mobile"
      }/builds/${build.id}`
    : "(URL 없음)";
  console.error(`  - ${build.status} ${build.createdAt ?? ""} ${url}`);
}

if (allowDuplicate) {
  console.error("[eas-guard] --allow-duplicate 가 지정되어 그대로 진행합니다.");
  process.exit(0);
}

fail(
  "JS 전용 변경이면 새 binary build 대신 OTA 를 쓰세요:\n" +
    "  npm run eas:update:preview -- \"메시지\"\n" +
    "네이티브 경계가 실제로 바뀌었다면 app.json 의 version/runtimeVersion 과\n" +
    "android.versionCode 를 올린 뒤 다시 실행하세요.\n" +
    "의도적으로 중복 빌드를 실행하려면 --allow-duplicate 를 붙이세요."
);
