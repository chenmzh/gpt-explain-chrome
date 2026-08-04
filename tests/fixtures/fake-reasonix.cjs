#!/usr/bin/env node
"use strict";

if (process.argv.includes("--version")) {
  process.stdout.write("reasonix v-test\n");
  process.exit(0);
}

let prompt = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { prompt += chunk; });
process.stdin.on("end", () => {
  if (!prompt.trim()) process.exit(2);
  const events = [
    { kind: "turn_started" },
    { kind: "text", text: "Reasonix " },
    { kind: "text", text: "streams " },
    { kind: "text", text: "now." },
    { kind: "message", text: "Reasonix streams now." },
    {
      type: "result",
      subtype: "success",
      is_error: false,
      result: "Reasonix streams now.",
      duration_ms: 60,
      num_turns: 1
    }
  ];
  events.forEach((event, index) => {
    setTimeout(() => process.stdout.write(`${JSON.stringify(event)}\n`), index * 15);
  });
});
