# DevHive Workflows

LangGraph-based workflows for DevHive BMAD orchestration.

## Structure

```
src/
├── agents/
│   ├── prompts/          # BMAD agent persona definitions (copied from devhive-bmad)
│   └── personas.ts       # Agent persona parser and system prompt generator
├── planning/
│   ├── graph.ts          # Planning workflow graph definition
│   └── nodes.ts          # Planning node implementations (Analyst, PM, Architect, PO)
├── swarm/
│   └── graph.ts          # Swarm workflow graph definition (parallel dev agents)
├── templates/            # Document templates for artifacts
├── types/
│   └── state.ts          # TypeScript state definitions for workflows
└── index.ts              # Main exports
```

## Workflows

### Planning Workflow

**Purpose:** Epic creation → Story decomposition → Architecture (using local LLM)

**Flow:**
```
Analyst (create brief)
  → PM (create PRD)
  → UX Expert (create UX spec, optional)
  → Architect (create architecture)
  → PO (validate all artifacts)
  → PO (shard into epics/stories)
```

**Key Features:**
- Uses **local LLM** for cost-efficient planning
- Implements BMAD planning phase from devhive-bmad
- Produces: project-brief.md, prd.md, architecture.md, epics/, stories/

**Usage:**
```typescript
import { createPlanningGraph } from 'devhive-workflows';
import { createContentGenerator, AuthType } from 'devhive-core';

// Create local LLM generator for planning
const localGenerator = await createContentGenerator({
  authType: AuthType.OPENAI_COMPATIBLE,
  openaiBaseURL: 'http://localhost:8080/v1',
  openaiModel: 'llama-3.2-3b',
}, config);

const abortController = new AbortController();

// Create planning graph with LLM integration
const graph = createPlanningGraph(localGenerator, abortController.signal);

// Run planning workflow
const result = await graph.invoke({
  projectType: 'greenfield',
  includeUX: true,
  userMessage: 'Build a todo app with React and Node.js',
  currentPhase: 'brief',
  epics: [],
  stories: [],
  validationIssues: [],
  needsUserInput: false,
});

console.log('Epics:', result.epics);
console.log('Stories:', result.stories);
```

### Swarm Workflow

**Purpose:** Parallel story implementation by multiple AI agents (using cloud API)

**Flow:**
```
SM (draft story)
  → Assign to agents
  → Dev swarm (parallel execution)
  → QA (review)
  → Integrate
  → Loop
```

**Key Features:**
- Uses **cloud API** for powerful code generation (Claude, Gemini, etc.)
- Parallel execution: Multiple dev agents work simultaneously
- Automatic dependency management
- QA review loop

**Usage:**
```typescript
import { createSwarmGraph } from 'devhive-workflows';
import { createContentGenerator, AuthType } from 'devhive-core';

// Create cloud API generator for coding
const cloudGenerator = await createContentGenerator({
  authType: AuthType.LOGIN_WITH_GOOGLE,
}, config);

const abortController = new AbortController();

// Create swarm graph with LLM integration
const graph = createSwarmGraph(cloudGenerator, abortController.signal);

// Run swarm workflow
const result = await graph.invoke({
  storyQueue: stories, // From planning workflow
  activeStories: [],
  completedStories: [],
  agents: [
    { id: 'dev-1', name: 'Dev Agent 1', status: 'idle' },
    { id: 'dev-2', name: 'Dev Agent 2', status: 'idle' },
    { id: 'dev-3', name: 'Dev Agent 3', status: 'idle' },
  ],
  maxAgents: 3,
  codeChanges: [],
  testResults: [],
  phase: 'assign',
  blockedStories: [],
});

console.log('Completed stories:', result.completedStories);
console.log('Code changes:', result.codeChanges);
```

## Agent Personas

Agent personas are loaded from `src/agents/prompts/*.md` (copied from devhive-bmad).

Each persona defines:
- **Agent metadata**: name, id, title, icon
- **Persona traits**: role, style, identity, focus
- **Core principles**: behavioral guidelines

**Available agents:**
- `analyst` - Research and project brief creation
- `pm` - Product management and PRD creation
- `architect` - Technical architecture and design
- `po` - Product owner, validation and sharding
- `sm` - Scrum master, story drafting
- `dev` - Developer, code implementation
- `qa` - Quality assurance, testing and review

**Usage:**
```typescript
import { getAgentPrompt, ANALYST, PM } from 'devhive-workflows';

// Get system prompt for PM
const pmPrompt = getAgentPrompt('pm');

// Access persona details
console.log(ANALYST.agent.name);  // "Alex"
console.log(ANALYST.persona.role); // "Investigative Product Strategist"
```

## State Management

LangGraph uses typed state that flows through the workflow:

**PlanningState:**
- Project artifacts (brief, PRD, architecture)
- Decomposed work (epics, stories)
- Workflow control (phase, validation issues)

**SwarmState:**
- Active work (stories, agents)
- Queue management
- Results (code changes, test results)

## LLM Routing

DevHive automatically routes LLM calls based on workflow:

- **Planning nodes** → Local LLM (llama.cpp, Ollama, etc.)
- **Swarm nodes** → Cloud API (Gemini, Claude, etc.)

This is configured in the DevHive config:
```typescript
{
  config: {
    planningLLM: 'local',
    codingLLM: 'cloud',
    maxParallelAgents: 5
  }
}
```

## Development Status

**Current (Alpha):**
- ✅ Workflow graph structure
- ✅ Agent persona system
- ✅ Type definitions
- ✅ Planning node skeletons
- ✅ Swarm graph skeleton

**TODO:**
- 🚧 Implement actual LLM calls in planning nodes
- 🚧 Implement parallel dev execution in swarm
- 🚧 Document template system
- 🚧 State persistence/checkpointing
- 🚧 CLI integration
- 🚧 Error handling and retries

## Integration with DevHive CLI

The workflows package will be integrated into DevHive CLI commands:

```bash
# Planning workflow
devhive epic create "User authentication"
devhive epic break

# Swarm workflow
devhive swarm start --max-agents 3
devhive swarm status
```

See main DevHive README for usage examples.
