# Response Ready Notifier

[English](#english) | [简体中文](#简体中文)

## English

Response Ready Notifier is an unofficial userscript for the ChatGPT web app that alerts you when a response is ready or user action is required. It runs locally in your browser with `@grant none` and is designed for privacy, security, and responsible use: no external requests, conversation-data collection, automated prompt submission, or bypassing of service controls.

Alerts use a short sound and an in-page toast.

The detector prioritizes avoiding premature notifications: it waits for strong completion signals and includes additional handling for reasoning, tool use, and image generation. Detection is heuristic, so no userscript can guarantee zero early, missed, or duplicate notifications after every ChatGPT interface update.

> [!IMPORTANT]
> This is an independent community project. It is not affiliated with, endorsed by, or officially approved by OpenAI.

### Installation and required Tampermonkey permissions

The instructions below use [Tampermonkey](https://www.tampermonkey.net/). Other userscript managers may also work, but their permission names and setup screens may differ.

> [!NOTE]
> There are two separate permission layers. The browser must first allow the Tampermonkey extension to execute userscripts and access ChatGPT. Response Ready Notifier itself then runs with `@grant none`, which means it requests no privileged Tampermonkey APIs. It still needs ordinary page access on the matched ChatGPT pages so it can inspect the local DOM states used for completion detection.

#### 1. Install Tampermonkey from an official source

1. Open the [official Tampermonkey website](https://www.tampermonkey.net/) and choose the store for your browser.
2. Install the extension and make sure it is enabled.
3. Pinning the Tampermonkey icon to the toolbar is optional, but makes the remaining checks easier.

Do not install a similarly named extension from an unknown publisher.

#### 2. Allow Tampermonkey to execute userscripts

This step is required for Tampermonkey 5.3 or later on Chromium-based browsers.

For Chrome 138 or later and compatible Chromium builds:

1. Right-click the Tampermonkey toolbar icon and select **Manage extension**. You can also open `chrome://extensions`, find Tampermonkey, and select **Details**.
2. Turn on **Allow User Scripts**.
3. Reload the ChatGPT tab. If Tampermonkey still reports that userscript execution is disabled, restart the browser or disable and re-enable the extension once.

If **Allow User Scripts** is not shown, including on some Chrome or Edge versions:

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Turn on **Developer mode** on the extensions page.
3. Reload the ChatGPT tab.

The toggle or Developer mode authorizes Tampermonkey to use the browser's `userScripts` API. It does not change this script's `@grant none` setting or give this script network, storage, download, clipboard, microphone, or camera privileges.

Firefox does not use Chromium's **Allow User Scripts** setting. Install Tampermonkey from its official Firefox listing, grant access to `chatgpt.com` if Firefox asks, and continue with the steps below.

#### 3. Give Tampermonkey site access

Open Tampermonkey's extension details and find **Site access**. Choose one of the following configurations:

| Configuration | What to allow | Trade-off |
| --- | --- | --- |
| **On all sites** | No additional site list is needed | Easiest and most reliable for Raw installation and automatic updates, but grants the Tampermonkey manager broad host access |
| **On specific sites** | Add `https://chatgpt.com/*` and, for legacy-domain support, `https://chat.openai.com/*` | Restricts where Tampermonkey may run; GitHub Raw installation or automatic updates may require access to `https://raw.githubusercontent.com/*` |
| **On click** | Temporary access to the current page | Not recommended: the notifier may not load automatically when ChatGPT opens or reloads |

If you choose **On specific sites** and Tampermonkey warns that limited runtime host permissions may break script updates, either allow `https://raw.githubusercontent.com/*`, switch to **On all sites**, or update the script manually. Response Ready Notifier itself remains restricted by its `@match` entries regardless of the broader access held by Tampermonkey.

#### 4. Install Response Ready Notifier

1. Open [Install Response Ready Notifier](https://raw.githubusercontent.com/Euler1024/response-ready-notifier/main/response-ready-notifier.user.js).
2. Tampermonkey should open an installation confirmation page.
3. Before selecting **Install**, verify:
   - the script name is **Response Ready Notifier**;
   - the source is the `Euler1024/response-ready-notifier` repository;
   - the matched sites are `chatgpt.com` and `chat.openai.com`;
   - the metadata shows `@grant none` and no `@require` or `@connect` entry.
4. Select **Install**.

If the Raw link opens as plain text instead of an installation page, confirm that Tampermonkey is enabled and allowed to access `raw.githubusercontent.com`. As a fallback, open the Tampermonkey dashboard, create a new script, replace the template with the complete Raw file, and save it.

#### 5. Verify that the script is active

1. Open or reload [ChatGPT](https://chatgpt.com/).
2. Confirm that the page briefly shows an `RRN` loaded toast containing the installed version.
3. Open the Tampermonkey popup and confirm that **Response Ready Notifier** is listed and enabled for the page.
4. Click once inside the ChatGPT page to satisfy the browser's audio-activation requirement.
5. Press `Ctrl+Alt+M`. A two-tone sound and an in-page test toast should appear.

The script runs only on these matched ChatGPT web addresses:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

The following permissions are not required for this project: access to local file URLs, incognito access, operating-system notification permission, downloads, clipboard, microphone, and camera.

Official permission references: [Tampermonkey FAQ: permission to execute userscripts](https://www.tampermonkey.net/faq.php?locale=en&q=Q209), [Tampermonkey FAQ: limited runtime host permissions](https://www.tampermonkey.net/faq.php?locale=en&q=Q306), and [Chrome `userScripts` API documentation](https://developer.chrome.com/docs/extensions/reference/api/userScripts).

### Features

- Plays a two-tone sound and displays an in-page toast when a response appears complete.
- Distinguishes ordinary completion from states that require approval or another user action.
- Uses additional stabilization time around reasoning, tool activity, streaming, and image generation.
- Starts monitoring after send, continue, or retry actions; manual monitoring is also available.
- Stops polling and disconnects its mutation observer while idle.
- Prevents duplicate initialization in the same page.
- Provides manual controls and privacy-reduced diagnostic output through keyboard shortcuts.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+Alt+M` | Test the sound and toast; also attempts to unlock browser audio |
| `Ctrl+Alt+S` | Start monitoring the current response manually |
| `Ctrl+Alt+N` | Enable or disable the notifier |
| `Ctrl+Alt+X` | Cancel monitoring for the current round |
| `Ctrl+Alt+B` | Print diagnostic status to the browser console |

Equivalent `Ctrl+Shift` shortcuts exist in the source but are disabled by default to avoid common browser shortcut conflicts.

### Security, privacy, and responsible-use boundaries

| Area | Current behavior |
| --- | --- |
| Userscript privileges | Runs with `@grant none` and `@noframes` |
| Network access | Makes no external requests and does not intercept network traffic |
| Local storage | Uses no cookies, Web Storage, IndexedDB, or userscript-manager storage |
| Automation | Does not click buttons, submit prompts, operate the account, or bypass access, usage, or safety controls |
| Conversation content | Does not persist or transmit prompts or responses; the prompt box is checked only for an empty/non-empty state |
| Page inspection | Reads locally visible DOM states and limited control labels needed for completion detection; it is not designed to extract the full response text |
| Diagnostics | Redacts conversation- or project-like URL paths, query parameters, and fragments before printing the current URL |

These are technical design boundaries, not a security audit, legal opinion, compliance certification, or guarantee of approval under any service terms. Users remain responsible for using the script in accordance with applicable terms, policies, and laws. Future contributions should preserve the no-extraction, no-request-automation, no-bypass, and no-data-transmission boundaries unless a change is clearly disclosed and reviewed.

### How it works

The notifier watches local page state only while a response round is active. It combines several signals, including the appearance and disappearance of stop, busy, streaming, tool, and terminal-action states. Once a sufficiently strong and stable terminal state is detected, it plays a sound and displays a toast. When no response is active, the script leaves no polling loop or `MutationObserver` running.

### Known limitations

- ChatGPT is a frequently changing web application. A DOM update may temporarily break detection.
- Detection is heuristic and may occasionally notify early, late, more than once, or not at all.
- Browsers may block sound until the user interacts with the page. Use `Ctrl+Alt+M` after clicking the page once.
- The script provides an in-page toast and audio only; it does not create operating-system notifications.
- The current version is intended for desktop web browsers. Mobile behavior has not been validated.
- Browser and userscript-manager compatibility is best effort unless a combination is explicitly reported as tested.

### Troubleshooting and bug reports

If the notifier does not behave as expected:

1. Confirm that Tampermonkey is enabled.
2. On Chromium, confirm that **Allow User Scripts** is enabled, or enable **Developer mode** if that switch is unavailable.
3. Confirm that Tampermonkey has site access to `chatgpt.com` and that **Response Ready Notifier** is enabled for the current page.
4. Reload ChatGPT and look for the `RRN` loaded toast containing the installed version.
5. Click the page once and press `Ctrl+Alt+M`.
6. Press `Ctrl+Alt+N` to make sure the notifier is enabled.
7. If installation or updates fail, check Tampermonkey's access to `raw.githubusercontent.com` or temporarily use **On all sites**.
8. Reproduce the issue, press `Ctrl+Alt+B`, and inspect the console output.
9. Open a [GitHub issue](https://github.com/Euler1024/response-ready-notifier/issues) with the browser version, userscript manager and version, script version, reproduction steps, and the relevant diagnostic state.

Before posting, remove any information you do not want to make public. Do not include conversation content, account information, private workspace names, or full unredacted URLs.

### Updates

Userscript managers should check for updates through the stable raw-file URL in the metadata block. Releases must keep the filename `response-ready-notifier.user.js` unchanged and increment `@version` together with the internal `VERSION` and `BUILD` values.

### License

Released under the [MIT License](LICENSE).

---

## 简体中文

Response Ready Notifier（回答就绪提醒器）是一个用于 ChatGPT 网页版的非官方油猴脚本，在回答就绪或需要用户操作时发出提醒。它以 `@grant none` 在浏览器本地运行，并以隐私、安全和负责任使用为设计原则：不发起外部请求、不收集对话数据、不自动提交提示词，也不绕过服务控制。

提醒由简短提示音和页内 Toast 组成。

脚本优先避免提前提醒：只有出现较强的完成信号后才提醒，并针对推理、工具调用和图片生成增加了额外等待逻辑。由于判定依赖网页状态，ChatGPT 界面更新后仍不能保证完全没有提前提醒、漏提醒或重复提醒。

> [!IMPORTANT]
> 这是独立的社区项目，与 OpenAI 不存在隶属、授权、认可或官方批准关系。

### 安装及 Tampermonkey 必要权限设置

以下步骤以 [Tampermonkey](https://www.tampermonkey.net/) 为准。其他用户脚本管理器也可能兼容，但权限名称和设置界面可能不同。

> [!NOTE]
> 这里有两层不同的权限。浏览器首先要允许 Tampermonkey 扩展执行用户脚本并访问 ChatGPT；Response Ready Notifier 本身则以 `@grant none` 运行，即不申请 Tampermonkey 的特权 API。为了判断回答状态，它仍须在匹配的 ChatGPT 页面上正常运行并读取本地 DOM 状态。

#### 1. 从官方来源安装 Tampermonkey

1. 打开 [Tampermonkey 官方网站](https://www.tampermonkey.net/)，选择自己浏览器对应的官方扩展商店。
2. 安装扩展，并确认扩展已经启用。
3. 是否把 Tampermonkey 固定到工具栏不影响功能，但固定后更方便完成后续检查。

不要安装来源不明、名称相似的扩展。

#### 2. 允许 Tampermonkey 执行用户脚本

在基于 Chromium 的浏览器中，Tampermonkey 5.3 及以上版本需要完成这一步。

对于 Chrome 138 及以上版本和提供相同设置的 Chromium 浏览器：

1. 右键单击工具栏中的 Tampermonkey 图标，选择**管理扩展程序**；也可以打开 `chrome://extensions`，找到 Tampermonkey 后进入**详细信息**。
2. 开启**允许用户脚本**（**Allow User Scripts**）。
3. 重新加载 ChatGPT 页面。如果 Tampermonkey 仍提示无法执行用户脚本，可重启浏览器，或先禁用再重新启用一次 Tampermonkey。

如果没有看到**允许用户脚本**开关，包括部分 Chrome 或 Edge 版本：

1. Chrome 打开 `chrome://extensions`，Edge 打开 `edge://extensions`。
2. 在扩展程序页面开启**开发者模式**（**Developer mode**）。
3. 重新加载 ChatGPT 页面。

上述开关或开发者模式只是授权 Tampermonkey 使用浏览器的 `userScripts` API，不会改变本脚本的 `@grant none` 设置，也不会赋予本脚本网络、存储、下载、剪贴板、麦克风或摄像头权限。

Firefox 不使用 Chromium 的**允许用户脚本**设置。请从 Firefox 的官方扩展页面安装 Tampermonkey；若 Firefox 询问是否允许访问 `chatgpt.com`，请选择允许，然后继续以下步骤。

#### 3. 设置 Tampermonkey 的网站访问权限

进入 Tampermonkey 的扩展详细信息，找到**网站访问权限**（**Site access**），按需要选择以下配置之一：

| 配置 | 需要允许的地址 | 影响 |
| --- | --- | --- |
| **在所有网站上**（**On all sites**） | 无须另行添加网站 | 安装 GitHub Raw 脚本和自动更新最省事、兼容性最好，但 Tampermonkey 管理器本身会获得较广的网站访问范围 |
| **在特定网站上**（**On specific sites**） | 添加 `https://chatgpt.com/*`；如需兼容旧域名，再添加 `https://chat.openai.com/*` | 可限制 Tampermonkey 的运行网站；通过 GitHub Raw 安装或自动更新时，可能还要允许 `https://raw.githubusercontent.com/*` |
| **点击时**（**On click**） | 临时允许当前页面 | 不推荐；打开或刷新 ChatGPT 后，提醒器可能不会自动加载 |

如果选择**在特定网站上**后，Tampermonkey 警告“有限的运行时主机权限可能影响脚本更新”，可以允许 `https://raw.githubusercontent.com/*`、改用**在所有网站上**，或以后手动更新。无论 Tampermonkey 本身获得多大的访问范围，Response Ready Notifier 仍受脚本中 `@match` 条目的限制。

#### 4. 安装 Response Ready Notifier

1. 打开[安装 Response Ready Notifier](https://raw.githubusercontent.com/Euler1024/response-ready-notifier/main/response-ready-notifier.user.js)。
2. Tampermonkey 应自动显示脚本安装确认页。
3. 单击**安装**前，核对以下信息：
   - 脚本名称为 **Response Ready Notifier**；
   - 来源是 `Euler1024/response-ready-notifier` 仓库；
   - 匹配网站为 `chatgpt.com` 和 `chat.openai.com`；
   - 元数据包含 `@grant none`，且没有 `@require` 或 `@connect` 条目。
4. 单击**安装**。

如果 Raw 链接只显示代码文本，没有出现 Tampermonkey 安装页，请先确认 Tampermonkey 已启用并获准访问 `raw.githubusercontent.com`。仍无法安装时，可以打开 Tampermonkey 管理面板，新建脚本，用完整 Raw 文件替换默认模板并保存。

#### 5. 验证脚本是否正常运行

1. 打开或重新加载 [ChatGPT](https://chatgpt.com/)。
2. 确认页面短暂显示包含当前安装版本的 `RRN` 已加载 Toast。
3. 打开 Tampermonkey 弹窗，确认当前页面列出了 **Response Ready Notifier**，且其开关已经启用。
4. 在 ChatGPT 页面内单击一次，使浏览器允许页面播放声音。
5. 按 `Ctrl+Alt+M`；此时应听到双音提示，并看到页内测试 Toast。

脚本仅在以下 ChatGPT 网页地址运行：

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

本项目不需要以下权限：访问本地文件网址、无痕模式、操作系统通知、下载、剪贴板、麦克风和摄像头。

权限设置的官方参考：[Tampermonkey FAQ：执行用户脚本所需权限](https://www.tampermonkey.net/faq.php?locale=en&q=Q209)、[Tampermonkey FAQ：有限的运行时主机权限](https://www.tampermonkey.net/faq.php?locale=en&q=Q306)和 [Chrome `userScripts` API 文档](https://developer.chrome.com/docs/extensions/reference/api/userScripts)。

### 功能

- 判断回答完成后播放双音提示，并显示页内 Toast。
- 区分普通完成状态与等待批准或其他用户操作的状态。
- 对推理、工具活动、流式输出和图片生成增加稳定等待时间。
- 在发送、继续或重试后开始监听，也支持手动启动监听。
- 空闲时停止轮询并断开 `MutationObserver`。
- 防止同一页面重复初始化脚本。
- 提供手动控制快捷键和经过隐私缩减的诊断输出。

### 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+Alt+M` | 测试提示音和 Toast，并尝试解除浏览器的音频限制 |
| `Ctrl+Alt+S` | 手动开始监听当前回答 |
| `Ctrl+Alt+N` | 开启或关闭提醒器 |
| `Ctrl+Alt+X` | 取消当前轮监听 |
| `Ctrl+Alt+B` | 在浏览器控制台输出诊断状态 |

源码中还保留了对应的 `Ctrl+Shift` 组合，但默认关闭，以避免与常用浏览器快捷键冲突。

### 安全、隐私与负责任使用边界

| 项目 | 当前行为 |
| --- | --- |
| 油猴权限 | 使用 `@grant none` 和 `@noframes` |
| 网络访问 | 不发起外部网络请求，也不拦截网络流量 |
| 本地存储 | 不使用 Cookie、Web Storage、IndexedDB 或油猴脚本管理器存储 |
| 自动化 | 不自动点击按钮、提交提示词、操作账号，也不绕过访问、使用或安全控制 |
| 对话内容 | 不持久保存或传输提示词与回答；仅以“空或非空”的布尔状态检查输入框 |
| 页面检查 | 仅读取完成判断所需的本地可见 DOM 状态和有限的控件标签，不以提取完整回答正文为目的 |
| 诊断信息 | 输出当前网址前，会隐藏类似对话或项目的路径、查询参数和片段标识 |

以上内容描述的是当前代码的技术设计边界，不构成安全审计、法律意见、合规认证，也不代表任何服务条款下的官方批准。用户仍应自行确保使用方式符合适用的条款、政策和法律。后续贡献原则上应继续保持不提取回答、不自动发送请求、不绕过控制和不传输数据的边界；如需改变，必须明确披露并经过审查。

### 工作原理

脚本只在一轮回答处于活动状态时观察本地页面状态，并综合判断停止、忙碌、流式输出、工具活动以及终止操作等状态的出现与消失。在终止状态足够明确且保持稳定后，脚本播放提示音并显示 Toast。没有活动回答时，脚本不会保留轮询循环或运行中的 `MutationObserver`。

### 已知限制

- ChatGPT 网页界面经常更新，DOM 变化可能暂时导致判定失效。
- 完成检测属于启发式判断，偶尔可能提前、延迟、重复提醒或漏提醒。
- 浏览器可能在用户与页面交互前禁止播放声音。请先点击页面，再按 `Ctrl+Alt+M` 测试。
- 脚本只提供页内 Toast 和声音，不发送操作系统通知。
- 当前版本面向桌面端网页浏览器，尚未验证移动端行为。
- 除非明确列出已经测试的组合，否则浏览器和油猴脚本管理器兼容性均按尽力支持处理。

### 故障排查与问题反馈

如果提醒器未按预期工作：

1. 确认 Tampermonkey 扩展已经启用。
2. 在 Chromium 浏览器中，确认已经开启**允许用户脚本**；若没有该开关，则开启**开发者模式**。
3. 确认 Tampermonkey 获准访问 `chatgpt.com`，并且 **Response Ready Notifier** 已在当前页面启用。
4. 重新加载 ChatGPT，并观察是否出现包含当前安装版本的 `RRN` 已加载 Toast。
5. 在页面内单击一次，然后按 `Ctrl+Alt+M`。
6. 按 `Ctrl+Alt+N`，确认提醒器处于开启状态。
7. 如果安装或自动更新失败，检查 Tampermonkey 是否可以访问 `raw.githubusercontent.com`，或暂时改为**在所有网站上**。
8. 重现问题，按 `Ctrl+Alt+B`，并检查控制台输出。
9. 在 [GitHub Issues](https://github.com/Euler1024/response-ready-notifier/issues) 中提供浏览器及版本、油猴脚本管理器及版本、脚本版本、重现步骤和相关诊断状态。

发布问题前，请删除任何不希望公开的信息。不要提交对话内容、账号信息、私有工作区名称或未经脱敏的完整网址。

### 更新

油猴脚本管理器会通过元数据中的稳定 Raw 文件地址检查更新。发布新版时必须保持文件名 `response-ready-notifier.user.js` 不变，并同步提升 `@version`、内部 `VERSION` 和 `BUILD`。

### 许可证

本项目采用 [MIT License](LICENSE)。
