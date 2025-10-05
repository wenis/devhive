/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StateGraph, END } from '@langchain/langgraph';
import type { ContentGenerator } from 'devhive-core';
import type {
  SwarmState,
  Story,
  AgentStatus,
  CodeChange,
  TestResult,
} from '../types/state.js';
import { createSwarmNodes } from './nodes.js';

/**
 * Swarm workflow graph
 * Implements parallel agent execution for coding:
 * 1. SM: Draft stories from epics
 * 2. Assign stories to dev agents
 * 3. Dev agents: Execute tasks in parallel
 * 4. QA: Review completed stories
 * 5. Integrate changes
 */

const swarmChannels = {
  activeStories: {
    value: (x: Story[], y: Story[]) => y ?? x,
    default: () => [],
  },
  completedStories: {
    value: (x: Story[], y: Story[]) => y ?? x,
    default: () => [],
  },
  agents: {
    value: (x: AgentStatus[], y: AgentStatus[]) => y ?? x,
    default: () => [],
  },
  maxAgents: {
    value: (x: number, y: number) => y ?? x,
    default: () => 3,
  },
  storyQueue: {
    value: (x: Story[], y: Story[]) => y ?? x,
    default: () => [],
  },
  codeChanges: {
    value: (x: CodeChange[], y: CodeChange[]) => y ?? x,
    default: () => [],
  },
  testResults: {
    value: (x: TestResult[], y: TestResult[]) => y ?? x,
    default: () => [],
  },
  phase: {
    value: (x: SwarmState['phase'], y: SwarmState['phase']) => y ?? x,
    default: () => 'assign' as const,
  },
  blockedStories: {
    value: (x: string[], y: string[]) => y ?? x,
    default: () => [],
  },
};

// Node implementations are now injected via createSwarmNodes

/**
 * Conditional: Check if more work exists
 */
function hasMoreWork(state: SwarmState): string {
  if (state.storyQueue.length > 0 || state.activeStories.length > 0) {
    return 'assign';
  }
  return END;
}

/**
 * Conditional: Check if stories need more dev work
 */
function needsMoreDev(state: SwarmState): string {
  // Check if QA found issues
  const hasFailedTests = state.testResults.some((result) => result.failed > 0);
  if (hasFailedTests) {
    return 'dev_swarm';
  }
  return 'integrate';
}

/**
 * Create the swarm workflow graph
 */
export function createSwarmGraph(
  contentGenerator: ContentGenerator,
  abortSignal: AbortSignal,
) {
  const workflow = new StateGraph<SwarmState>({
    channels: swarmChannels,
  });

  // Create node implementations with LLM integration
  const nodes = createSwarmNodes(contentGenerator, abortSignal);

  // Add nodes (chain calls to properly type the graph)
  const graph = workflow
    .addNode('sm_draft', nodes.smDraftNode)
    .addNode('assign', nodes.assignNode)
    .addNode('dev_swarm', nodes.devSwarmNode)
    .addNode('qa_review', nodes.qaReviewNode)
    .addNode('integrate', nodes.integrateNode);

  // Define edges
  graph.addEdge('sm_draft', 'assign');
  graph.addEdge('assign', 'dev_swarm');
  graph.addEdge('dev_swarm', 'qa_review');

  // Conditional: QA -> Dev (if issues) or Integrate
  graph.addConditionalEdges('qa_review', needsMoreDev, {
    dev_swarm: 'dev_swarm',
    integrate: 'integrate',
  });

  // Conditional: Integrate -> Assign (more work) or END
  graph.addConditionalEdges('integrate', hasMoreWork, {
    assign: 'assign',
    [END]: END,
  });

  // Set entry point
  graph.setEntryPoint('sm_draft');

  return graph.compile();
}
