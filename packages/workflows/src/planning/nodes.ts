/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentGenerator } from 'devhive-core';
import type { PlanningState, Artifact } from '../types/state.js';
import { getAgentPrompt } from '../agents/personas.js';

/**
 * Helper to call LLM with agent persona
 */
async function callAgent(
  agentId: 'analyst' | 'pm' | 'architect' | 'po',
  userPrompt: string,
  contentGenerator: ContentGenerator,
  abortSignal: AbortSignal,
): Promise<string> {
  const systemPrompt = getAgentPrompt(agentId);

  const response = await contentGenerator.generateContent(
    {
      model: 'default', // Will be routed based on config
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    },
    `planning-${agentId}-${Date.now()}`,
  );

  // Extract text from response
  const text = response.candidates?.[0]?.content?.parts
    ?.map((part: any) => part.text)
    .join('') || '';

  return text;
}

/**
 * Creates agent node factory
 */
export function createPlanningNodes(
  contentGenerator: ContentGenerator,
  abortSignal: AbortSignal,
) {
  /**
   * Analyst node: Creates project brief
   */
  async function analystNode(state: PlanningState): Promise<Partial<PlanningState>> {
    const prompt = `Create a comprehensive project brief for the following idea:

${state.userMessage || 'User has not provided a project description yet.'}

Include:
1. Problem statement
2. Target users
3. Key objectives
4. Success criteria
5. High-level requirements

Format as a structured markdown document.`;

    const briefContent = await callAgent('analyst', prompt, contentGenerator, abortSignal);

    const artifact: Artifact = {
      type: 'project-brief',
      content: briefContent,
      version: 1,
      createdBy: 'analyst',
      lastModified: new Date(),
    };

    return {
      projectBrief: artifact,
      currentPhase: 'prd',
      needsUserInput: false,
    };
  }

  /**
   * PM node: Creates PRD from project brief
   */
  async function pmNode(state: PlanningState): Promise<Partial<PlanningState>> {
    if (!state.projectBrief) {
      throw new Error('Project brief is required for PRD creation');
    }

    const prompt = `Based on this project brief, create a comprehensive Product Requirements Document (PRD):

PROJECT BRIEF:
${state.projectBrief.content}

The PRD should include:
1. Executive Summary
2. Functional Requirements (FRs)
3. Non-Functional Requirements (NFRs)
4. Epics (high-level feature groups)
5. User Stories (within each epic)
   - Format: "As a [user], I want [action] so that [benefit]"
   - Include acceptance criteria for each story
6. Success Metrics
7. Out of Scope

Format as structured markdown with clear sections.`;

    const prdContent = await callAgent('pm', prompt, contentGenerator, abortSignal);

    const artifact: Artifact = {
      type: 'prd',
      content: prdContent,
      version: 1,
      createdBy: 'pm',
      lastModified: new Date(),
    };

    return {
      prd: artifact,
      currentPhase: state.includeUX ? 'ux' : 'architecture',
    };
  }

  /**
   * UX node: Creates UX specification
   */
  async function uxNode(state: PlanningState): Promise<Partial<PlanningState>> {
    if (!state.prd) {
      throw new Error('PRD is required for UX spec creation');
    }

    const prompt = `Based on this PRD, create a comprehensive UX specification:

PRD:
${state.prd.content}

The UX spec should include:
1. User personas
2. User flows
3. Wireframes (described textually)
4. Component specifications
5. Interaction patterns
6. Accessibility requirements
7. Responsive design considerations

Format as structured markdown.`;

    const uxContent = await callAgent('pm', prompt, contentGenerator, abortSignal); // UX uses PM persona for now

    const artifact: Artifact = {
      type: 'ux-spec',
      content: uxContent,
      version: 1,
      createdBy: 'ux-expert',
      lastModified: new Date(),
    };

    return {
      uxSpec: artifact,
      currentPhase: 'architecture',
    };
  }

  /**
   * Architect node: Creates technical architecture
   */
  async function architectNode(state: PlanningState): Promise<Partial<PlanningState>> {
    if (!state.prd) {
      throw new Error('PRD is required for architecture creation');
    }

    const inputs = [`PRD:\n${state.prd.content}`];
    if (state.uxSpec) {
      inputs.push(`\nUX SPEC:\n${state.uxSpec.content}`);
    }

    const prompt = `Based on these requirements, create a comprehensive technical architecture:

${inputs.join('\n')}

The architecture should include:
1. System Overview
2. Technology Stack
   - Frontend framework
   - Backend framework
   - Database choice
   - Infrastructure
3. High-Level Architecture Diagram (described textually)
4. API Design
5. Data Models
6. Security Considerations
7. Scalability Strategy
8. Development Approach
   - Recommended story implementation order
   - Dependencies between stories
9. Testing Strategy

Format as structured markdown.`;

    const archContent = await callAgent('architect', prompt, contentGenerator, abortSignal);

    const artifact: Artifact = {
      type: 'architecture',
      content: archContent,
      version: 1,
      createdBy: 'architect',
      lastModified: new Date(),
    };

    return {
      architecture: artifact,
      currentPhase: 'validation',
    };
  }

  /**
   * PO validation node: Validates all artifacts for consistency
   */
  async function poValidateNode(state: PlanningState): Promise<Partial<PlanningState>> {
    const artifacts = [
      state.projectBrief && `PROJECT BRIEF:\n${state.projectBrief.content}`,
      state.prd && `PRD:\n${state.prd.content}`,
      state.uxSpec && `UX SPEC:\n${state.uxSpec.content}`,
      state.architecture && `ARCHITECTURE:\n${state.architecture.content}`,
    ].filter(Boolean);

    const prompt = `Review these project artifacts for consistency, completeness, and alignment:

${artifacts.join('\n\n---\n\n')}

Check for:
1. Consistency: Do all documents align with each other?
2. Completeness: Are all necessary sections present?
3. Clarity: Are requirements and architecture clearly defined?
4. Feasibility: Is the architecture appropriate for the requirements?
5. Gaps: Are there any missing requirements or architectural decisions?

If you find any issues, list them clearly. If everything looks good, respond with "VALIDATED".

Format your response as:
- VALIDATED (if no issues)
- Or a bulleted list of issues that need to be addressed`;

    const validationResult = await callAgent('po', prompt, contentGenerator, abortSignal);

    const isValid = validationResult.trim().toUpperCase().includes('VALIDATED');
    const issues = isValid ? [] : [validationResult];

    return {
      validationIssues: issues,
      currentPhase: isValid ? 'sharding' : 'prd',
      needsUserInput: !isValid,
      userMessage: isValid
        ? undefined
        : `Validation found issues that need to be addressed:\n\n${validationResult}`,
    };
  }

  /**
   * PO shard node: Breaks down PRD into epics and stories
   */
  async function poShardNode(state: PlanningState): Promise<Partial<PlanningState>> {
    if (!state.prd || !state.architecture) {
      throw new Error('PRD and Architecture are required for sharding');
    }

    const prompt = `Extract the epics and stories from this PRD, and enrich them with implementation details from the architecture:

PRD:
${state.prd.content}

ARCHITECTURE:
${state.architecture.content}

For each Epic:
1. Extract the epic title and description
2. List all user stories within that epic
3. For each story, extract:
   - Story ID (format: EPIC-XXX)
   - Title
   - Description (As a... I want... So that...)
   - Acceptance criteria
   - Dependencies on other stories (if any)
   - Technical notes from architecture

Return a JSON structure:
{
  "epics": [
    {
      "id": "EPIC-001",
      "title": "...",
      "description": "...",
      "stories": [
        {
          "id": "EPIC-001-001",
          "title": "...",
          "description": "...",
          "acceptanceCriteria": ["...", "..."],
          "dependencies": ["EPIC-001-002"],
          "tasks": []
        }
      ]
    }
  ]
}`;

    const shardingResult = await callAgent('po', prompt, contentGenerator, abortSignal);

    // Parse JSON response
    try {
      const parsed = JSON.parse(shardingResult);
      return {
        epics: parsed.epics.map((epic: any) => ({
          ...epic,
          status: 'planned' as const,
        })),
        stories: parsed.epics.flatMap((epic: any) =>
          epic.stories.map((story: any) => ({
            ...story,
            epicId: epic.id,
            status: 'draft' as const,
          })),
        ),
        currentPhase: 'complete',
      };
    } catch (error) {
      return {
        validationIssues: [`Failed to parse epics/stories: ${error}`],
        needsUserInput: true,
      };
    }
  }

  return {
    analystNode,
    pmNode,
    uxNode,
    architectNode,
    poValidateNode,
    poShardNode,
  };
}
