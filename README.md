# SUPERME AI 🤖

SUPERME AI — Uzbek-first AI chat + coding assistant + project build platform.

## Current features

- Uzbek-first AI chat powered by the OpenAI Responses API
- Image input support
- Conversation history in the web client
- Coding/project-building assistant instructions
- Build screen for Web or Source ZIP artifacts
- GitHub Actions build dispatch from the backend
- Secrets status screen without exposing secret values
- Telegram bot connection test
- Backend health endpoint

## Architecture

`User → SUPERME AI → Agent → Workspace → Tests → GitHub Actions → Build artifact`

## Required secrets / environment variables

Configure these in the backend environment or GitHub repository Secrets. **Never commit real values.**

- `OPENAI_API_KEY` — OpenAI API key
- `OPENAI_MODEL` — defaults to `gpt-5.6-luna`
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `TELEGRAM_CHAT_ID` — target chat/channel ID for bot messages
- `GITHUB_TOKEN` — token with permission to dispatch the build workflow
- `GITHUB_REPO` — defaults to this repository
- `GITHUB_WORKFLOW` — defaults to `superme-build.yml`
- `GITHUB_REF` — defaults to `main`

The OpenAI API key is kept server-side; it is never sent to the browser. The current OpenAI Platform documentation lists GPT-5.6 Luna as a cost-sensitive workload model. citeturn0search0turn0search1
