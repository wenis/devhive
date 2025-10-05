# DevHive Workflows Architecture

## Overview

DevHive Workflows implements BMAD-inspired multi-agent orchestration using LangGraph state machines. The system is designed for **hybrid LLM routing**: cheap local models for planning, powerful cloud APIs for parallel coding.

## Package Structure

```
packages/workflows/
├── src/
│   ├── agents/
│   │   ├── prompts/              # BMAD agent personas (7 agents)
│   │   ├── personas.ts           # Persona parser & prompt generator
│   │   └── parallelization.ts   # Swarm-optimized SM enhancement
│   ├── planning/
│   │   ├── graph.ts              # Planning workflow graph
│   │   └── nodes.ts              # Planning agent implementations
│   ├── swarm/
│   │   ├── graph.ts              # Swarm workflow graph
│   │   └── nodes.ts              # Parallel dev agent implementations
│   ├── types/
│   │   └── state.ts              # TypeScript state definitions
│   └── index.ts                  # Public API
├── package.json
├── README.md
└── ARCHITECTURE.md               # This file
```

## Two-Phase Workflow System

### Phase 1: Planning (Local LLM)

**Goal:** Cost-efficient epic/story decomposition and architecture

**Workflow Graph:**
```
Analyst → PM → [UX?] → Architect → PO (validate) → PO (shard) → END
           ↑                                  |
           └──────────────────────────────────┘
                    (if validation fails)
```

**LLM Routing:** All nodes use **local LLM** (llama.cpp, Ollama, etc.)

**Agents:**
- **Analyst**: Creates project brief from user idea
- **PM**: Generates PRD with epics, stories, requirements
- **UX Expert** (optional): Creates UI/UX specification
- **Architect**: Designs technical architecture
- **PO**: Validates artifact consistency, shards into individual epic/story files

**Outputs:**
```
docs/
├── project-brief.md
├── prd.md
├── architecture.md
├── epics/
│   ├── epic-001.md
│   ├── epic-002.md
│   └── ...
└── stories/
    ├── epic-001-story-001.md
    ├── epic-001-story-002.md
    └── ...
```

**State Type:** `PlanningState`

### Phase 2: Swarm (Cloud API)

**Goal:** Parallel story implementation by multiple AI agents

**Workflow Graph:**
```
SM (draft) → Assign → Dev Swarm → QA Review → Integrate → [Loop or END]
                        ↑              |
                        └──────────────┘
                        (if tests fail)
```

**LLM Routing:** All nodes use **cloud API** (Gemini, Claude, etc.)

**Agents:**
- **SM**: Drafts detailed story tasks (parallelization-optimized)
- **Dev Agents** (1-N): Implement stories in parallel
- **QA**: Reviews code, runs tests, checks acceptance criteria

**Parallelization Features:**
- Multiple dev agents work simultaneously
- SM designs stories to minimize cross-dependencies
- Automatic dependency detection and blocking
- Wave-based releases (scaffolding → parallel → integration)

**Outputs:**
```
codebase/
├── src/
│   ├── features/
│   │   ├── auth/        # Story EPIC-001-001
│   │   ├── profile/     # Story EPIC-001-002 (parallel)
│   │   └── ...
│   └── ...
└── tests/
    └── ...
```

**State Type:** `SwarmState`

## Parallelization-First Design

### Key Innovation: SM Context Engineering

The Scrum Master agent has been enhanced with specialized parallelization instructions:

**Core Principles:**
1. **Identify Natural Boundaries** - Frontend/backend splits, microservices, vertical slices
2. **Minimize Shared State** - Avoid file conflicts between parallel stories
3. **Interface-First Development** - Define contracts early, work from mocks
4. **Explicit Dependencies** - Mark HARD vs SOFT dependencies

**Story Structuring Pattern:**

```yaml
# Bad (Sequential)
Story 1: Build authentication (4 hours)
Story 2: Add profiles (depends on Story 1, 3 hours)
Story 3: Add notifications (depends on Story 1, 2 hours)
Total time: 9 hours sequential

# Good (Parallel)
Story 1: Auth interfaces + mocks (30 min) [SCAFFOLDING]
Story 2: Auth UI (uses mocks, 2 hours)
Story 3: Auth API (implements interfaces, 2 hours)
Story 4: Profile UI (uses mocks, 2 hours)
Story 5: Notification UI (uses mocks, 1 hour)
Total time: 30 min + 2 hours parallel = 2.5 hours (3.6x speedup!)
```

### Scaffolding Stories

**Purpose:** Unblock multiple parallel stories

**Types:**
1. **Interface Definitions** - API contracts, TypeScript types, database schema
2. **Mocks/Stubs** - Mock servers, stub services, test fixtures
3. **Infrastructure** - Project structure, config, build pipeline

**Example Flow:**
```
Wave 1: Scaffolding
  ├─ Story 1.1: API contract + mock server
  └─ Story 1.2: Database schema

Wave 2: Parallel Implementation (5 agents active)
  ├─ Story 2.1: Feature A UI (uses mocks)
  ├─ Story 2.2: Feature A API (uses schema)
  ├─ Story 2.3: Feature B UI (uses mocks)
  ├─ Story 2.4: Feature B API (uses schema)
  └─ Story 2.5: Feature C service (uses schema)

Wave 3: Integration
  └─ Story 3.1: Connect UI to real APIs, E2E tests
```

### Dependency Management

**Metadata in Story State:**
```typescript
{
  id: "EPIC-001-005",
  dependencies: ["EPIC-001-001", "EPIC-001-002"],  // Must be completed first
  blocks: ["EPIC-002-001", "EPIC-002-003"],        // These are waiting on this
}
```

**Swarm Orchestrator Logic:**
1. Check if story dependencies are in `completedStories`
2. If yes → Add to `activeStories` queue
3. If no → Add to `blockedStories` queue
4. Periodically check blocked stories for unblocking

## LLM Router Integration

### Planning Phase (Local LLM)

```typescript
// Environment configuration
OPENAI_BASE_URL="http://localhost:8080/v1"
OPENAI_MODEL="llama-3.2-3b"

// DevHive routes planning nodes to local endpoint
const planningGenerator = createContentGenerator({
  authType: AuthType.OPENAI_COMPATIBLE,
  openaiBaseURL: process.env.OPENAI_BASE_URL,
  openaiModel: process.env.OPENAI_MODEL,
});

const planningNodes = createPlanningNodes(planningGenerator, abortSignal);
```

### Swarm Phase (Cloud API)

```typescript
// Environment configuration
GEMINI_API_KEY="your-key"

// DevHive routes swarm nodes to cloud API
const swarmGenerator = createContentGenerator({
  authType: AuthType.LOGIN_WITH_GOOGLE,
});

const swarmNodes = createSwarmNodes(swarmGenerator, abortSignal);
```

## State Flow Example

### Planning Workflow

```typescript
// Initial state
const initialState: PlanningState = {
  projectType: 'greenfield',
  includeUX: true,
  currentPhase: 'brief',
  userMessage: 'Build a todo app with React and Node.js',
  epics: [],
  stories: [],
  validationIssues: [],
  needsUserInput: false,
};

// After analyst node
{
  ...state,
  projectBrief: { type: 'project-brief', content: '...', ... },
  currentPhase: 'prd',
}

// After PM node
{
  ...state,
  prd: { type: 'prd', content: '...', ... },
  currentPhase: 'ux',
}

// After PO shard node (final)
{
  ...state,
  epics: [
    { id: 'EPIC-001', title: 'User Management', stories: [...], status: 'planned' },
    { id: 'EPIC-002', title: 'Todo Features', stories: [...], status: 'planned' },
  ],
  stories: [
    { id: 'EPIC-001-001', title: 'User Registration', ..., status: 'draft' },
    { id: 'EPIC-001-002', title: 'User Login', ..., status: 'draft' },
    // ...
  ],
  currentPhase: 'complete',
}
```

### Swarm Workflow

```typescript
// Initial state (from planning output)
const initialState: SwarmState = {
  storyQueue: [...stories],  // From planning phase
  activeStories: [],
  completedStories: [],
  agents: [
    { id: 'dev-1', status: 'idle', ... },
    { id: 'dev-2', status: 'idle', ... },
    { id: 'dev-3', status: 'idle', ... },
  ],
  maxAgents: 3,
  phase: 'assign',
  codeChanges: [],
  testResults: [],
  blockedStories: [],
};

// After SM draft + assign
{
  ...state,
  storyQueue: [...remainingStories],
  activeStories: [
    { id: 'EPIC-001-001', assignedAgent: 'dev-1', status: 'in_progress', ... },
    { id: 'EPIC-001-002', assignedAgent: 'dev-2', status: 'in_progress', ... },
  ],
  agents: [
    { id: 'dev-1', status: 'working', assignedStory: 'EPIC-001-001', progress: 0 },
    { id: 'dev-2', status: 'working', assignedStory: 'EPIC-001-002', progress: 0 },
    { id: 'dev-3', status: 'idle', ... },
  ],
  phase: 'execute',
}

// After parallel dev execution
{
  ...state,
  codeChanges: [
    { storyId: 'EPIC-001-001', agentId: 'dev-1', files: [...], status: 'pending' },
    { storyId: 'EPIC-001-002', agentId: 'dev-2', files: [...], status: 'pending' },
  ],
  agents: [
    { id: 'dev-1', status: 'idle', progress: 100 },
    { id: 'dev-2', status: 'idle', progress: 100 },
    { id: 'dev-3', status: 'idle', ... },
  ],
  phase: 'review',
}
```

## Integration with DevHive CLI

**Commands (Planned):**

```bash
# Planning workflow
devhive epic create "User authentication system"
  → Runs planning graph
  → Outputs: docs/prd.md, docs/architecture.md, docs/epics/, docs/stories/

devhive epic break
  → Runs PO shard node
  → Creates individual story files

# Swarm workflow
devhive swarm start --max-agents 3
  → Initializes SwarmState from stories/
  → Starts parallel execution

devhive swarm status
  → Displays agent status, active stories, progress

devhive swarm pause
devhive swarm resume
```

## Next Steps

**Implementation TODOs:**

1. **Complete Node Implementations**
   - [ ] Actually call LLMs in planning nodes (currently skeletons)
   - [ ] Implement file I/O for artifacts
   - [ ] Add error handling and retries

2. **Swarm Enhancements**
   - [ ] Implement QA review node
   - [ ] Implement integration node
   - [ ] Add parallel execution orchestration
   - [ ] File conflict detection

3. **CLI Integration**
   - [ ] Create `devhive epic` command group
   - [ ] Create `devhive swarm` command group
   - [ ] Add progress UI (Ink components)

4. **State Persistence**
   - [ ] LangGraph checkpointing for resumable workflows
   - [ ] Save artifacts to disk
   - [ ] Track workflow history

5. **Testing**
   - [ ] Unit tests for nodes
   - [ ] Integration tests for workflows
   - [ ] Mock LLM responses for testing

## Architecture Benefits

**Cost Optimization:**
- Planning with local LLM: ~$0 (self-hosted)
- Coding with cloud API: ~$0.50 per story (powerful models)
- Traditional approach: ~$2 per project (all cloud)
- **Savings: 75%**

**Speed Optimization:**
- Sequential: 10 stories × 2 hours = 20 hours
- Parallel (3 agents): 10 stories ÷ 3 × 2 hours = 7 hours
- **Speedup: 2.8x**

**Quality:**
- Structured BMAD methodology enforces best practices
- Explicit validation steps (PO checklist, QA review)
- Architecture-driven development
- Comprehensive test coverage (QA enforced)
