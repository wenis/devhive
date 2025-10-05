# DevHive

[![License](https://img.shields.io/github/license/wenis/devhive)](https://github.com/wenis/devhive/blob/main/LICENSE)

**DevHive** is an opinionated CLI tool for AI-driven software development, inspired by [BMAD-METHOD](https://github.com/cagostino/BMAD-METHOD). It orchestrates local LLMs (via llama.cpp or compatible endpoints) for cost-efficient planning, requirements, and architecture, while leveraging cloud APIs (Claude, Gemini, or Grok) for parallel story implementation by a 'team' of agentic developers.

Built as a fork of [Gemini CLI](https://github.com/google-gemini/gemini-cli) with [LangGraph](https://github.com/langchain-ai/langgraph) workflows, DevHive enforces structured agile processes for rapid, scalable project building—from epics to code commits.

## 🎯 Philosophy

**BMAD-Inspired Workflow:**
- **Break down** - Decompose epics into manageable stories using local LLMs
- **Multiply** - Spawn parallel AI agents to work on stories simultaneously
- **Assemble** - Review and integrate completed work
- **Deploy** - Ship features faster with structured collaboration

**Cost-Optimized:**
- Use **cheap local LLMs** (Llama, Qwen, etc.) for planning and architecture
- Use **powerful cloud APIs** (Claude, Gemini, Grok) for actual coding
- Save $$$ by routing tasks to the right model for the job

**Dual-Mode Operation:**
1. **Structured Workflows** - BMAD orchestration for team-scale development
2. **Interactive Mode** - Full Gemini CLI experience for ad-hoc tasks

## 📦 Installation

### System Requirements

- Node.js version 20 or higher
- macOS, Linux, or Windows
- (Optional) Local LLM server for planning mode

### Install from source

```bash
git clone https://github.com/wenis/devhive.git
cd devhive
npm install
npm run build
npm link
```

### Quick Start

```bash
devhive
```

## 🔧 Configuration

### Local LLM Setup (for Planning Mode)

DevHive supports any OpenAI-compatible endpoint for planning tasks:

#### Option 1: llama.cpp Server

```bash
# Start llama.cpp server
./llama-server -m models/llama-3.2-3b.gguf --port 8080

# Configure DevHive
export OPENAI_BASE_URL="http://localhost:8080/v1"
export OPENAI_MODEL="llama-3.2-3b"
```

#### Option 2: Ollama

```bash
# Start Ollama (runs on 11434 by default)
ollama serve

# Pull a model
ollama pull llama3.2

# Configure DevHive
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_MODEL="llama3.2"
```

#### Option 3: LM Studio

1. Start LM Studio
2. Load a model
3. Enable local server (default port 1234)

```bash
export OPENAI_BASE_URL="http://localhost:1234/v1"
export OPENAI_MODEL="lmstudio-community/Meta-Llama-3.2-3B-Instruct-GGUF"
```

### Cloud API Setup (for Coding Mode)

DevHive inherits Gemini CLI's authentication options. Choose one:

#### Option 1: Login with Google (OAuth)

```bash
devhive
# Follow browser authentication flow
```

**Free tier:** 60 requests/min, 1,000 requests/day with Gemini 2.5 Pro

#### Option 2: Gemini API Key

```bash
export GEMINI_API_KEY="YOUR_API_KEY"
devhive
```

Get your key from [Google AI Studio](https://aistudio.google.com/apikey)

#### Option 3: Anthropic Claude

```bash
export ANTHROPIC_API_KEY="YOUR_API_KEY"
# Claude support via future integration
```

#### Option 4: Vertex AI

```bash
export GOOGLE_API_KEY="YOUR_API_KEY"
export GOOGLE_GENAI_USE_VERTEXAI=true
devhive
```

## 🚀 Usage

### Interactive Mode (Gemini CLI)

Full access to all Gemini CLI features for ad-hoc coding:

```bash
devhive
> Help me refactor this authentication module
> /chat What's the best way to implement rate limiting?
> @file src/api.ts Add error handling to this endpoint
```

All [Gemini CLI commands](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/commands.md) are available:
- `/help` - Show available commands
- `/chat` - Start conversation mode
- `/mcp` - Manage MCP servers
- `/settings` - Configure DevHive
- And many more...

### BMAD Workflow Mode ✨ NEW

Structured team-scale development with LangGraph orchestration:

#### Step 1: Planning (Local LLM)

```bash
# Start local LLM server (llama.cpp, Ollama, etc.)
ollama serve  # or: ./llama-server -m llama-3.2-3b.gguf --port 8080

# Set environment
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_MODEL="llama3.2"

# Create epic with BMAD planning workflow
devhive epic create "Build a todo app with React and Node.js"
# This runs: Analyst → PM → Architect → PO (validate/shard)
# Output: docs/project-brief.md, docs/prd.md, docs/architecture.md

# Shard into individual files (optional, for file-based workflows)
devhive epic break
# Output: docs/epics/*, docs/stories/*
```

#### Step 2: Parallel Development (Cloud API)

```bash
# Set cloud API (for powerful coding)
export GEMINI_API_KEY="your-key"

# Start development swarm
devhive swarm start --max-agents 3
# This runs: SM (draft) → Assign → Dev Swarm → QA → Integrate
# Multiple agents work simultaneously on different stories

# Check progress
devhive swarm status
```

**Current Status:** Planning and swarm workflows are fully implemented with LLM integration. File I/O (saving to `docs/`) is next!

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    DevHive CLI                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Interactive Mode          BMAD Workflow Mode      │
│  ┌──────────────┐         ┌──────────────────┐    │
│  │ Gemini CLI   │         │ LangGraph        │    │
│  │ Features     │         │ State Machines   │    │
│  │              │         │                  │    │
│  │ • Chat       │         │ • Epic Planning  │    │
│  │ • Tools      │         │ • Story Decomp   │    │
│  │ • MCP        │         │ • Agent Swarm    │    │
│  │ • Extensions │         │ • Integration    │    │
│  └──────┬───────┘         └────────┬─────────┘    │
│         │                          │               │
│         └──────────┬───────────────┘               │
│                    │                               │
│         ┌──────────▼──────────────┐                │
│         │   LLM Router            │                │
│         │                         │                │
│         │  Planning → Local LLM   │                │
│         │  Coding   → Cloud API   │                │
│         └──────────┬──────────────┘                │
│                    │                               │
├────────────────────┼───────────────────────────────┤
│                    │                               │
│    ┌───────────────▼──────────┐                    │
│    │                          │                    │
│    │   Local LLM Endpoint     │                    │
│    │   (llama.cpp/Ollama)     │                    │
│    │                          │                    │
│    │   • Requirements         │                    │
│    │   • Architecture         │                    │
│    │   • Story Breakdown      │                    │
│    │   • Estimation           │                    │
│    └──────────────────────────┘                    │
│                                                     │
│    ┌──────────────────────────┐                    │
│    │                          │                    │
│    │   Cloud API              │                    │
│    │   (Gemini/Claude/Grok)   │                    │
│    │                          │                    │
│    │   • Code Generation      │                    │
│    │   • Parallel Agents      │                    │
│    │   • Code Review          │                    │
│    │   • Debugging            │                    │
│    └──────────────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/
├── cli/              # Interactive UI and command handling
├── core/             # Shared tools, LLM clients, file ops
├── workflows/        # (Coming) LangGraph BMAD workflows
└── agents/           # (Coming) Agent personas and coordination
```

## 🔌 Extensibility

DevHive inherits Gemini CLI's extension system:

### MCP (Model Context Protocol) Servers

Connect custom tools and data sources:

```bash
devhive mcp add github
devhive mcp add slack
devhive mcp add database
```

```text
> @github List my open pull requests
> @slack Send update to #dev channel
> @database Query user analytics
```

See [MCP Integration Guide](./docs/tools/mcp-server.md)

### Custom Commands

Create reusable slash commands:

```typescript
// ~/.devhive/commands/deploy.ts
export default {
  name: 'deploy',
  description: 'Deploy to staging',
  action: async (context) => {
    // Your deployment logic
  }
}
```

```bash
> /deploy
```

## 📋 Key Features

### From Gemini CLI (Interactive Mode)

- **🔧 Built-in tools**: File operations, shell commands, web fetching, Google Search grounding
- **🔌 MCP support**: Extend with custom integrations
- **💾 Checkpointing**: Save and resume complex sessions
- **📝 Context files**: GEMINI.md for project-specific instructions
- **💻 Terminal-first**: Designed for developers who live in the command line
- **🛡️ Open source**: Apache 2.0 licensed

### DevHive BMAD Extensions (Coming Soon)

- **🎯 Epic management**: Create and decompose large features
- **🤖 Agent swarm**: Parallel AI developers working simultaneously
- **📊 Progress tracking**: Real-time status of multi-agent workflows
- **🔀 Smart routing**: Automatic LLM selection based on task type
- **💰 Cost optimization**: Use cheap local models for planning
- **🔄 State persistence**: Resume multi-day development sessions

## 📚 Documentation

Since DevHive is built on Gemini CLI, most documentation applies:

- [Gemini CLI Quickstart](https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/index.md)
- [Authentication Guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/authentication.md)
- [Commands Reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/commands.md)
- [MCP Server Integration](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md)
- [Custom Extensions](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/index.md)

### DevHive-Specific Docs (Coming)

- BMAD Workflow Guide
- Multi-Agent Orchestration
- LLM Router Configuration
- Cost Optimization Strategies

## 🔐 Environment Variables

### Local LLM (Planning)

```bash
OPENAI_BASE_URL="http://localhost:8080/v1"  # OpenAI-compatible endpoint
OPENAI_MODEL="llama-3.2-3b"                 # Model name
OPENAI_API_KEY="optional"                   # Most local servers don't need this
```

### Cloud API (Coding)

```bash
# Option 1: Gemini
GEMINI_API_KEY="your-key"

# Option 2: Vertex AI
GOOGLE_API_KEY="your-key"
GOOGLE_GENAI_USE_VERTEXAI=true

# Option 3: Anthropic (future)
ANTHROPIC_API_KEY="your-key"
```

### DevHive Configuration

```bash
DEVHIVE_MAX_AGENTS=5        # Max parallel coding agents
DEVHIVE_PLANNING_LLM=local  # local | cloud
DEVHIVE_CODING_LLM=cloud    # local | cloud
```

## 🤝 Contributing

DevHive is a fork intended for experimentation with BMAD methodology. Contributions welcome!

### Quick Wins (Good First Issues)

Easy features to implement:

1. **Cost Tracker** - Parse LLM responses, track tokens, calculate costs
2. **Story Templates** - Add more templates to `packages/workflows/src/templates/`
3. **Agent Personas** - Create specialized agents (Frontend Expert, DevOps, etc.)
4. **CLI Improvements** - Better error messages, colored output, progress bars
5. **File I/O** - Save artifacts to `docs/` (see TODOs in epic/swarm commands)

### How to Contribute

- 🐛 **Report bugs** via [Issues](https://github.com/wenis/devhive/issues)
- 💡 **Suggest features** - Add to GitHub Discussions
- 🔧 **Submit PRs** - Check `/packages/workflows/ARCHITECTURE.md` first
- 📝 **Documentation** - Improve guides, add examples
- 🎨 **Agent Personas** - Contribute new agent definitions
- 🧪 **Share Experiments** - Post your BMAD workflow results

### Development Setup

```bash
git clone https://github.com/wenis/devhive.git
cd devhive
npm install
npm run build

# Run planning workflow example
node packages/workflows/examples/planning.js

# Run swarm workflow example
node packages/workflows/examples/swarm.js
```

See `CONTRIBUTING.md` for coding standards and PR guidelines.

## 🙏 Acknowledgments

**Built on the shoulders of giants:**

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) - The foundation
- [LangGraph](https://github.com/langchain-ai/langgraph) - State machine orchestration
- [BMAD-METHOD](https://github.com/cagostino/BMAD-METHOD) - Multi-agent inspiration
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Local LLM inference

## 📄 License

[Apache License 2.0](LICENSE) - Same as Gemini CLI

## ⚠️ Status

**Alpha/Experimental** - DevHive is in active development. Core infrastructure is complete, workflow implementation in progress.

### ✅ Completed (v0.1.0)

- **Interactive Gemini CLI mode** - Full Gemini CLI feature set available
- **OpenAI-compatible LLM support** - Connect to llama.cpp, Ollama, LM Studio, etc.
- **LLM routing infrastructure** - Automatic routing: planning → local LLM, coding → cloud API
- **LangGraph workflow package** - State machines for BMAD orchestration
- **BMAD agent personas** - 7 agents (Analyst, PM, Architect, PO, SM, Dev, QA) imported from devhive-bmad
- **Parallelization-first SM** - Context-engineered Scrum Master for swarm optimization
- **Planning workflow graph** - Analyst → PM → Architect → PO (validate/shard)
- **Swarm workflow graph** - SM (draft) → Assign → Dev Swarm → QA → Integrate
- **TypeScript state management** - PlanningState, SwarmState with typed channels

### ✅ Also Completed (v0.2.0)

- **Full LLM integration** - All planning and swarm nodes call actual LLMs
- **QA review node** - Automated code quality checks with LLM
- **Integration node** - Dependency-aware story completion and unblocking
- **CLI commands** - `devhive epic create/break`, `devhive swarm start/status`
- **Command registration** - Full integration with Gemini CLI command structure

### 🚧 In Progress (v0.3.0)

- **File I/O for artifacts** - Save PRD, architecture, epics to `docs/` directory
- **State persistence** - LangGraph checkpointing for resumable workflows
- **Error handling & retries** - Robust LLM call handling with backoff

### 📋 Planned (v0.4.0+)

#### Core Features
- **Progress UI** - Ink-based terminal UI for swarm status with live updates
- **Git integration** - Automatic commits with story completion, PR creation
- **Smart agent assignment** - Match agents to stories by expertise/specialization
- **Advanced parallelization** - File conflict detection and automatic resolution

#### Cost & Performance
- **Cost tracking** - Monitor local vs cloud API usage, estimate project costs
- **Metrics dashboard** - Story velocity, agent efficiency, parallel utilization %
- **Performance profiling** - Identify bottlenecks in workflow execution
- **Model routing strategies** - Dynamic routing based on task complexity/cost

#### Project Management
- **Story prioritization** - Business value scoring, risk-based prioritization
- **Brownfield support** - Workflows for existing codebases (from devhive-bmad)
- **Multi-project workspaces** - Manage multiple projects with isolated configs
- **External tool sync** - Jira/Linear/GitHub Projects integration

#### Quality & Testing
- **Actual test execution** - Run tests, not just LLM review
- **Code review automation** - GitHub PR creation with AI-generated descriptions
- **Coverage enforcement** - Minimum coverage requirements per story
- **Security scanning** - Automated security checks in QA phase

#### Customization & Learning
- **Custom agent personas** - User-defined agent behaviors and specializations
- **Template library** - Custom PRD/architecture/story templates
- **Learning feedback loop** - Track success rates, improve prompts over time
- **Configuration profiles** - Preset configs for different project types

#### Documentation & Visualization
- **Auto-documentation** - Generate docs from completed stories
- **Dependency graphs** - Visual epic/story dependency trees
- **Architecture evolution** - Track architecture changes over time
- **Swarm activity dashboard** - Real-time visualization of agent work

#### Developer Experience
- **Voice input** - Voice-to-epic for rapid ideation
- **Multi-language support** - Non-English prompts and documentation
- **Checkpoint snapshots** - Save workflow state for rollback/branching
- **Collaboration mode** - Multiple developers working with swarm
- **VS Code extension** - In-editor swarm status and controls

## 📂 Implementation Details

### Packages

```
packages/
├── cli/              # Gemini CLI (interactive mode)
├── core/             # Shared LLM clients, tools, file ops
│   └── openaiContentGenerator.ts  # ✅ OpenAI-compatible endpoint support
└── workflows/        # ✅ LangGraph BMAD orchestration
    ├── agents/       # BMAD personas + parallelization enhancement
    ├── planning/     # Planning workflow (local LLM)
    ├── swarm/        # Swarm workflow (cloud API)
    └── types/        # State definitions
```

### Key Files

**LLM Integration:**
- `packages/core/src/core/openaiContentGenerator.ts` - OpenAI-compatible client
- `packages/core/src/core/contentGenerator.ts` - AuthType.OPENAI_COMPATIBLE support

**Workflows:**
- `packages/workflows/src/planning/graph.ts` - Planning LangGraph state machine
- `packages/workflows/src/planning/nodes.ts` - Planning agent implementations
- `packages/workflows/src/swarm/graph.ts` - Swarm LangGraph state machine
- `packages/workflows/src/swarm/nodes.ts` - Swarm agent implementations (with parallel dev)

**Parallelization:**
- `packages/workflows/src/agents/parallelization.ts` - SM enhancement for swarm optimization
- `packages/workflows/src/agents/personas.ts` - Persona parser with parallelization mode

**Documentation:**
- `packages/workflows/README.md` - Workflow usage guide
- `packages/workflows/ARCHITECTURE.md` - Detailed architecture and design patterns

---

<p align="center">
  Fork of Gemini CLI • BMAD-Inspired • Built for experimentation
</p>
