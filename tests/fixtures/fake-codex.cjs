#!/usr/bin/env node
"use strict";

if (!process.argv.includes("app-server")) {
  process.stderr.write("expected app-server\n");
  process.exit(2);
}

let buffer = "";
let turnCounter = 0;
let threadCounter = 0;

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handle(message) {
  if (message.method === "initialize") {
    send({ id: message.id, result: { userAgent: "fake-codex", platformFamily: "unix", platformOs: "macos" } });
    return;
  }
  if (message.method === "initialized") return;
  if (message.method === "account/read") {
    send({ id: message.id, result: { account: { type: "chatgpt", planType: "plus" }, requiresOpenaiAuth: true } });
    return;
  }
  if (message.method === "model/list") {
    send({
      id: message.id,
      result: {
        data: [
          {
            id: "gpt-5.6-sol",
            model: "gpt-5.6-sol",
            displayName: "GPT-5.6-Sol",
            isDefault: true,
            defaultReasoningEffort: "low",
            supportedReasoningEfforts: [
              { reasoningEffort: "low" },
              { reasoningEffort: "medium" },
              { reasoningEffort: "high" }
            ]
          },
          {
            id: "gpt-5.6-terra",
            model: "gpt-5.6-terra",
            displayName: "GPT-5.6-Terra",
            isDefault: false,
            defaultReasoningEffort: "medium",
            supportedReasoningEfforts: [{ reasoningEffort: "low" }, { reasoningEffort: "medium" }]
          }
        ]
      }
    });
    return;
  }
  if (message.method === "thread/start") {
    threadCounter += 1;
    const threadId = `thread-${threadCounter}`;
    send({ id: message.id, result: { thread: { id: threadId, ephemeral: true } } });
    send({ method: "thread/started", params: { thread: { id: threadId } } });
    return;
  }
  if (message.method === "turn/start") {
    turnCounter += 1;
    const turnId = `turn-${turnCounter}`;
    const prompt = message.params?.input?.[0]?.text || "";
    const threadId = message.params.threadId;
    const answer = prompt.includes("<followup-question>")
      ? "**继续回答成功**，并保留了当前对话。"
      : (prompt.includes("不要调用任何工具") ? "公式 \\(E=mc^2\\) 解释成功" : "缺少安全边界");
    send({ id: message.id, result: { turn: { id: turnId, status: "inProgress", items: [] } } });
    send({ method: "turn/started", params: { threadId, turn: { id: turnId, status: "inProgress" } } });
    send({ method: "item/started", params: { threadId, turnId, item: { type: "agentMessage", id: `item-${turnCounter}`, phase: "final_answer", text: "" } } });
    send({ method: "item/agentMessage/delta", params: { threadId, turnId, itemId: `item-${turnCounter}`, delta: answer.slice(0, 6) } });
    send({ method: "item/agentMessage/delta", params: { threadId, turnId, itemId: `item-${turnCounter}`, delta: answer.slice(6) } });
    send({ method: "item/completed", params: { threadId, turnId, item: { type: "agentMessage", id: `item-${turnCounter}`, phase: "final_answer", text: answer } } });
    send({ method: "turn/completed", params: { threadId, turn: { id: turnId, status: "completed", items: [] } } });
    return;
  }
  if (message.method === "turn/interrupt") {
    send({ id: message.id, result: {} });
  }
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    handle(JSON.parse(line));
  }
});
