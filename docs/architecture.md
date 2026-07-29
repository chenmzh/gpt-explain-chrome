# 架构说明

```text
网页或解释窗口选中文字
    │ contextMenus
    ▼
Chrome Service Worker ──────► Popup A / Popup B / Popup C
    │                         独立状态 / 安全 Markdown / KaTeX / 续聊
    │ Native Messaging
    ▼
本机 Node Host
    │ 一个持久 JSONL stdio 连接
    ▼
codex app-server
    │ conversationId -> ephemeral thread
    │ requestId -> active turn
    ▼
ChatGPT-managed Codex 登录与订阅额度
```

## 多窗口状态

每次划词创建唯一 `resultId`，窗口地址为 `popup.html?resultId=...`。Service Worker 使用独立的 `resultState:<resultId>` session key 保存来源、消息列表、当前请求、模型设置和父分支 ID；Native 消息通过 `requestId -> resultId` 路由，因此多个窗口可并行流式更新。

窗口映射保存为 `resultId -> windowId`。创建窗口时，扩展通过 `chrome.system.display.getInfo()` 获取所有显示器工作区，并读取已有解释窗口边界。纯函数布局器从当前显示器的右上角开始寻找第一个不相交的网格位置，然后尝试其他显示器。

## 分支与续聊

在解释窗口中再次划词时，Service Worker 从 URL 识别父 `resultId`，截取父窗口原文与消息作为 `parentContext`。子窗口的新 ephemeral thread 在首个提示词中获得这段不可信上下文，之后成为独立分支。

Native Host 保存 `conversationId -> threadId`。`followup` 请求在同一 thread 上创建新 turn；若 Host 曾重启，扩展携带的有限历史快照会用于创建新 thread 并恢复上下文。一个窗口同一时间只运行一个 turn，不同窗口不会互相取消。

## 安全渲染

流式文本先以 `textContent` 显示。120ms 防抖后，数学片段被临时替换为不可解释的占位符，剩余内容由内置 Marked 转为 Markdown HTML，再由内置 DOMPurify 使用标签和属性白名单清理。随后公式文本被恢复，并由 KaTeX 以 `trust: false`、`throwOnError: false` 渲染。

允许的内容包括段落、粗体、斜体、删除线、标题、列表、引用、代码、链接和表格。链接强制使用 `noopener noreferrer`。模型输出中的脚本、事件属性和未允许标签不会进入最终 DOM。

## 信任边界

网页文本、父上下文、历史快照和追问均是不可信输入。它们不会成为命令参数。模型名仅允许字母、数字及 `._:-`；reasoning、语言和长度来自固定集合。thread 为 ephemeral，turn 使用 `readOnly`、`networkAccess: false` 和 `approvalPolicy: never`。
