// ==UserScript==
// @name         Response Ready Notifier
// @name:zh-CN   回答就绪提醒器
// @namespace    https://github.com/Euler1024
// @version      1.0.5
// @description  An unofficial userscript for the ChatGPT web app that alerts you when a response is ready or user action is required. It runs locally in your browser with @grant none and is designed for privacy, security, and responsible use: no external requests, conversation-data collection, automated prompt submission, or bypassing of service controls.
// @description:zh-CN 用于 ChatGPT 网页版的非官方油猴脚本：回答就绪或需要用户操作时发出提醒。脚本以 @grant none 在浏览器本地运行，注重隐私、安全与负责任使用：不发起外部请求，不收集对话数据，不自动提交提示词，也不绕过服务控制。
// @author       Euler1024
// @license      MIT
// @homepageURL  https://github.com/Euler1024/response-ready-notifier
// @supportURL   https://github.com/Euler1024/response-ready-notifier/issues
// @updateURL    https://raw.githubusercontent.com/Euler1024/response-ready-notifier/main/response-ready-notifier.user.js
// @downloadURL  https://raw.githubusercontent.com/Euler1024/response-ready-notifier/main/response-ready-notifier.user.js
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '1.0.5';
  const BUILD = '1.0.5-public';
  const INSTANCE_KEY = '__RRN_V105_PUBLIC__';

  if (window[INSTANCE_KEY]) {
    console.log('[RRN] Script already running. Skip duplicate init.');
    return;
  }

  try {
    Object.defineProperty(window, INSTANCE_KEY, {
      value: { version: VERSION, build: BUILD },
      writable: true,
      configurable: true
    });
  } catch (_) {
    window[INSTANCE_KEY] = { version: VERSION, build: BUILD };
  }

  const CONFIG = {
    DEBUG: false,
    SHOW_LOAD_TOAST: true,

    // A round begins only after a user send/continue/retry action or the manual hotkey.
    INTENT_DEBOUNCE_MS: 700,
    PENDING_TIMEOUT_MS: 45 * 1000,
    MAX_ROUND_MS: 2 * 60 * 60 * 1000,
    KEEP_ON_URL_CHANGE_MS: 45 * 1000,

    // No polling or MutationObserver exists while idle.
    PENDING_POLL_VISIBLE_MS: 800,
    PENDING_POLL_HIDDEN_MS: 1900,
    ACTIVE_POLL_VISIBLE_MS: 1250,
    ACTIVE_POLL_HIDDEN_MS: 3200,
    LONG_TASK_AFTER_MS: 5 * 60 * 1000,
    LONG_TASK_POLL_VISIBLE_MS: 4200,
    LONG_TASK_POLL_HIDDEN_MS: 8500,

    ASSISTANT_SCAN_MIN_INTERVAL_MS: 800,
    CONTROL_SCAN_MIN_INTERVAL_MS: 350,
    STREAM_SCAN_MIN_INTERVAL_MS: 650,
    MUTATION_EVALUATE_DELAY_MS: 180,
    CONTENT_ACTIVITY_THROTTLE_MS: 180,

    // Primary path: a real Stop/busy state disappeared continuously.
    // Reply DOM quietness is intentionally NOT required on this path.
    STOP_GONE_GRACE_MS: 2800,
    BUSY_GONE_GRACE_MS: 3600,
    TOOL_BUSY_GONE_GRACE_MS: 9000,
    STREAM_GONE_GRACE_MS: 4300,
    MIN_RESPONSE_AGE_STRONG_MS: 1400,
    MIN_BUSY_VISIBLE_MS: 350,

    // Terminal controls are a second strong path.
    FINAL_ACTION_STABLE_MS: 1300,
    WAIT_ACTION_STABLE_MS: 900,
    MIN_RESPONSE_AGE_TERMINAL_MS: 1800,

    // No-busy fallback: stricter than v1.0.3 to reduce premature reminders.
    NO_BUSY_QUIET_MS: 9000,
    NO_BUSY_MIN_RESPONSE_AGE_MS: 12 * 1000,
    NO_BUSY_HARD_CAP_MS: 75 * 1000,
    NO_BUSY_MIN_CONTENT_BATCHES: 1,

    // Ignore stale streaming attributes after visible activity has ended.
    STREAM_STALE_IGNORE_MS: 20 * 1000,

    // Generated images can delay the reminder briefly, but never indefinitely.
    IMAGE_WAIT_LIMIT_MS: 25 * 1000,

    NOTIFY_COOLDOWN_MS: 5000,

    ENABLE_SOUND: true,
    ENABLE_PAGE_TOAST: true,

    // Disabled by default because Ctrl+Shift shortcuts commonly conflict with browsers.
    ENABLE_CTRL_SHIFT_HOTKEYS: false,

    SOUND: {
      TYPE: 'triangle',
      FREQ_1: 880,
      FREQ_2: 1174,
      DURATION_1: 0.16,
      DURATION_2: 0.20,
      GAP: 0.06,
      VOLUME: 0.20
    }
  };

  const SELECTORS = {
    PROMPT: [
      '#prompt-textarea',
      '[data-testid="prompt-textarea"]',
      '[data-testid*="prompt-textarea"]',
      '[contenteditable="plaintext-only"][role="textbox"]',
      '[contenteditable="true"][role="textbox"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Ask"]',
      'textarea'
    ].join(','),

    ASSISTANT_MARKER: [
      '[data-message-author-role="assistant"]',
      '[data-author="assistant"]',
      '[data-role="assistant"]',
      '[data-testid="assistant-turn"]',
      '[data-testid*="assistant-message"]'
    ].join(','),

    ANSWER_SHELL: [
      '.markdown',
      '[class*="markdown"]',
      '.prose',
      '[class*="prose"]',
      '[data-testid="markdown"]',
      '[data-message-content]',
      '[data-message-content-part]',
      '[data-testid="message-content"]',
      '[data-testid*="message-content"]',
      '[data-writing-block]',
      '[class*="writing-block"]',
      'pre code'
    ].join(','),

    STREAMING: [
      '[data-is-streaming="true"]',
      '[data-streaming="true"]',
      '[data-state="streaming"]',
      '[data-state="generating"]',
      '[data-state="thinking"]',
      '[data-state="reasoning"]',
      '[data-state="researching"]',
      '[data-state="browsing"]',
      '[data-state="running"]',
      '[data-state="working"]',
      '[aria-busy="true"]'
    ].join(','),

    TOOL_LIKE: [
      '[data-state="researching"]',
      '[data-state="browsing"]',
      '[data-state="running"]',
      '[data-state="working"]',
      '[data-state="awaiting-approval"]',
      '[data-testid*="agent"]',
      '[data-testid*="deep-research"]',
      '[data-testid*="research-progress"]',
      '[data-testid*="task-progress"]',
      '[data-testid*="computer-use"]'
    ].join(','),

    CONTROL: [
      'button',
      '[role="button"]',
      '[data-testid*="send"]',
      '[data-testid*="submit"]',
      '[data-testid*="stop"]',
      '[data-testid*="continue"]',
      '[data-testid*="resume"]',
      '[data-testid*="regenerate"]',
      '[data-testid*="retry"]',
      '[data-testid*="copy"]',
      '[data-testid*="feedback"]',
      '[aria-label]',
      '[title]'
    ].join(','),

    DECORATION: [
      'button',
      '[role="button"]',
      '[role="toolbar"]',
      '[role="menu"]',
      '[role="menuitem"]',
      '[role="tooltip"]',
      '[data-radix-popper-content-wrapper]',
      '[data-testid*="copy"]',
      '[data-testid*="feedback"]',
      '[data-testid*="reaction"]',
      '[data-testid*="share"]',
      '[data-testid*="toolbar"]',
      '[data-testid*="message-action"]',
      '[class*="toolbar"]',
      '[class*="tooltip"]',
      'svg',
      'path',
      'use'
    ].join(',')
  };

  const state = {
    enabled: true,
    stage: 'idle', // idle | pending | active
    roundId: 0,
    currentUrl: location.href,

    armAt: 0,
    armReason: '',
    lastIntentAt: 0,
    confirmedAt: 0,
    confirmReason: '',
    manualRound: false,
    trackCurrent: false,
    promptHadContentAtArm: false,

    baselineAssistantRoots: null,
    baselineAssistantCount: 0,
    baselineLatestAssistantRoot: null,
    currentAssistantCount: 0,
    activeAssistantRoot: null,
    activeRootIsNew: false,
    lastAssistantScanAt: 0,

    sawAssistantCandidate: false,
    firstResponseAt: 0,
    lastContentActivityAt: 0,
    contentMutationBatches: 0,
    rawMutationBatches: 0,
    ignoredMutationBatches: 0,

    sawStop: false,
    stopFirstSeenAt: 0,
    lastStopSeenAt: 0,
    stopGoneAt: 0,
    stopSampleCount: 0,

    sawStreaming: false,
    streamFirstSeenAt: 0,
    lastStreamSeenAt: 0,
    streamGoneAt: 0,
    streamSampleCount: 0,

    sawBusy: false,
    busyFirstSeenAt: 0,
    lastBusySeenAt: 0,
    busyGoneAt: 0,
    busySampleCount: 0,
    sawToolLike: false,

    finalActionSeenAt: 0,
    finalActionKinds: [],
    waitActionSeenAt: 0,

    pendingImageCount: 0,
    imageWaitStartedAt: 0,
    trackedImages: null,

    observer: null,
    observerRoot: null,
    observerMode: 'none',
    pollTimer: null,
    evalTimer: null,
    evalDueAt: 0,
    toastTimer: null,

    lastControlScanAt: 0,
    cachedControls: null,
    lastStreamScanAt: 0,
    cachedStreamSnapshot: null,

    evaluating: false,
    evaluateAgain: false,
    notifying: false,

    audioContext: null,
    audioUnlocked: false,
    audioWarningPrinted: false,

    lastNotifyAt: 0,
    lastDecision: null
  };

  function log(...args) {
    if (CONFIG.DEBUG) console.log('[RRN]', ...args);
  }

  function nowMs() {
    return Date.now();
  }

  // Keep full URLs internally for navigation detection, but never print conversation IDs,
  // project IDs, query strings, or fragments in diagnostics intended for issue reports.
  function redactUrlForDebug(value) {
    try {
      const url = new URL(String(value || ''), location.origin);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length === 0) return `${url.origin}/`;
      return `${url.origin}/${parts[0]}${parts.length > 1 ? '/[redacted]' : ''}`;
    } catch (_) {
      return '[unavailable]';
    }
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/\u200b/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function lowerText(value) {
    return normalizeText(value).toLowerCase();
  }

  function closestElement(node) {
    if (!node) return null;
    if (node.nodeType === Node.ELEMENT_NODE) return node;
    return node.parentElement || null;
  }

  function safeQueryAll(root, selector) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (_) {
      return [];
    }
  }

  function visible(el) {
    if (!el || !document.contains(el)) return false;
    try {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      if (style.display === 'contents') return true;
      return el.getClientRects().length > 0 || Boolean(el.offsetWidth || el.offsetHeight);
    } catch (_) {
      return false;
    }
  }

  function disabledControl(el) {
    return Boolean(
      el &&
      (
        el.disabled ||
        el.getAttribute('disabled') !== null ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.getAttribute('data-disabled') === 'true'
      )
    );
  }

  function mainRoot() {
    return document.querySelector('main') || document.body || document.documentElement;
  }

  function promptBox() {
    try {
      return document.querySelector(SELECTORS.PROMPT);
    } catch (_) {
      return null;
    }
  }

  function composerRoot() {
    const box = promptBox();
    if (!box || typeof box.closest !== 'function') return null;
    return (
      box.closest('form') ||
      box.closest('[data-testid*="composer"]') ||
      box.closest('[class*="composer"]') ||
      box.closest('footer') ||
      box.parentElement
    );
  }

  // This checks only whether a draft exists. It does not store, log, or transmit prompt text.
  function promptHasContent() {
    const box = promptBox();
    if (!box) return false;
    try {
      if ('value' in box) return normalizeText(box.value).length > 0;
      return normalizeText(box.textContent).length > 0;
    } catch (_) {
      return false;
    }
  }

  function isOwnToastNode(node) {
    const el = closestElement(node);
    return Boolean(el && typeof el.closest === 'function' && el.closest('#__rrn_toast__'));
  }

  function isComposerNode(node) {
    const el = closestElement(node);
    if (!el || typeof el.closest !== 'function') return false;
    const root = composerRoot();
    if (root && root.contains(el)) return true;
    return Boolean(
      el.closest('#prompt-textarea') ||
      el.closest('[data-testid*="prompt-textarea"]') ||
      el.closest('[data-testid*="composer"]') ||
      el.closest('[class*="composer"]')
    );
  }

  function isEditableTarget(target) {
    const el = closestElement(target);
    if (!el || typeof el.closest !== 'function') return false;
    return Boolean(
      el.closest('textarea') ||
      el.closest('input') ||
      el.closest('[contenteditable="true"]') ||
      el.closest('[contenteditable="plaintext-only"]') ||
      el.closest('[role="textbox"]')
    );
  }

  function formHasComposerInput(form) {
    if (!form || typeof form.querySelector !== 'function') return false;
    try {
      return Boolean(form.querySelector(SELECTORS.PROMPT));
    } catch (_) {
      return false;
    }
  }

  function isPromptSubmitTarget(target) {
    const el = closestElement(target);
    if (!el || typeof el.closest !== 'function') return false;
    if (!isEditableTarget(el)) return false;
    const form = el.closest('form');
    if (form && formHasComposerInput(form)) return true;
    return Boolean(el.closest('#prompt-textarea') || el.closest('[data-testid*="prompt-textarea"]'));
  }

  function nearComposerControl(el) {
    if (!el || typeof el.closest !== 'function') return false;
    const root = composerRoot();
    if (root && root.contains(el)) return true;
    return Boolean(
      el.closest('form') ||
      el.closest('footer') ||
      el.closest('[data-testid*="composer"]') ||
      el.closest('[class*="composer"]')
    );
  }

  function closestControl(target) {
    const el = closestElement(target);
    if (!el || typeof el.closest !== 'function') return null;
    return el.closest('button, [role="button"]');
  }

  function controlDescriptor(el) {
    const label = normalizeText(el.getAttribute('aria-label') || el.getAttribute('title') || '');
    const testId = normalizeText(el.getAttribute('data-testid') || '');
    const role = normalizeText(el.getAttribute('role') || '');
    const type = normalizeText(el.getAttribute('type') || '');
    const text = normalizeText(el.textContent || '').slice(0, 100);
    const combined = `${label} ${testId} ${text} ${role} ${type}`;
    return { label, testId, role, type, text, lower: lowerText(combined) };
  }

  function classifyControl(el) {
    if (!el || !visible(el)) return '';

    const d = controlDescriptor(el);
    const s = d.lower;
    const inComposer = nearComposerControl(el);

    const stopMatch = Boolean(
      /(^|[-_\s])stop([-_\s]|$)/.test(s) ||
      /stop\s*(generating|generation|response|responding|streaming|thinking|reasoning|research|researching|browsing|working|work|task)/.test(s) ||
      /cancel\s*(response|generation|task|work)/.test(s) ||
      /pause\s*(task|work|generation)/.test(s) ||
      /停止|取消生成|停止生成|停止回答|停止响应|停止输出|停止思考|停止推理|停止研究|停止任务|暂停任务/.test(s)
    );
    if (stopMatch) return 'stop';

    const continueMatch = Boolean(
      /continue\s*(generating|generation|response|conversation|task|work)?/.test(s) ||
      /resume\s*(generating|generation|response|task|work)?/.test(s) ||
      /regenerate|retry|try again|rerun/.test(s) ||
      /继续|继续生成|继续回答|恢复任务|重新生成|重试|再试一次/.test(s)
    );
    if (continueMatch) return 'continue';

    const sendSemantic = Boolean(
      /send-button|composer-submit|prompt-submit|submit-button/.test(s) ||
      /(^|[-_\s])send([-_\s]|$)/.test(s) ||
      /send\s+(message|prompt)/.test(s) ||
      /submit\s*(message|prompt)?/.test(s) ||
      /发送|提交/.test(s)
    );
    if (sendSemantic && (inComposer || /send-button|prompt-submit|composer-submit/.test(s))) return 'send';

    const form = el.closest?.('form');
    if (d.type.toLowerCase() === 'submit' && form && formHasComposerInput(form)) return 'send';

    if (!inComposer) {
      const waitMatch = Boolean(
        /approve|approval|allow|authorize|confirm|grant access|proceed|review and continue|take over|provide input|answer question/.test(s) ||
        /批准|允许|授权|确认|继续操作|需要你的操作|需要输入|等待你的输入|回答问题/.test(s)
      );
      if (waitMatch) return 'wait';

      const finalMatch = Boolean(
        /copy|read aloud|listen|good response|bad response|like|dislike|thumb|share response|download/.test(s) ||
        /复制|朗读|播放|赞|踩|分享回答|下载/.test(s)
      );
      if (finalMatch) return 'final';
    }

    return '';
  }

  function scanControls(force = false) {
    const now = nowMs();
    if (!force && state.cachedControls && now - state.lastControlScanAt < CONFIG.CONTROL_SCAN_MIN_INTERVAL_MS) {
      return state.cachedControls;
    }

    const controls = {
      stop: false,
      send: false,
      sendReady: false,
      sendDisabled: false,
      continueLike: false,
      waitAction: false,
      finalActionCount: 0,
      finalActionKinds: [],
      details: []
    };

    const roots = [];
    const addRoot = root => {
      if (root && !roots.includes(root)) roots.push(root);
    };
    addRoot(composerRoot());
    addRoot(state.activeAssistantRoot);
    if (!state.activeAssistantRoot && state.stage !== 'idle') addRoot(mainRoot());

    const seen = new Set();
    for (const root of roots) {
      for (const el of safeQueryAll(root, SELECTORS.CONTROL)) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (!visible(el)) continue;

        const kind = classifyControl(el);
        if (!kind) continue;
        const disabled = disabledControl(el);
        const d = controlDescriptor(el);

        controls.details.push({
          kind,
          disabled,
          tag: el.tagName,
          testId: d.testId,
          label: d.label,
          text: d.text
        });

        if (kind === 'stop' && !disabled) controls.stop = true;
        if (kind === 'continue' && !disabled) controls.continueLike = true;
        if (kind === 'wait' && !disabled) controls.waitAction = true;
        if (kind === 'final' && !disabled) {
          controls.finalActionCount += 1;
          const key = d.testId || d.label || d.text || 'final';
          if (!controls.finalActionKinds.includes(key)) controls.finalActionKinds.push(key);
        }
        if (kind === 'send') {
          controls.send = true;
          if (disabled) controls.sendDisabled = true;
          else controls.sendReady = true;
        }
      }
    }

    state.cachedControls = controls;
    state.lastControlScanAt = now;
    return controls;
  }

  function hasComposerOrInput(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    try {
      return Boolean(node.querySelector([
        'textarea',
        'input',
        'select',
        '[contenteditable="true"]',
        '[contenteditable="plaintext-only"]',
        '[role="textbox"]',
        '#prompt-textarea',
        '[data-testid*="composer"]'
      ].join(',')));
    } catch (_) {
      return false;
    }
  }

  function hasAnswerContentShell(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    try {
      if (node.matches?.(SELECTORS.ANSWER_SHELL)) return true;
      return Boolean(node.querySelector(SELECTORS.ANSWER_SHELL));
    } catch (_) {
      return false;
    }
  }

  function looksLikeAssistantContainer(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE || !visible(node)) return false;
    if (hasComposerOrInput(node)) return false;

    try {
      const explicitAssistant = node.matches(SELECTORS.ASSISTANT_MARKER) || node.querySelector(SELECTORS.ASSISTANT_MARKER);
      if (explicitAssistant) return true;
      const explicitUser = node.matches('[data-message-author-role="user"]') || node.querySelector('[data-message-author-role="user"]');
      if (explicitUser) return false;
    } catch (_) {}

    return hasAnswerContentShell(node);
  }

  function canonicalMessageRoot(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return node;
    try {
      return (
        node.closest('article[data-testid^="conversation-turn-"]') ||
        node.closest('section[data-testid^="conversation-turn-"]') ||
        node.closest('[data-message-id]') ||
        node.closest('[data-testid^="conversation-turn-"]') ||
        node.closest('article') ||
        node.closest('section[class*="text-token-text-primary"]') ||
        node
      );
    } catch (_) {
      return node;
    }
  }

  function sortDom(nodes) {
    return nodes.sort((a, b) => {
      if (a === b) return 0;
      const pos = a.compareDocumentPosition(b);
      return pos & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
    });
  }

  function assistantNodes(force = false) {
    const now = nowMs();
    if (!force && state.stage !== 'idle' && now - state.lastAssistantScanAt < CONFIG.ASSISTANT_SCAN_MIN_INTERVAL_MS) {
      return null;
    }

    const root = mainRoot();
    const seen = new Set();
    const out = [];
    const push = node => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
      const messageRoot = canonicalMessageRoot(node);
      if (!messageRoot || seen.has(messageRoot) || !visible(messageRoot)) return;
      seen.add(messageRoot);
      out.push(messageRoot);
    };

    safeQueryAll(root, SELECTORS.ASSISTANT_MARKER).forEach(push);

    if (out.length === 0) {
      const fallbackSelectors = [
        'article[data-testid^="conversation-turn-"]',
        'section[data-testid^="conversation-turn-"]',
        '[data-testid^="conversation-turn-"]',
        'article[data-message-id]',
        'section[data-message-id]',
        '[data-message-id]',
        'section[class*="text-token-text-primary"]',
        'section:has([data-writing-block])',
        'main article'
      ];
      for (const selector of fallbackSelectors) {
        safeQueryAll(root, selector).forEach(node => {
          if (looksLikeAssistantContainer(node)) push(node);
        });
      }
    }

    const sorted = sortDom(out);
    state.lastAssistantScanAt = now;
    state.currentAssistantCount = sorted.length;
    return sorted;
  }

  function refreshAssistantState(force = false) {
    const nodes = assistantNodes(force);
    if (nodes === null) return;

    const latest = nodes[nodes.length - 1] || null;
    state.currentAssistantCount = nodes.length;
    if (!latest) return;

    const isNew = Boolean(
      state.trackCurrent ||
      !state.baselineAssistantRoots ||
      !state.baselineAssistantRoots.has(latest)
    );

    if (isNew || !state.activeAssistantRoot?.isConnected) {
      const changed = latest !== state.activeAssistantRoot;
      state.activeAssistantRoot = latest;
      state.activeRootIsNew = isNew;
      state.sawAssistantCandidate = true;
      if (!state.firstResponseAt) state.firstResponseAt = nowMs();
      if (changed) {
        state.lastControlScanAt = 0;
        state.lastStreamScanAt = 0;
        startActiveObserver();
      }
      if (state.stage === 'pending') confirmGeneration(isNew ? 'assistant-root-added' : 'assistant-root-reconnected');
    }
  }

  function scanStreamSnapshot(force = false) {
    const now = nowMs();
    if (!force && state.cachedStreamSnapshot && now - state.lastStreamScanAt < CONFIG.STREAM_SCAN_MIN_INTERVAL_MS) {
      return state.cachedStreamSnapshot;
    }

    const roots = [];
    const addRoot = root => {
      if (root && !roots.includes(root)) roots.push(root);
    };
    addRoot(state.activeAssistantRoot);
    if (!state.activeAssistantRoot && state.stage !== 'idle') addRoot(mainRoot());

    let streaming = false;
    let toolLike = false;

    for (const root of roots) {
      if (!streaming) {
        for (const node of safeQueryAll(root, SELECTORS.STREAMING)) {
          if (visible(node) && !isComposerNode(node)) {
            streaming = true;
            break;
          }
        }
      }
      if (!toolLike) {
        for (const node of safeQueryAll(root, SELECTORS.TOOL_LIKE)) {
          if (visible(node)) {
            toolLike = true;
            break;
          }
        }
      }
      if (streaming && toolLike) break;
    }

    const snapshot = { streaming, toolLike };
    state.cachedStreamSnapshot = snapshot;
    state.lastStreamScanAt = now;
    return snapshot;
  }

  function isLikelyGeneratedImage(img) {
    if (!img) return false;
    const src = img.currentSrc || img.src || img.getAttribute?.('src') || '';
    if (!src) return false;
    return /oaiusercontent\.com|files\.oaiusercontent|cdn\.openai\.com|\/backend-api\/files\/|^blob:|^data:image\//i.test(src);
  }

  function trackImage(img) {
    if (!img || !isLikelyGeneratedImage(img)) return;
    if (!state.trackedImages) state.trackedImages = new WeakSet();
    if (state.trackedImages.has(img)) return;
    state.trackedImages.add(img);

    if (img.complete && img.naturalWidth > 0) return;

    state.pendingImageCount += 1;
    if (!state.imageWaitStartedAt) state.imageWaitStartedAt = nowMs();

    const done = () => {
      if (state.pendingImageCount > 0) state.pendingImageCount -= 1;
      markContentActivity('image-finished', nowMs());
      scheduleEvaluate(100);
    };

    img.addEventListener('load', done, { once: true, passive: true });
    img.addEventListener('error', done, { once: true, passive: true });
  }

  function trackImagesFromNode(node) {
    const el = closestElement(node);
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (el.tagName === 'IMG') {
      trackImage(el);
      return;
    }
    safeQueryAll(el, 'img').forEach(trackImage);
  }

  function nodeIsDecoration(node) {
    const el = closestElement(node);
    if (!el) return true;
    try {
      return Boolean(el.matches?.(SELECTORS.DECORATION) || el.closest?.(SELECTORS.DECORATION));
    } catch (_) {
      return false;
    }
  }

  function mutationHasSubstantiveContent(mutation) {
    const target = closestElement(mutation.target);
    if (!target || isOwnToastNode(target) || isComposerNode(target)) return false;

    if (mutation.type === 'characterData') return !nodeIsDecoration(target);

    if (mutation.type === 'attributes') {
      if (mutation.attributeName === 'src' && target.tagName === 'IMG') {
        trackImage(target);
        return true;
      }
      return false;
    }

    const nodes = [
      ...Array.from(mutation.addedNodes || []),
      ...Array.from(mutation.removedNodes || [])
    ];
    if (nodes.length === 0) return false;

    let substantive = false;
    for (const node of nodes) {
      const el = closestElement(node);
      if (!el || isOwnToastNode(el) || isComposerNode(el)) continue;
      trackImagesFromNode(el);
      if (!nodeIsDecoration(el)) substantive = true;
    }
    return substantive;
  }

  function markContentActivity(reason, when = nowMs()) {
    if (!state.lastContentActivityAt || when - state.lastContentActivityAt >= CONFIG.CONTENT_ACTIVITY_THROTTLE_MS) {
      state.lastContentActivityAt = when;
      state.contentMutationBatches += 1;
    }
    state.sawAssistantCandidate = true;
    if (!state.firstResponseAt) state.firstResponseAt = when;
    log('content activity:', reason);
  }

  function disconnectObserver() {
    if (state.observer) {
      try { state.observer.disconnect(); } catch (_) {}
      state.observer = null;
    }
    state.observerRoot = null;
    state.observerMode = 'none';
  }

  function desiredObserverTarget() {
    if (state.stage === 'idle') return { root: null, mode: 'none' };
    if (state.stage === 'active' && state.activeAssistantRoot?.isConnected) {
      return { root: state.activeAssistantRoot, mode: 'response' };
    }
    return { root: mainRoot(), mode: 'discovery' };
  }

  function startActiveObserver() {
    const desired = desiredObserverTarget();
    if (!desired.root || typeof MutationObserver !== 'function') {
      disconnectObserver();
      return;
    }
    if (state.observer && state.observerRoot === desired.root && state.observerMode === desired.mode) return;

    disconnectObserver();

    try {
      state.observer = new MutationObserver(handleMutations);
      if (desired.mode === 'response') {
        state.observer.observe(desired.root, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['src', 'data-streaming', 'data-is-streaming', 'data-state', 'aria-busy']
        });
      } else {
        // Discovery mode intentionally avoids characterData and broad attribute observation.
        state.observer.observe(desired.root, {
          subtree: true,
          childList: true
        });
      }
      state.observerRoot = desired.root;
      state.observerMode = desired.mode;
    } catch (err) {
      log('observer failed:', err);
    }
  }

  function handleMutations(mutations) {
    if (!state.enabled || state.stage === 'idle') return;

    state.rawMutationBatches += 1;
    let substantive = false;
    let discovered = false;

    for (const mutation of mutations) {
      if (state.observerMode === 'discovery') {
        discovered = true;
        for (const node of Array.from(mutation.addedNodes || [])) trackImagesFromNode(node);
      } else if (mutationHasSubstantiveContent(mutation)) {
        substantive = true;
      }
    }

    if (substantive) markContentActivity('response-mutation');
    else state.ignoredMutationBatches += 1;

    if (discovered) state.lastAssistantScanAt = 0;
    state.lastControlScanAt = 0;
    state.lastStreamScanAt = 0;
    scheduleEvaluate(CONFIG.MUTATION_EVALUATE_DELAY_MS);
  }

  function clearTimer(name) {
    if (state[name]) {
      clearTimeout(state[name]);
      state[name] = null;
    }
    if (name === 'evalTimer') state.evalDueAt = 0;
  }

  // Earliest deadline wins. Continuous DOM updates cannot postpone evaluation forever.
  function scheduleEvaluate(delay = 0) {
    if (!state.enabled || state.stage === 'idle') return;
    const dueAt = nowMs() + Math.max(0, delay);
    if (state.evalTimer && state.evalDueAt > 0 && state.evalDueAt <= dueAt) return;
    clearTimer('evalTimer');
    state.evalDueAt = dueAt;
    state.evalTimer = setTimeout(() => {
      state.evalTimer = null;
      state.evalDueAt = 0;
      void evaluate();
    }, Math.max(0, dueAt - nowMs()));
  }

  function nextPollDelay() {
    const hidden = document.visibilityState === 'hidden';
    const age = state.armAt ? nowMs() - state.armAt : 0;
    if (state.stage === 'pending') {
      return hidden ? CONFIG.PENDING_POLL_HIDDEN_MS : CONFIG.PENDING_POLL_VISIBLE_MS;
    }
    if (age >= CONFIG.LONG_TASK_AFTER_MS) {
      return hidden ? CONFIG.LONG_TASK_POLL_HIDDEN_MS : CONFIG.LONG_TASK_POLL_VISIBLE_MS;
    }
    return hidden ? CONFIG.ACTIVE_POLL_HIDDEN_MS : CONFIG.ACTIVE_POLL_VISIBLE_MS;
  }

  function startPollLoop() {
    clearTimer('pollTimer');
    if (!state.enabled || state.stage === 'idle') return;
    state.pollTimer = setTimeout(async () => {
      state.pollTimer = null;
      await evaluate();
      startPollLoop();
    }, nextPollDelay());
  }

  function resetRound(options = {}) {
    const keepNotify = Boolean(options.keepNotify);

    clearTimer('pollTimer');
    clearTimer('evalTimer');
    disconnectObserver();

    state.stage = 'idle';
    state.armAt = 0;
    state.armReason = '';
    state.confirmedAt = 0;
    state.confirmReason = '';
    state.manualRound = false;
    state.trackCurrent = false;
    state.promptHadContentAtArm = false;

    state.baselineAssistantRoots = null;
    state.baselineAssistantCount = 0;
    state.baselineLatestAssistantRoot = null;
    state.currentAssistantCount = 0;
    state.activeAssistantRoot = null;
    state.activeRootIsNew = false;
    state.lastAssistantScanAt = 0;

    state.sawAssistantCandidate = false;
    state.firstResponseAt = 0;
    state.lastContentActivityAt = 0;
    state.contentMutationBatches = 0;
    state.rawMutationBatches = 0;
    state.ignoredMutationBatches = 0;

    state.sawStop = false;
    state.stopFirstSeenAt = 0;
    state.lastStopSeenAt = 0;
    state.stopGoneAt = 0;
    state.stopSampleCount = 0;

    state.sawStreaming = false;
    state.streamFirstSeenAt = 0;
    state.lastStreamSeenAt = 0;
    state.streamGoneAt = 0;
    state.streamSampleCount = 0;

    state.sawBusy = false;
    state.busyFirstSeenAt = 0;
    state.lastBusySeenAt = 0;
    state.busyGoneAt = 0;
    state.busySampleCount = 0;
    state.sawToolLike = false;

    state.finalActionSeenAt = 0;
    state.finalActionKinds = [];
    state.waitActionSeenAt = 0;

    state.pendingImageCount = 0;
    state.imageWaitStartedAt = 0;
    state.trackedImages = null;

    state.lastControlScanAt = 0;
    state.cachedControls = null;
    state.lastStreamScanAt = 0;
    state.cachedStreamSnapshot = null;

    state.evaluating = false;
    state.evaluateAgain = false;
    state.notifying = false;
    state.lastDecision = null;

    if (!keepNotify) state.lastNotifyAt = 0;
  }

  function startRound(reason, options = {}) {
    if (!state.enabled) {
      showToast('RRN 当前已关闭');
      console.log('[RRN] 当前已关闭。按 Ctrl+Alt+N 可重新开启。');
      return false;
    }

    const now = nowMs();
    const force = Boolean(options.force);
    const manualGenerating = Boolean(options.manualGenerating);
    const trackCurrent = Boolean(options.trackCurrent);

    if (!force && state.stage !== 'idle') return false;
    if (!force && now - state.lastIntentAt < CONFIG.INTENT_DEBOUNCE_MS) return false;

    const lastNotifyAt = state.lastNotifyAt;
    resetRound({ keepNotify: true });
    state.lastNotifyAt = lastNotifyAt;

    state.stage = manualGenerating || trackCurrent ? 'active' : 'pending';
    state.roundId += 1;
    state.armAt = now;
    state.armReason = reason || 'user-intent';
    state.lastIntentAt = now;
    state.manualRound = manualGenerating;
    state.trackCurrent = trackCurrent;
    state.promptHadContentAtArm = promptHasContent();

    const nodes = assistantNodes(true) || [];
    state.baselineAssistantRoots = new WeakSet(nodes);
    state.baselineAssistantCount = nodes.length;
    state.baselineLatestAssistantRoot = nodes[nodes.length - 1] || null;

    if (manualGenerating || trackCurrent) {
      state.confirmedAt = now;
      state.confirmReason = manualGenerating ? 'manual-hotkey' : 'continue-action';
      state.activeAssistantRoot = state.baselineLatestAssistantRoot;
      state.activeRootIsNew = false;
      state.sawAssistantCandidate = true;
      state.firstResponseAt = now;
      state.lastContentActivityAt = now;
    }

    void unlockAudio();
    startActiveObserver();
    startPollLoop();
    scheduleEvaluate(0);

    console.log(`[RRN] 已开始监听 v${VERSION} (${BUILD})。reason=${state.armReason}`);
    return true;
  }

  function confirmGeneration(reason) {
    if (state.stage === 'active') return;
    const now = nowMs();
    state.stage = 'active';
    state.confirmedAt = now;
    state.confirmReason = reason || 'unknown';
    state.sawAssistantCandidate = true;
    if (!state.firstResponseAt) state.firstResponseAt = now;
    refreshAssistantState(true);
    startActiveObserver();
    startPollLoop();
    log('confirmed:', reason);
  }

  function updateUrlState(now) {
    if (location.href === state.currentUrl) return true;
    const oldUrl = state.currentUrl;
    state.currentUrl = location.href;

    if (state.stage === 'idle') return true;

    if (
      now - state.armAt <= CONFIG.KEEP_ON_URL_CHANGE_MS ||
      state.sawBusy ||
      state.activeAssistantRoot?.isConnected
    ) {
      state.lastAssistantScanAt = 0;
      startActiveObserver();
      scheduleEvaluate(0);
      log('URL changed, keep round:', {
        oldUrl: redactUrlForDebug(oldUrl),
        newUrl: redactUrlForDebug(state.currentUrl)
      });
      return true;
    }

    resetRound({ keepNotify: true });
    console.log('[RRN] 页面切换且无活跃生成，已取消本轮监听。');
    return false;
  }

  function effectiveStreamingNow(now, rawStreaming, controls) {
    if (!rawStreaming) return false;
    if (controls.stop) return true;
    if (controls.finalActionCount > 0 || controls.waitAction) return false;

    // A Stop control that disappeared is more authoritative than a stale aria-busy attribute.
    if (state.sawStop && state.stopGoneAt && now - state.stopGoneAt >= CONFIG.STOP_GONE_GRACE_MS) {
      return false;
    }

    const anchor = state.lastContentActivityAt || state.lastStreamSeenAt || state.confirmedAt || state.armAt || now;
    if (state.sawAssistantCandidate && now - anchor >= CONFIG.STREAM_STALE_IGNORE_MS) {
      return false;
    }
    return true;
  }

  function updateBusyState(now, controls, rawStreaming) {
    if (controls.stop) {
      if (!state.sawStop) state.stopFirstSeenAt = now;
      state.sawStop = true;
      state.lastStopSeenAt = now;
      state.stopGoneAt = 0;
      state.stopSampleCount += 1;
    } else if (state.sawStop && state.lastStopSeenAt > 0 && state.stopGoneAt === 0) {
      state.stopGoneAt = now;
    }

    if (rawStreaming) {
      if (!state.sawStreaming) state.streamFirstSeenAt = now;
      state.sawStreaming = true;
      state.lastStreamSeenAt = now;
      state.streamGoneAt = 0;
      state.streamSampleCount += 1;
    } else if (state.sawStreaming && state.lastStreamSeenAt > 0 && state.streamGoneAt === 0) {
      state.streamGoneAt = now;
    }

    const streamingNow = effectiveStreamingNow(now, rawStreaming, controls);
    const busyNow = Boolean(controls.stop || streamingNow);

    if (busyNow) {
      if (!state.sawBusy) state.busyFirstSeenAt = now;
      state.sawBusy = true;
      state.lastBusySeenAt = now;
      state.busyGoneAt = 0;
      state.busySampleCount += 1;
      if (state.stage === 'pending') confirmGeneration('busy-signal');
    } else if (state.sawBusy && state.lastBusySeenAt > 0 && state.busyGoneAt === 0) {
      state.busyGoneAt = now;
    }

    return { busyNow, streamingNow };
  }

  function imageGate(now) {
    if (state.pendingImageCount <= 0) return { blocking: false, pending: 0, waitFor: 0 };
    if (!state.imageWaitStartedAt) state.imageWaitStartedAt = now;
    const waitFor = now - state.imageWaitStartedAt;
    return {
      blocking: waitFor < CONFIG.IMAGE_WAIT_LIMIT_MS,
      pending: state.pendingImageCount,
      waitFor
    };
  }

  function buildDecision(now, controls, rawStreamSnapshot, busyState) {
    const responseStart = state.firstResponseAt || state.confirmedAt || state.armAt || now;
    const responseAge = now - responseStart;
    const contentQuietFor = now - (state.lastContentActivityAt || responseStart);
    const stopGoneFor = state.sawStop && state.stopGoneAt ? now - state.stopGoneAt : 0;
    const streamGoneFor = state.sawStreaming && state.streamGoneAt ? now - state.streamGoneAt : 0;
    const busyGoneFor = state.sawBusy && state.busyGoneAt ? now - state.busyGoneAt : 0;
    const busyVisibleFor = state.sawBusy && state.busyFirstSeenAt
      ? Math.max(0, state.lastBusySeenAt - state.busyFirstSeenAt)
      : 0;

    const finalTerminal = controls.finalActionCount > 0;
    const waitTerminal = controls.waitAction;

    if (waitTerminal && !busyState.busyNow) {
      if (!state.waitActionSeenAt) state.waitActionSeenAt = now;
    } else {
      state.waitActionSeenAt = 0;
    }

    if (finalTerminal && !busyState.busyNow) {
      if (!state.finalActionSeenAt) state.finalActionSeenAt = now;
      state.finalActionKinds = controls.finalActionKinds.slice();
    } else {
      state.finalActionSeenAt = 0;
      state.finalActionKinds = [];
    }

    const waitStableFor = state.waitActionSeenAt ? now - state.waitActionSeenAt : 0;
    const finalStableFor = state.finalActionSeenAt ? now - state.finalActionSeenAt : 0;
    const promptHasDraft = promptHasContent();
    const toolLikeRound = Boolean(rawStreamSnapshot.toolLike || state.sawToolLike);
    const strongBusyGrace = toolLikeRound ? CONFIG.TOOL_BUSY_GONE_GRACE_MS : CONFIG.BUSY_GONE_GRACE_MS;
    const image = imageGate(now);

    const responseEvidence = Boolean(
      state.sawAssistantCandidate ||
      state.activeAssistantRoot?.isConnected ||
      state.contentMutationBatches > 0 ||
      state.sawBusy ||
      state.manualRound
    );

    const busyReliable = Boolean(
      state.sawBusy &&
      (state.busySampleCount >= 2 || busyVisibleFor >= CONFIG.MIN_BUSY_VISIBLE_MS || state.sawStop)
    );

    let complete = false;
    let path = '';
    let message = 'ChatGPT 回答已完成';
    let blockReason = '';

    if (state.stage !== 'active') {
      blockReason = 'not-active';
    } else if (!responseEvidence) {
      blockReason = 'no-response-evidence';
    } else if (busyState.busyNow) {
      blockReason = controls.stop ? 'stop-visible' : 'streaming-visible';
    } else if (
      waitTerminal &&
      waitStableFor >= CONFIG.WAIT_ACTION_STABLE_MS &&
      responseAge >= CONFIG.MIN_RESPONSE_AGE_TERMINAL_MS
    ) {
      complete = true;
      path = 'waiting-user-action';
      message = 'ChatGPT 正在等待你的操作';
    } else if (image.blocking && !finalTerminal) {
      blockReason = 'waiting-generated-image';
    } else if (
      state.sawStop &&
      stopGoneFor >= CONFIG.STOP_GONE_GRACE_MS &&
      responseAge >= CONFIG.MIN_RESPONSE_AGE_STRONG_MS
    ) {
      // v1.0.3 high-recall behavior, corrected: no DOM-quiet requirement.
      complete = true;
      path = 'stop-gone';
    } else if (
      busyReliable &&
      busyGoneFor >= strongBusyGrace &&
      responseAge >= CONFIG.MIN_RESPONSE_AGE_STRONG_MS
    ) {
      // Primary fallback for current ChatGPT UI. Post-answer hydration cannot block it.
      complete = true;
      path = toolLikeRound ? 'busy-gone-tool' : 'busy-gone';
    } else if (
      state.sawStreaming &&
      streamGoneFor >= CONFIG.STREAM_GONE_GRACE_MS &&
      responseAge >= CONFIG.MIN_RESPONSE_AGE_STRONG_MS
    ) {
      complete = true;
      path = 'streaming-gone';
    } else if (
      finalTerminal &&
      finalStableFor >= CONFIG.FINAL_ACTION_STABLE_MS &&
      responseAge >= CONFIG.MIN_RESPONSE_AGE_TERMINAL_MS
    ) {
      complete = true;
      path = 'final-action-stable';
    } else if (
      state.activeRootIsNew &&
      state.activeAssistantRoot?.isConnected &&
      state.contentMutationBatches >= CONFIG.NO_BUSY_MIN_CONTENT_BATCHES &&
      !toolLikeRound &&
      !promptHasDraft &&
      contentQuietFor >= CONFIG.NO_BUSY_QUIET_MS &&
      responseAge >= CONFIG.NO_BUSY_MIN_RESPONSE_AGE_MS
    ) {
      complete = true;
      path = 'no-busy-quiet-fallback';
    } else if (
      state.activeRootIsNew &&
      state.activeAssistantRoot?.isConnected &&
      state.contentMutationBatches >= 2 &&
      !toolLikeRound &&
      !promptHasDraft &&
      responseAge >= CONFIG.NO_BUSY_HARD_CAP_MS
    ) {
      complete = true;
      path = 'no-busy-hard-cap';
    } else if (state.sawStop && stopGoneFor < CONFIG.STOP_GONE_GRACE_MS) {
      blockReason = 'waiting-stop-gone-grace';
    } else if (busyReliable && busyGoneFor < strongBusyGrace) {
      blockReason = 'waiting-busy-gone-grace';
    } else if (finalTerminal && finalStableFor < CONFIG.FINAL_ACTION_STABLE_MS) {
      blockReason = 'waiting-final-action-stability';
    } else if (!state.sawBusy && promptHasDraft) {
      blockReason = 'draft-suppresses-weak-fallback';
    } else if (!state.activeAssistantRoot?.isConnected && !state.sawBusy) {
      blockReason = 'waiting-assistant-root';
    } else if (!state.sawBusy && contentQuietFor < CONFIG.NO_BUSY_QUIET_MS) {
      blockReason = 'waiting-no-busy-quiet';
    } else {
      blockReason = 'waiting-terminal-signal';
    }

    return {
      complete,
      path,
      message,
      blockReason,
      stage: state.stage,
      responseEvidence,
      responseAge,
      contentQuietFor,
      promptHasDraft,
      activeAssistantConnected: Boolean(state.activeAssistantRoot?.isConnected),
      activeRootIsNew: state.activeRootIsNew,
      sawStop: state.sawStop,
      stopNow: controls.stop,
      stopGoneFor,
      sawStreaming: state.sawStreaming,
      rawStreamingNow: rawStreamSnapshot.streaming,
      effectiveStreamingNow: busyState.streamingNow,
      streamGoneFor,
      sawBusy: state.sawBusy,
      busyNow: busyState.busyNow,
      busyReliable,
      busyVisibleFor,
      busyGoneFor,
      requiredBusyGoneGrace: strongBusyGrace,
      finalTerminal,
      finalStableFor,
      finalActionKinds: state.finalActionKinds.slice(),
      waitTerminal,
      waitStableFor,
      toolLike: rawStreamSnapshot.toolLike,
      toolLikeRound,
      imagesPending: image.pending,
      imagesBlocking: image.blocking,
      contentMutationBatches: state.contentMutationBatches,
      rawMutationBatches: state.rawMutationBatches,
      ignoredMutationBatches: state.ignoredMutationBatches,
      observerMode: state.observerMode,
      confirmReason: state.confirmReason
    };
  }

  async function evaluate() {
    if (!state.enabled || state.stage === 'idle' || state.notifying) return;

    if (state.evaluating) {
      state.evaluateAgain = true;
      return;
    }

    state.evaluating = true;
    try {
      const now = nowMs();
      if (!updateUrlState(now)) return;

      if (state.armAt && now - state.armAt > CONFIG.MAX_ROUND_MS) {
        resetRound({ keepNotify: true });
        console.log('[RRN] 本轮监听达到安全超时上限，已自动取消。');
        return;
      }

      if (state.activeAssistantRoot && !state.activeAssistantRoot.isConnected) {
        state.activeAssistantRoot = null;
        state.activeRootIsNew = false;
        state.lastAssistantScanAt = 0;
      }

      refreshAssistantState(false);
      startActiveObserver();

      const controls = scanControls(false);
      const streamSnapshot = scanStreamSnapshot(false);
      if (streamSnapshot.toolLike) state.sawToolLike = true;
      const busyState = updateBusyState(now, controls, streamSnapshot.streaming);

      if (state.stage === 'pending') {
        const promptCleared = state.promptHadContentAtArm && !promptHasContent();
        const newAssistant = Boolean(state.activeAssistantRoot && state.activeRootIsNew);
        const sendEvidence = Boolean(promptCleared || newAssistant || state.sawBusy);

        if (busyState.busyNow) {
          confirmGeneration('busy-signal');
        } else if (newAssistant) {
          confirmGeneration('assistant-root-added');
        } else if (
          promptCleared &&
          state.rawMutationBatches > 0 &&
          now - state.armAt >= 500
        ) {
          confirmGeneration('prompt-cleared-and-dom-active');
        }

        if (state.stage === 'pending' && now - state.armAt >= CONFIG.PENDING_TIMEOUT_MS) {
          resetRound({ keepNotify: true });
          console.log('[RRN] 未确认 ChatGPT 开始回复，本轮监听已取消。');
          return;
        }

        if (state.stage === 'pending') {
          state.lastDecision = {
            complete: false,
            path: '',
            blockReason: 'waiting-generation-confirmation',
            stage: state.stage,
            sendEvidence,
            promptCleared,
            newAssistant,
            busyNow: busyState.busyNow,
            rawMutationBatches: state.rawMutationBatches
          };
          return;
        }
      }

      const decision = buildDecision(now, controls, streamSnapshot, busyState);
      state.lastDecision = decision;

      if (!decision.complete) {
        log('not complete:', decision);
        return;
      }

      state.notifying = true;
      console.log(`[RRN] 检测到本轮状态完成，path=${decision.path}，准备提醒。`);
      await notifyCompletion(decision.message, decision.path);
      resetRound({ keepNotify: true });
    } finally {
      state.evaluating = false;
      if (state.evaluateAgain && state.stage !== 'idle') {
        state.evaluateAgain = false;
        scheduleEvaluate(0);
      }
    }
  }

  function armFromUserIntent(reason, options = {}) {
    startRound(reason, options);
  }

  function registerIntentEvents() {
    const pointerHandler = event => {
      const control = closestControl(event.target);
      const kind = classifyControl(control);
      if (!kind) return;

      if (kind === 'send') {
        armFromUserIntent(`send-${event.type}`, { trackCurrent: false });
      } else if (kind === 'continue') {
        armFromUserIntent(`continue-${event.type}`, { trackCurrent: true });
      }
    };

    window.addEventListener('pointerdown', pointerHandler, { capture: true, passive: true });
    window.addEventListener('click', pointerHandler, true);

    window.addEventListener('keydown', event => {
      if (!state.enabled || event.isComposing) return;
      if (event.key !== 'Enter') return;
      if (event.shiftKey || event.altKey) return;
      if (!isPromptSubmitTarget(event.target)) return;
      armFromUserIntent(event.ctrlKey || event.metaKey ? 'composer-mod-enter' : 'composer-enter');
    }, true);

    document.addEventListener('submit', event => {
      const form = event.target && typeof event.target.closest === 'function'
        ? event.target.closest('form')
        : event.target;
      if (formHasComposerInput(form)) armFromUserIntent('form-submit');
    }, true);
  }

  function hasTransientUserActivation() {
    try {
      if (!navigator.userActivation) return true;
      return Boolean(navigator.userActivation.isActive);
    } catch (_) {
      return false;
    }
  }

  function getAudioContext(createIfMissing = false) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;

      if (state.audioContext && state.audioContext.state === 'closed') {
        state.audioContext = null;
        state.audioUnlocked = false;
      }

      if (!state.audioContext) {
        if (!createIfMissing || !hasTransientUserActivation()) return null;
        state.audioContext = new AudioCtx();
      }
      return state.audioContext;
    } catch (err) {
      log('AudioContext failed:', err);
      return null;
    }
  }

  async function unlockAudio() {
    if (!hasTransientUserActivation()) return false;
    const ctx = getAudioContext(true);
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state === 'running') {
        state.audioUnlocked = true;
        state.audioWarningPrinted = false;
        return true;
      }
      return false;
    } catch (err) {
      log('unlockAudio failed:', err);
      return false;
    }
  }

  function beep(ctx, freq, start, duration, volume, type) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  async function playSound() {
    if (!CONFIG.ENABLE_SOUND) return;
    const ctx = getAudioContext(false);
    if (!ctx) {
      if (!state.audioWarningPrinted) {
        console.log('[RRN] 音频尚未解锁。请先点击页面一次，或按 Ctrl+Alt+M 测试提醒。');
        state.audioWarningPrinted = true;
      }
      return;
    }

    try {
      if (ctx.state === 'suspended') {
        if (!hasTransientUserActivation()) return;
        await ctx.resume();
      }
      if (ctx.state !== 'running') return;
      const t0 = ctx.currentTime + 0.01;
      beep(ctx, CONFIG.SOUND.FREQ_1, t0, CONFIG.SOUND.DURATION_1, CONFIG.SOUND.VOLUME, CONFIG.SOUND.TYPE);
      beep(ctx, CONFIG.SOUND.FREQ_2, t0 + CONFIG.SOUND.DURATION_1 + CONFIG.SOUND.GAP, CONFIG.SOUND.DURATION_2, CONFIG.SOUND.VOLUME, CONFIG.SOUND.TYPE);
    } catch (err) {
      log('playSound failed:', err);
    }
  }

  function showToast(message) {
    if (!CONFIG.ENABLE_PAGE_TOAST || !document.body) return;
    try {
      let toast = document.getElementById('__rrn_toast__');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = '__rrn_toast__';
        toast.style.cssText = [
          'position:fixed',
          'right:18px',
          'bottom:18px',
          'z-index:2147483647',
          'max-width:360px',
          'padding:12px 14px',
          'border-radius:10px',
          'background:rgba(20,20,20,.92)',
          'color:#fff',
          'font-size:14px',
          'line-height:1.45',
          'box-shadow:0 8px 24px rgba(0,0,0,.25)',
          'pointer-events:none',
          'transition:opacity .2s ease',
          'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
        ].join(';');
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.style.opacity = '1';
      if (state.toastTimer) clearTimeout(state.toastTimer);
      state.toastTimer = setTimeout(() => {
        toast.style.opacity = '0';
      }, 3600);
    } catch (err) {
      log('showToast failed:', err);
    }
  }

  async function notifyCompletion(message, path) {
    const now = nowMs();
    if (now - state.lastNotifyAt < CONFIG.NOTIFY_COOLDOWN_MS) return;
    state.lastNotifyAt = now;
    await playSound();
    showToast(message || 'ChatGPT 回答已完成');
    log('notified:', path);
  }

  async function testReminder() {
    await unlockAudio();
    await playSound();
    showToast(`RRN 测试提醒：${BUILD}`);
  }

  function printStatus() {
    const controls = scanControls(true);
    const streamSnapshot = scanStreamSnapshot(true);
    const nodes = assistantNodes(true) || [];
    const now = nowMs();
    console.log('[RRN] 调试状态：', {
      version: VERSION,
      build: BUILD,
      enabled: state.enabled,
      stage: state.stage,
      roundId: state.roundId,
      currentUrl: redactUrlForDebug(state.currentUrl),
      armReason: state.armReason,
      armAt: state.armAt,
      confirmedAt: state.confirmedAt,
      confirmReason: state.confirmReason,
      baselineAssistantCount: state.baselineAssistantCount,
      currentAssistantCount: nodes.length,
      activeAssistantConnected: Boolean(state.activeAssistantRoot?.isConnected),
      activeRootIsNew: state.activeRootIsNew,
      sawAssistantCandidate: state.sawAssistantCandidate,
      firstResponseAt: state.firstResponseAt,
      lastContentActivityAt: state.lastContentActivityAt,
      contentQuietFor: state.lastContentActivityAt ? now - state.lastContentActivityAt : 0,
      contentMutationBatches: state.contentMutationBatches,
      rawMutationBatches: state.rawMutationBatches,
      ignoredMutationBatches: state.ignoredMutationBatches,
      sawStop: state.sawStop,
      lastStopSeenAt: state.lastStopSeenAt,
      stopGoneAt: state.stopGoneAt,
      stopGoneFor: state.stopGoneAt ? now - state.stopGoneAt : 0,
      sawStreaming: state.sawStreaming,
      lastStreamSeenAt: state.lastStreamSeenAt,
      streamGoneAt: state.streamGoneAt,
      streamGoneFor: state.streamGoneAt ? now - state.streamGoneAt : 0,
      sawBusy: state.sawBusy,
      lastBusySeenAt: state.lastBusySeenAt,
      busyGoneAt: state.busyGoneAt,
      busyGoneFor: state.busyGoneAt ? now - state.busyGoneAt : 0,
      controls,
      streamSnapshot,
      promptHasDraft: promptHasContent(),
      pendingImageCount: state.pendingImageCount,
      observer: {
        active: Boolean(state.observer),
        mode: state.observerMode,
        rootConnected: Boolean(state.observerRoot?.isConnected)
      },
      audioContextState: state.audioContext ? state.audioContext.state : 'not-created',
      audioUnlocked: state.audioUnlocked,
      lastDecision: state.lastDecision
    });
  }

  function hotkeyAction(event) {
    const key = String(event.key || '').toLowerCase();
    const code = String(event.code || '');
    const ctrlAlt = event.ctrlKey && event.altKey && !event.metaKey;
    const ctrlShift = CONFIG.ENABLE_CTRL_SHIFT_HOTKEYS &&
      event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
    if (!ctrlAlt && !ctrlShift) return '';
    if (key === 's' || code === 'KeyS') return 'start';
    if (key === 'm' || code === 'KeyM') return 'test';
    if (key === 'n' || code === 'KeyN') return 'toggle';
    if (key === 'x' || code === 'KeyX') return 'cancel';
    if (key === 'b' || code === 'KeyB') return 'debug';
    return '';
  }

  function registerHotkeys() {
    window.addEventListener('keydown', async event => {
      const action = hotkeyAction(event);
      if (!action) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

      if (action === 'start') {
        await unlockAudio();
        startRound('manual-hotkey', { force: true, manualGenerating: true, trackCurrent: true });
        showToast('RRN 已开始手动监听');
        return;
      }

      if (action === 'test') {
        await testReminder();
        return;
      }

      if (action === 'toggle') {
        state.enabled = !state.enabled;
        if (!state.enabled) resetRound({ keepNotify: true });
        showToast(`RRN 已${state.enabled ? '开启' : '关闭'}`);
        console.log(`[RRN] 已${state.enabled ? '开启' : '关闭'}。`);
        return;
      }

      if (action === 'cancel') {
        resetRound({ keepNotify: true });
        showToast('RRN 已取消当前轮监听');
        return;
      }

      if (action === 'debug') {
        showToast('RRN 调试状态已输出到控制台');
        printStatus();
      }
    }, { capture: true, passive: false });
  }

  function registerAudioUnlockEvents() {
    const unlock = () => { void unlockAudio(); };
    window.addEventListener('pointerdown', unlock, { passive: true, capture: true });
    window.addEventListener('keydown', unlock, { passive: true, capture: true });
  }

  function cleanup() {
    clearTimer('pollTimer');
    clearTimer('evalTimer');
    if (state.toastTimer) clearTimeout(state.toastTimer);
    disconnectObserver();
    if (state.audioContext && state.audioContext.state !== 'closed') {
      try { state.audioContext.close(); } catch (_) {}
    }
    try { window[INSTANCE_KEY] = false; } catch (_) {}
  }

  function init() {
    registerAudioUnlockEvents();
    registerIntentEvents();
    registerHotkeys();
    window.addEventListener('beforeunload', cleanup, { once: true });

    console.log(
      `[RRN] 已加载 v${VERSION} (${BUILD})。` +
      '安全边界：仅本地可见 DOM 状态；声音 + 页面提示；无系统通知；无 GM_*；无存储；无网络拦截；无自动点击或发送；不读取完整回答正文。'
    );
    if (CONFIG.SHOW_LOAD_TOAST) {
      setTimeout(() => showToast(`RRN v${VERSION} 已加载：${BUILD}`), 500);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(init, 250), { once: true });
  }
})();
