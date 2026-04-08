---
title: Using Claude Code with Alibaba's Coding Plan and Claude Pro (A Practical Guide)
slug: using-claude-code-with-alibaba-s-coding-plan-and-claude-pro-a-practical-guide
date: 2026-04-07
tags: tech
excerpt: Practical guide for using claude code with Alibaba coding plan
---

If you have a Claude Pro subscription and also want to take advantage of a third-party coding plan (like Alibaba's DashScope), you don't have to choose one or the other. With a tool called **Claude Code Router (CCR)**, you can use both — routing different tasks to different models, switching on the fly, and keeping your Pro account available whenever you need it.

This post walks through the exact setup, including every error I hit along the way.

---

## What Is Claude Code Router?

Claude Code Router (CCR) is a local proxy that sits between Claude Code and any LLM provider. When you launch it, it binds to `http://127.0.0.1:3456` and acts as a gateway. Claude Code thinks it's talking to Anthropic — but CCR decides in real time where the request actually goes.

This lets you:
- Route requests to third-party providers (Alibaba, DeepSeek, OpenRouter, etc.)
- Assign different models to different task types automatically
- Switch models on the fly without touching config files

Install it globally:

```bash
npm install -g @musistudio/claude-code-router
```

---

## Setting Up CCR with Alibaba's Coding Plan

Alibaba offers a coding plan through DashScope that provides access to models like Qwen, GLM, Kimi, and MiniMax through an Anthropic-compatible API.

### Step 1: Create the Config File

CCR reads from `~/.claude-code-router/config.json`. Here is a working minimal config:

```json
{
  "LOG": false,
  "Providers": [
    {
      "name": "alibaba",
      "api_base_url": "https://coding-intl.dashscope.aliyuncs.com/apps/anthropic/v1/messages",
      "api_key": "YOUR_ALIBABA_API_KEY",
      "models": [
        "qwen3.5-plus",
        "glm-5",
        "kimi-k2.5",
        "MiniMax-M2.5"
      ],
      "transformer": {"use": ["Anthropic"]}
    }
  ],
  "Router": {
    "default": "alibaba,qwen3.5-plus"
  }
}
```

A few things worth noting here:

**The `api_base_url` must include `/v1/messages`**. This tripped me up — if you only provide the base domain, CCR sends requests to the bare URL with no path, which returns a 404. Your curl tests will work fine because you type the full URL manually, but CCR won't append the path automatically. The fix is to include it in the config.

**The `transformer` field must be `{"use": ["Anthropic"]}`**, not `{"type": "Anthropic"}`. The Alibaba endpoint is Anthropic-compatible, so you want CCR to keep the request in Anthropic's native format rather than converting it to OpenAI format. Getting this wrong causes a 400 `Request body format invalid` error.

**No trailing commas in the JSON**. CCR's config parser is strict — a trailing comma after the last item in an object or array will cause it to silently fail or behave unexpectedly. Always validate your JSON before restarting.

### Step 2: Start CCR and Claude Code

```bash
ccr code
```

This starts the proxy and launches Claude Code together, pre-configured to route through `127.0.0.1:3456`.

To verify it's working, run `echo $ANTHROPIC_BASE_URL` inside Claude Code's terminal — it should show `http://127.0.0.1:3456`.

---

## Smarter Routing: Different Models for Different Tasks

Claude Code internally categorizes requests into different task types — lightweight background tasks, standard coding tasks, complex reasoning, and large context operations. CCR lets you assign a different model to each:

```json
"Router": {
  "default": "alibaba,qwen3.5-plus",
  "background": "alibaba,qwen3.5-plus",
  "think": "alibaba,kimi-k2.5",
  "longContext": "alibaba,MiniMax-M2.5",
  "longContextThreshold": 60000
}
```

With this setup, Claude Code will automatically use Kimi for complex reasoning tasks and MiniMax when the context gets large — without you doing anything manually.

You can also switch the default model on the fly from inside Claude Code:

```
/model alibaba,kimi-k2.5
```

Note: the `/model` command shows only Anthropic's built-in models in its picker UI, but you can type any provider/model name directly and CCR will handle it. This override only affects the `default` route — your `think`, `longContext`, and other routes remain unchanged. It also resets when you restart.

---

## Using Your Claude Pro Account Alongside CCR

CCR works with API keys. Your Claude Pro subscription is OAuth-based — it's a separate product from the Anthropic API and there is no way to extract an API key from it. They have separate billing and separate token pools.

This means you can't route your Pro tokens through CCR. But you can still use both — just in different terminals.

### Option 1: Two Terminals

Open a second terminal **without** CCR active. Check that `ANTHROPIC_BASE_URL` is empty:

```bash
echo $ANTHROPIC_BASE_URL
```

If it returns nothing, you're clear. Run:

```bash
claude
```

Claude Code will use your Pro OAuth login directly, bypassing CCR entirely. Use this terminal when you want your Pro account. Use the CCR terminal when you want Alibaba's models.

### Option 2: Add Anthropic API as a Second Provider in CCR

If you have a paid Anthropic API key (separate from Pro), you can add it as another provider in CCR and switch between Alibaba and Anthropic models within the same session:

```json
{
  "Providers": [
    {
      "name": "alibaba",
      "api_base_url": "https://coding-intl.dashscope.aliyuncs.com/apps/anthropic/v1/messages",
      "api_key": "YOUR_ALIBABA_KEY",
      "models": ["qwen3.5-plus", "glm-5", "kimi-k2.5", "MiniMax-M2.5"],
      "transformer": {"use": ["Anthropic"]}
    },
    {
      "name": "anthropic",
      "api_base_url": "https://api.anthropic.com/v1/messages",
      "api_key": "YOUR_ANTHROPIC_API_KEY",
      "models": ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
      "transformer": {"use": ["Anthropic"]}
    }
  ],
  "Router": {
    "default": "alibaba,qwen3.5-plus",
    "think": "anthropic,claude-opus-4-6"
  }
}
```

Then switch on the fly:

```
/model anthropic,claude-sonnet-4-6
/model alibaba,qwen3.5-plus
```

---

## Summary

| Goal | How |
|------|-----|
| Run CCR with Alibaba | `ccr code` |
| Switch model in session | `/model alibaba,kimi-k2.5` |
| Use Pro account | Open terminal without `ANTHROPIC_BASE_URL` set, run `claude` |
| Check if CCR is active | `echo $ANTHROPIC_BASE_URL` |
| Restart after config change | `ccr restart` |

The main gotchas: include `/v1/messages` in your `api_base_url`, use `{"use": ["Anthropic"]}` for the transformer, and keep your JSON clean with no trailing commas. Once those three are right, the setup is stable and flexible.
