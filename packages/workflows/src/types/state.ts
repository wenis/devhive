/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Epic representation
 */
export interface Epic {
  id: string;
  title: string;
  description: string;
  stories: Story[];
  status: 'planned' | 'in_progress' | 'completed';
}

/**
 * User story representation
 */
export interface Story {
  id: string;
  epicId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  tasks: Task[];
  assignedAgent?: string;
  status: 'draft' | 'ready' | 'in_progress' | 'review' | 'completed';
  dependencies?: string[]; // IDs of stories this depends on
}

/**
 * Task within a story
 */
export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignedTo?: string;
}

/**
 * Document artifact
 */
export interface Artifact {
  type: 'project-brief' | 'prd' | 'architecture' | 'ux-spec' | 'story' | 'epic';
  content: string;
  version: number;
  createdBy: string;
  lastModified: Date;
}

/**
 * Planning workflow state
 * Used for: Epic creation → Story decomposition → Architecture
 */
export interface PlanningState {
  // Project artifacts
  projectBrief?: Artifact;
  prd?: Artifact;
  uxSpec?: Artifact;
  architecture?: Artifact;

  // Decomposed work items
  epics: Epic[];
  stories: Story[];

  // Workflow control
  currentPhase: 'brief' | 'prd' | 'ux' | 'architecture' | 'validation' | 'sharding' | 'complete';
  validationIssues: string[];
  needsUserInput: boolean;
  userMessage?: string;

  // Configuration
  projectType: 'greenfield' | 'brownfield';
  includeUX: boolean;
}

/**
 * Swarm workflow state
 * Used for: Parallel agent execution on stories
 */
export interface SwarmState {
  // Active work
  activeStories: Story[];
  completedStories: Story[];

  // Agent assignments
  agents: AgentStatus[];
  maxAgents: number;

  // Queue management
  storyQueue: Story[];

  // Results
  codeChanges: CodeChange[];
  testResults: TestResult[];

  // Workflow control
  phase: 'assign' | 'execute' | 'review' | 'integrate' | 'complete';
  blockedStories: string[]; // Story IDs waiting on dependencies
}

/**
 * Agent status in swarm
 */
export interface AgentStatus {
  id: string;
  name: string;
  assignedStory?: string;
  status: 'idle' | 'working' | 'blocked' | 'error';
  progress?: number; // 0-100
}

/**
 * Code change representation
 */
export interface CodeChange {
  storyId: string;
  agentId: string;
  files: FileChange[];
  commitMessage: string;
  status: 'pending' | 'reviewed' | 'merged';
}

/**
 * File change
 */
export interface FileChange {
  path: string;
  action: 'create' | 'modify' | 'delete';
  content?: string;
  diff?: string;
}

/**
 * Test execution result
 */
export interface TestResult {
  storyId: string;
  suite: string;
  passed: number;
  failed: number;
  coverage?: number;
  failures: TestFailure[];
}

/**
 * Individual test failure
 */
export interface TestFailure {
  test: string;
  error: string;
  stackTrace?: string;
}

/**
 * Combined application state
 * This is the root state that can be routed between different workflows
 */
export interface AppState {
  // Workflow routing
  mode: 'planning' | 'swarm' | 'interactive';

  // Sub-states for different workflows
  planning?: PlanningState;
  swarm?: SwarmState;

  // Shared context
  projectRoot: string;
  config: {
    planningLLM: 'local' | 'cloud';
    codingLLM: 'local' | 'cloud';
    maxParallelAgents: number;
  };
}
