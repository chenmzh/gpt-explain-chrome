import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function frame(message) {
  const payload = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length);
  return Buffer.concat([header, payload]);
}

function nativeClient(child) {
  let buffer = Buffer.alloc(0);
  const messages = [];
  const waiters = [];

  child.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (buffer.length < length + 4) break;
      const message = JSON.parse(buffer.subarray(4, length + 4).toString("utf8"));
      buffer = buffer.subarray(length + 4);
      messages.push(message);
      for (const waiter of [...waiters]) {
        if (waiter.predicate(message)) {
          waiter.resolve(message);
          waiters.splice(waiters.indexOf(waiter), 1);
        }
      }
    }
  });

  return {
    messages,
    send(message) { child.stdin.write(frame(message)); },
    waitFor(predicate, timeoutMs = 4_000) {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolvePromise, reject) => {
        const waiter = { predicate, resolve: resolvePromise };
        waiters.push(waiter);
        const timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error(`Timed out waiting for native message. Received: ${JSON.stringify(messages)}`));
        }, timeoutMs);
        const originalResolve = waiter.resolve;
        waiter.resolve = (value) => { clearTimeout(timer); originalResolve(value); };
      });
    }
  };
}

test("native protocol reports health and returns an explanation", async (t) => {
  const workDir = mkdtempSync(join(tmpdir(), "gpt-explain-test-"));
  const fakeCodex = resolve(root, "tests/fixtures/fake-codex.cjs");
  chmodSync(fakeCodex, 0o755);
  const configPath = join(workDir, "config.json");
  writeFileSync(configPath, JSON.stringify({ codexPath: fakeCodex }));
  t.after(() => rmSync(workDir, { recursive: true, force: true }));

  const child = spawn(process.execPath, [resolve(root, "native-host/host.cjs")], {
    env: { ...process.env, GPT_EXPLAIN_CONFIG_PATH: configPath },
    stdio: ["pipe", "pipe", "pipe"]
  });
  t.after(() => child.kill("SIGTERM"));
  const client = nativeClient(child);

  client.send({ type: "health", requestId: "health-1" });
  const health = await client.waitFor((message) => message.type === "healthResult");
  assert.equal(health.ok, true);
  assert.equal(health.models[0].id, "gpt-5.6-sol");
  assert.equal(health.defaultModel, "GPT-5.6-Sol");

  client.send({
    type: "explain",
    requestId: "explain-1",
    conversationId: "conversation-1",
    text: "解释供需关系",
    pageTitle: "测试",
    pageUrl: "https://example.com",
    settings: {
      model: "gpt-5.6",
      reasoning: "medium",
      language: "zh-CN",
      responseLength: "normal",
      promptTemplate: "解释：{{text}}"
    }
  });

  await client.waitFor((message) => message.type === "done");
  const resolved = client.messages.find((message) => message.type === "modelResolved");
  assert.equal(resolved.model, "gpt-5.6-sol");
  const answer = client.messages
    .filter((message) => message.type === "answerDelta")
    .map((message) => message.text)
    .join("");
  assert.equal(answer, "公式 \\(E=mc^2\\) 解释成功");
  assert.equal(client.messages.filter((message) => message.type === "answerReset").length, 0);

  const beforeFollowup = client.messages.length;
  client.send({
    type: "followup",
    requestId: "followup-1",
    conversationId: "conversation-1",
    text: "再解释一次",
    history: "此前解释过供需关系",
    settings: {
      model: "gpt-5.6-sol",
      reasoning: "medium",
      language: "zh-CN",
      responseLength: "normal",
      promptTemplate: "解释：{{text}}"
    }
  });
  await client.waitFor((message) => message.type === "done" && message.requestId === "followup-1");
  const followupAnswer = client.messages.slice(beforeFollowup)
    .filter((message) => message.type === "answerDelta" && message.requestId === "followup-1")
    .map((message) => message.text)
    .join("");
  assert.match(followupAnswer, /继续回答成功/);

  for (const suffix of ["a", "b"]) {
    client.send({
      type: "explain",
      requestId: `parallel-${suffix}`,
      conversationId: `parallel-conversation-${suffix}`,
      text: `并行解释 ${suffix}`,
      pageTitle: "并行测试",
      pageUrl: "https://example.com",
      settings: {
        model: "gpt-5.6-terra",
        reasoning: "low",
        language: "zh-CN",
        responseLength: "brief",
        promptTemplate: "解释：{{text}}"
      }
    });
  }
  await Promise.all(["a", "b"].map((suffix) => client.waitFor(
    (message) => message.type === "done" && message.requestId === `parallel-${suffix}`
  )));
  assert.equal(client.messages.some((message) => (
    message.type === "canceled" && message.requestId.startsWith("parallel-")
  )), false);
});
