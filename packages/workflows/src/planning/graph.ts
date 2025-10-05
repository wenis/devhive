/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StateGraph, END } from '@langchain/langgraph';
import type { ContentGenerator } from 'devhive-core';
import type { PlanningState } from '../types/state.js';
import { createPlanningNodes } from './nodes.js';

/**
 * Planning workflow graph
 * Implements BMAD planning phase:
 * 1. Analyst: Create project brief
 * 2. PM: Create PRD from brief
 * 3. UX Expert: Create UX spec (optional)
 * 4. Architect: Create architecture
 * 5. PO: Validate all artifacts
 * 6. PO: Shard into epics/stories
 */

// Define the graph channels (how state updates merge)
const planningChannels = {
  projectBrief: {
    value: (x: any, y: any) => y ?? x,
    default: () => undefined,
  },
  prd: {
    value: (x: any, y: any) => y ?? x,
    default: () => undefined,
  },
  uxSpec: {
    value: (x: any, y: any) => y ?? x,
    default: () => undefined,
  },
  architecture: {
    value: (x: any, y: any) => y ?? x,
    default: () => undefined,
  },
  epics: {
    value: (x: any[], y: any[]) => y ?? x,
    default: () => [],
  },
  stories: {
    value: (x: any[], y: any[]) => y ?? x,
    default: () => [],
  },
  currentPhase: {
    value: (x: any, y: any) => y ?? x,
    default: () => 'brief' as const,
  },
  validationIssues: {
    value: (x: string[], y: string[]) => y ?? x,
    default: () => [],
  },
  needsUserInput: {
    value: (x: boolean, y: boolean) => y ?? x,
    default: () => false,
  },
  userMessage: {
    value: (x: any, y: any) => y ?? x,
    default: () => undefined,
  },
  projectType: {
    value: (x: any, y: any) => y ?? x,
    default: () => 'greenfield' as const,
  },
  includeUX: {
    value: (x: boolean, y: boolean) => y ?? x,
    default: () => false,
  },
};

// Node implementations are now injected via createPlanningNodes

/**
 * Conditional edge: Check if UX is needed
 */
function shouldIncludeUX(state: PlanningState): string {
  return state.includeUX ? 'ux' : 'architect';
}

/**
 * Conditional edge: Check if validation passed
 */
function checkValidation(state: PlanningState): string {
  if (state.validationIssues.length > 0) {
    // Route back to PM to fix issues
    return 'pm';
  }
  return 'po_shard';
}

/**
 * Conditional edge: Check if planning is complete
 */
function checkComplete(state: PlanningState): string {
  return state.currentPhase === 'complete' ? END : 'analyst';
}

/**
 * Create the planning workflow graph
 */
export function createPlanningGraph(
  contentGenerator: ContentGenerator,
  abortSignal: AbortSignal,
) {
  const workflow = new StateGraph<PlanningState>({
    channels: planningChannels as any,
  });

  // Create node implementations with LLM integration
  const nodes = createPlanningNodes(contentGenerator, abortSignal);

  // Add nodes
  workflow.addNode('analyst', nodes.analystNode);
  workflow.addNode('pm', nodes.pmNode);
  workflow.addNode('ux', nodes.uxNode);
  workflow.addNode('architect', nodes.architectNode);
  workflow.addNode('po_validate', nodes.poValidateNode);
  workflow.addNode('po_shard', nodes.poShardNode);

  // Define edges
  workflow.addEdge('analyst', 'pm');

  // Conditional: PM → UX or Architect
  workflow.addConditionalEdges('pm', shouldIncludeUX, {
    ux: 'ux',
    architect: 'architect',
  });

  workflow.addEdge('ux', 'architect');
  workflow.addEdge('architect', 'po_validate');

  // Conditional: Validation → Shard or back to PM
  workflow.addConditionalEdges('po_validate', checkValidation, {
    pm: 'pm',
    po_shard: 'po_shard',
  });

  // Conditional: Shard → END or loop
  workflow.addConditionalEdges('po_shard', checkComplete, {
    [END]: END,
    analyst: 'analyst',
  });

  // Set entry point
  workflow.setEntryPoint('analyst');

  return workflow.compile();
}
