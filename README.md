# GPT 划词解释

在 Chrome 中选中文字，右键选择“用 GPT 解释”，可通过本机 Codex CLI、DeepSeek V4 Flash 直连 API，或 Reasonix CLI 生成解释。

> Select text in Chrome and ask GPT to explain it in an independent popup window. Choose Codex with a ChatGPT subscription, the direct DeepSeek V4 Flash API, or DeepSeek through Reasonix CLI.

![独立解释窗口：Markdown、公式与语言切换](popup-preview-v0.3.1.png)

这是一个面向个人使用的 macOS / Windows Chrome 扩展。Chrome 扩展本身不能直接运行本机程序，因此项目由两部分组成：

- `extension/`：Manifest V3 Chrome 扩展，负责右键菜单、独立结果窗口和设置。
- `native-host/`：Native Messaging Host，负责安全调用已登录的 Codex CLI、DeepSeek API 或隔离运行的 Reasonix CLI。

## 功能

- 选中文字后通过右键菜单解释
- 在可移动、可缩放的 Chrome 独立小窗口中显示来源、生成状态和回答
- 在解释窗口中再次划词可创建继承上下文的独立分支窗口
- 每次解释和追问自动保存到本地资料库，关闭窗口或重启浏览器后仍可调阅
- 分支窗口保存精确来源指针，可从子窗口返回父窗口，也可从父窗口查看全部下游解释
- 资料库支持全文搜索、记录详情、JSON 导出和窗口关系图
- 多个解释窗口按显示器工作区自动平铺，尽量避免相互遮挡
- 每个窗口可围绕当前解释继续多轮追问，窗口之间的对话互不污染
- 本地 Marked + DOMPurify 安全渲染 Markdown，本地 KaTeX 渲染数学公式
- 复用常驻 Codex app-server，并逐段流式显示回答
- 支持 DeepSeek V4 Flash 官方 Chat Completions 流式 API，可选择关闭思考、High 或 Max
- 支持基于 Reasonix CLI 的 DeepSeek V4 Flash 调用；Reasonix 在独立临时配置目录中运行，不加载用户 MCP 配置
- 复制、停止和重新解释
- 默认使用 Luna / XHigh，可切换 Luna / Max、Sol / Medium、Sol / High，或自定义 GPT-5.6 Sol、Terra、Luna 和其他模型
- 从当前 ChatGPT 账号动态读取可用模型；旧配置不可用时自动回退到账号默认模型
- 性能策略只负责填写推荐组合；手动选择模型或 reasoning 后，以界面中的明确选择为准
- 选择 Low、Medium、High、Extra High、Max、Ultra reasoning
- 在解释窗口直接切换 English（新安装默认）、简体中文、Deutsch、Français、Italiano 或跟随原文；下一条解释或追问生效
- 设置页界面可自动跟随浏览器，或手动切换 English、简体中文、Deutsch、Français、Italiano；界面语言与回答语言互不影响
- 按当前提供方检查 Codex 登录、DeepSeek API Key 或 Reasonix CLI 状态
- 最长处理 50,000 个字符

## 系统要求

- macOS，或 64 位 Windows 10 / Windows 11
- Google Chrome 116 或更高版本
- Node.js 18 或更高版本
- 以下三种提供方至少配置一种：
  - Codex CLI 0.144.0 或更高版本，以及可使用 Codex 的 ChatGPT 账号
  - DeepSeek API Key（用于 DeepSeek V4 Flash 直连 API）
  - Reasonix CLI 与 DeepSeek API Key（npm 安装：`npm install -g reasonix`）

使用 Codex 时，先在终端确认已登录：

```bash
codex --version
codex login
codex login status
```

如果版本过旧，请按你的安装方式更新 Codex，例如 `npm install -g @openai/codex@latest`。使用 DeepSeek 时，在扩展设置页选择对应提供方并把 API Key 保存到本机 Host；Key 不会写入 Chrome 存储。

## 安装

### 1. 加载 Chrome 扩展

1. 在 Chrome 打开 `chrome://extensions`。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目的 `extension` 文件夹。
5. 记下扩展卡片上显示的 32 位“扩展程序 ID”。

### 2. 安装 Native Host

#### macOS

在终端进入项目目录，然后运行：

```bash
chmod +x native-host/install-macos.sh native-host/uninstall-macos.sh
./native-host/install-macos.sh 你的扩展ID
```

安装程序会：

- 自动找到当前终端使用的 `node`，并按需检测 `codex` 与 `reasonix`
- 把 Host 安装到 `~/Library/Application Support/GPTExplainBridge`
- 为 Chrome 创建 `com.codex.gpt_explainer` Native Messaging manifest
- 只允许你传入的扩展 ID 连接该 Host

安装完成后，打开扩展的“详情”→“扩展程序选项”，点击“检测连接”。

#### Windows

在 PowerShell 中进入项目目录，然后运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native-host\install-windows.ps1 -ExtensionId 你的扩展ID
```

也可以使用 Windows 分享包并双击 `Install-Windows.cmd`。安装程序会：

- 自动找到当前 Windows 用户使用的 `node.exe`，并按需检测 Codex 与 Reasonix CLI；同时支持原生 `.exe` 与 npm 的 `.cmd` 启动器
- 把 Host 安装到 `%LOCALAPPDATA%\GPTExplainBridge`
- 在 `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.codex.gpt_explainer` 注册 Native Messaging manifest，不需要管理员权限
- 只允许你传入的扩展 ID 连接该 Host

安装完成后刷新扩展，打开“扩展程序选项”，点击“检测连接”。

### 给其他人安装

两个系统使用名称明确区分的分享包：`GPT-Explain-Chrome-macOS-v0.4.3.zip` 和 `GPT-Explain-Chrome-Windows-v0.4.3.zip`。它们只包含扩展、对应系统的 Native Host 安装程序和说明，不包含本机生成的 `config.json`、Codex 登录或任何 API Key。macOS 用户双击 `Install.command`，Windows 用户双击 `Install-Windows.cmd`，并使用自己的扩展 ID 与账号或 API Key 完成配置。

普通 Chrome 通常会限制从 Chrome Web Store 之外直接安装 CRX，因此本项目的自用分享版采用“解压后加载 `extension` 文件夹 + 本地 Host 安装程序”。如需面向公众的一键安装和自动更新，仍需发布 Chrome Web Store，并另外分发 Native Host 安装器。

### 3. 使用

1. 打开任意普通网页。
2. 选中一段文字并右键。
3. 点击“用 GPT 解释……”。
4. 回答会显示在 Chrome 独立小窗口。
5. 在回答里再次选中文字并右键，会打开继承当前上下文的新分支窗口。
6. 在窗口底部输入问题，可继续当前窗口的对话；按 Enter 发送，Shift+Enter 换行。

在扩展设置页可以选择 AI 提供方、DeepSeek 思考模式、Codex 模型与 reasoning 强度、回答语言、回答长度和提示词。

## 提示词变量

自定义提示词支持：

- `{{text}}`：选中的文本
- `{{title}}`：网页标题
- `{{url}}`：网页地址
- `{{language}}`：语言设置值

如果模板中没有 `{{text}}`，Host 会自动把选中文字附加到末尾。

## 安全与隐私

- 扩展不会读取、复制或保存 `~/.codex/auth.json`。
- ChatGPT 登录由官方 `codex login` 管理。
- DeepSeek API Key 仅保存在本机 Native Host 的 `config.json` 中，不进入 Chrome storage，也不会打进分享包；macOS 文件权限设为 `600`，Windows 文件位于当前用户的 `%LOCALAPPDATA%`。
- 选中文字通过 Chrome Native Messaging 直接发到本机 Host，再交给所选提供方；项目没有自建服务器。
- Host 使用 Node `spawn` 的参数数组启动 Codex，`shell` 被明确关闭。
- Reasonix 使用一次性 `reasonix run`，`shell` 被明确关闭；子进程使用空白临时用户配置目录，因此不会加载用户的 MCP 服务器、`.env` 或项目配置。
- 模型名、reasoning 值、消息大小和文本长度均会校验。
- Native Host 常驻一个本地 `codex app-server` 进程；每次解释建立 ephemeral thread，并以 `read-only` sandbox、`never` approval 和禁用网络的 turn 运行。
- 提示词明确把网页选中文本视为不可信数据，并要求模型不运行工具。
- 回答由内置 Marked 解析后交给内置 DOMPurify 白名单清理，再由 KaTeX 以 `trust: false` 渲染公式；不会把模型输出直接当作可信 HTML。

请注意：内容会发送给你选择的 OpenAI/Codex 或 DeepSeek 服务，适用相应服务的数据控制、订阅或计费规则。不要解释密码、密钥或其他不应发送给模型的敏感信息。

## 常见问题

### “Specified native messaging host not found”

通常是扩展 ID 不匹配。重新复制 `chrome://extensions` 中的 ID，并再次运行安装脚本。

### `env: node: No such file or directory`

这是旧版 Host 没有为 Chrome 补入 Homebrew 路径导致的。使用当前项目重新运行安装脚本，然后回到扩展设置页再次检测连接。

### “Codex 尚未登录”

在同一 macOS 用户下运行：

```bash
codex login
codex login status
```

### 模型不可用

不同 ChatGPT 套餐、工作区策略和 Codex 版本可用的模型不同。先选择“Codex 推荐（自动）”；也可以更新 Codex 后再尝试指定模型。

### 修改代码后没有生效

在 `chrome://extensions` 点击该扩展卡片上的刷新按钮。Native Host 有修改时，需要重新运行安装脚本。

## 卸载

macOS：

```bash
./native-host/uninstall-macos.sh
```

Windows：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native-host\uninstall-windows.ps1
```

然后在 `chrome://extensions` 移除扩展。

## 开发与验证

项目不需要执行 `npm install`；KaTeX、Marked 和 DOMPurify 已作为浏览器端静态资源内置：

```bash
npm test
npm run check
```

生成可分享的 macOS 安装目录与 ZIP：

```bash
bash scripts/build-distribution.sh
```

生成名称独立的 Windows 安装目录与 ZIP：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-distribution-windows.ps1
```

产物写入被 Git 忽略的 `dist/` 目录。GitHub Actions 会在每次 push 和 pull request 时自动运行相同的测试与检查。

`npm test` 检查消息校验、提示词隔离、app-server 参数、流式事件和 Native Messaging 协议；`npm run check` 检查 Manifest、页面依赖、JavaScript 与 shell 脚本语法。

## 当前限制

- Windows 安装程序依赖系统自带的 Windows PowerShell 与 .NET Framework 来生成当前用户的 Native Host 启动器。
- Native Host 必须在每台电脑上单独安装，不能只靠 Chrome Web Store 自动安装。
- 独立窗口是普通 Chrome popup 窗口，Chrome 没有为扩展提供强制“永远置顶”的设置。
- 平铺受屏幕可用面积限制；同时打开的窗口超过所有显示器容量时，Chrome 无法保证仍有完全不重叠的可见位置。
- 模型可用性与额度由 ChatGPT 套餐、工作区设置和当前 Codex 版本决定。
- Reasonix 模式通过标准输入传递任务，并使用独立的 `REASONIX_HOME` 与显式空工具目录；与其他提供方一样支持最长 50,000 个字符的选中文本。
