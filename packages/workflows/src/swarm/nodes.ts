/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentGenerator } from 'devhive-core';
import type { SwarmState, Story, Epic } from '../types/state.js';
import { getAgentPrompt } from '../agents/personas.js';

/**
 * Creates swarm node implementations
 */
export function createSwarmNodes(
  contentGenerator: ContentGenerator,
  abortSignal: AbortSignal,
) {
  /**
   * SM drafts story with parallelization focus
   */
  async function smDraftNode(state: SwarmState): Promise<Partial<SwarmState>> {
    if (state.storyQueue.length === 0) {
      return { phase: 'complete' };
    }

    const nextStory = state.storyQueue[0];

    // Get parallelization-aware SM prompt
    const systemPrompt = getAgentPrompt('sm', { parallelizationMode: true });

    const userPrompt = `Draft a detailed implementation plan for this story, optimized for parallel swarm execution:

STORY:
ID: ${nextStory.id}
Title: ${nextStory.title}
Description: ${nextStory.description}

ACCEPTANCE CRITERIA:
${nextStory.acceptanceCriteria.map((ac, i) => `${i + 1}. ${ac}`).join('\n')}

EXISTING DEPENDENCIES:
${nextStory.dependencies?.length ? nextStory.dependencies.join(', ') : 'None'}

CONTEXT - Other stories in queue:
${state.storyQueue.slice(1, 6).map((s) => `- ${s.id}: ${s.title}`).join('\n')}

YOUR TASK:
1. Break this story into detailed tasks
2. Identify any hard dependencies on other stories
3. Suggest if this story could be split into scaffolding + parallel work
4. Identify potential file conflicts with other in-flight stories
5. Mark any tasks that could block the swarm

Return a JSON structure:
{
  "story": {
    "id": "${nextStory.id}",
    "tasks": [
      {
        "id": "TASK-001",
        "description": "...",
        "estimatedTime": "30min",
        "files": ["path/to/file.ts"],
        "canStartImmediately": true
      }
    ],
    "hardDependencies": ["EPIC-001-002"],
    "softDependencies": [],
    "parallelizationNotes": "This story can run in parallel with X, Y, Z because...",
    "potentialConflicts": []
  }
}`;

    const response = await contentGenerator.generateContent(
      {
        model: 'default',
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      },
      `swarm-sm-draft-${Date.now()}`,
    );

    const text =
      response.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text)
        .join('') || '{}';

    try {
      const parsed = JSON.parse(text);

      // Update the story with detailed tasks
      const draftedStory: Story = {
        ...nextStory,
        tasks: parsed.story.tasks || [],
        dependencies: parsed.story.hardDependencies || nextStory.dependencies,
        status: 'ready',
      };

      // Check if story is blocked by dependencies
      const isBlocked = draftedStory.dependencies?.some((depId) =>
        state.completedStories.every((s) => s.id !== depId),
      );

      if (isBlocked) {
        // Move to blocked queue
        return {
          storyQueue: state.storyQueue.slice(1),
          blockedStories: [...state.blockedStories, draftedStory.id],
          phase: 'assign',
        };
      }

      // Story is ready for assignment
      return {
        storyQueue: state.storyQueue.slice(1),
        activeStories: [...state.activeStories, draftedStory],
        phase: 'assign',
      };
    } catch (error) {
      console.error('Failed to parse SM draft response:', error);
      return {
        phase: 'assign', // Skip to next story
      };
    }
  }

  /**
   * Assigns stories to available agents
   */
  async function assignNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const idleAgents = state.agents.filter((a) => a.status === 'idle');
    const unassignedStories = state.activeStories.filter((s) => !s.assignedAgent);

    if (idleAgents.length === 0 || unassignedStories.length === 0) {
      return { phase: 'execute' };
    }

    // Simple round-robin assignment for now
    // TODO: Smart assignment based on agent expertise, story complexity, etc.
    const assignments = unassignedStories.slice(0, idleAgents.length).map((story, i) => ({
      storyId: story.id,
      agentId: idleAgents[i].id,
    }));

    const updatedStories = state.activeStories.map((story) => {
      const assignment = assignments.find((a) => a.storyId === story.id);
      if (assignment) {
        return { ...story, assignedAgent: assignment.agentId, status: 'in_progress' as const };
      }
      return story;
    });

    const updatedAgents = state.agents.map((agent) => {
      const assignment = assignments.find((a) => a.agentId === agent.id);
      if (assignment) {
        return {
          ...agent,
          status: 'working' as const,
          assignedStory: assignment.storyId,
          progress: 0,
        };
      }
      return agent;
    });

    return {
      activeStories: updatedStories,
      agents: updatedAgents,
      phase: 'execute',
    };
  }

  /**
   * Parallel dev execution - multiple agents working simultaneously
   */
  async function devSwarmNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const workingAgents = state.agents.filter((a) => a.status === 'working');

    if (workingAgents.length === 0) {
      return { phase: 'review' };
    }

    // Execute all agents in parallel
    const devPromises = workingAgents.map(async (agent) => {
      const story = state.activeStories.find((s) => s.id === agent.assignedStory);
      if (!story) return null;

      // Use cloud API for coding (powerful but expensive)
      const systemPrompt = getAgentPrompt('dev');

      const userPrompt = `Implement this user story:

STORY: ${story.title}
${story.description}

TASKS:
${story.tasks.map((t, i) => `${i + 1}. ${t.description}`).join('\n')}

ACCEPTANCE CRITERIA:
${story.acceptanceCriteria.map((ac, i) => `${i + 1}. ${ac}`).join('\n')}

IMPLEMENTATION REQUIREMENTS:
- Write production-quality code
- Include comprehensive tests
- Follow project conventions
- Document complex logic

Return your implementation as a JSON structure:
{
  "files": [
    {
      "path": "src/features/auth/login.ts",
      "action": "create",
      "content": "// full file content here"
    }
  ],
  "tests": [
    {
      "path": "src/features/auth/login.test.ts",
      "action": "create",
      "content": "// full test file content"
    }
  ],
  "commitMessage": "feat: implement user login flow"
}`;

      const response = await contentGenerator.generateContent(
        {
          model: 'default',
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.3, // Lower temp for more consistent code
            maxOutputTokens: 8192,
          },
        },
        `swarm-dev-${agent.id}-${Date.now()}`,
      );

      const text =
        response.candidates?.[0]?.content?.parts
          ?.map((part: any) => part.text)
          .join('') || '{}';

      try {
        const parsed = JSON.parse(text);
        return {
          agentId: agent.id,
          storyId: story.id,
          files: [...parsed.files, ...parsed.tests],
          commitMessage: parsed.commitMessage,
          status: 'pending' as const,
        };
      } catch (error) {
        console.error(`Agent ${agent.id} failed to generate valid code:`, error);
        return null;
      }
    });

    const codeChanges = (await Promise.all(devPromises)).filter(
      (change) => change !== null,
    );

    // Update agent status
    const updatedAgents = state.agents.map((agent) => {
      const hasChange = codeChanges.some((c) => c?.agentId === agent.id);
      if (hasChange) {
        return { ...agent, status: 'idle' as const, progress: 100 };
      }
      return agent;
    });

    return {
      codeChanges: [...state.codeChanges, ...codeChanges],
      agents: updatedAgents,
      phase: 'review',
    };
  }

  /**
   * QA review node: Reviews completed work
   */
  async function qaReviewNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const pendingChanges = state.codeChanges.filter((c) => c.status === 'pending');

    if (pendingChanges.length === 0) {
      return { phase: 'integrate' };
    }

    const systemPrompt = getAgentPrompt('qa');

    // Review each code change
    const reviewPromises = pendingChanges.map(async (change) => {
      const story = state.activeStories.find((s) => s.id === change.storyId);
      if (!story) return null;

      const userPrompt = `Review this code implementation for quality and completeness:

STORY: ${story.title}
${story.description}

ACCEPTANCE CRITERIA:
${story.acceptanceCriteria.map((ac, i) => `${i + 1}. ${ac}`).join('\n')}

CODE CHANGES:
${change.files.map((f) => `${f.path} (${f.action})\n${f.content?.substring(0, 1000) || ''}...`).join('\n\n')}

REVIEW CHECKLIST:
1. Does the code meet all acceptance criteria?
2. Are there adequate tests?
3. Is the code quality acceptable (readability, structure)?
4. Are there any security or performance concerns?
5. Does it follow the project's coding standards?

Return JSON:
{
  "approved": true/false,
  "testResults": {
    "passed": 10,
    "failed": 0,
    "coverage": 85
  },
  "issues": ["Issue 1", "Issue 2"],
  "recommendation": "approve" | "needs_work"
}`;

      const response = await contentGenerator.generateContent(
        {
          model: 'default',
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        },
        `swarm-qa-${change.storyId}-${Date.now()}`,
      );

      const text =
        response.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('') || '{}';

      try {
        const review = JSON.parse(text);
        return {
          storyId: change.storyId,
          ...review.testResults,
          failures: review.issues.map((issue: string) => ({
            test: 'QA Review',
            error: issue,
          })),
          approved: review.approved,
        };
      } catch (error) {
        console.error('Failed to parse QA review:', error);
        return null;
      }
    });

    const testResults = (await Promise.all(reviewPromises)).filter((r) => r !== null);

    // Update code change status based on reviews
    const updatedChanges = state.codeChanges.map((change) => {
      const review = testResults.find((r) => r?.storyId === change.storyId);
      if (review?.approved) {
        return { ...change, status: 'reviewed' as const };
      }
      return change;
    });

    const hasFailures = testResults.some((r) => r && r.failed > 0);

    return {
      testResults: testResults as any,
      codeChanges: updatedChanges,
      phase: hasFailures ? 'execute' : 'integrate', // Back to dev if issues found
    };
  }

  /**
   * Integration node: Merges approved changes
   */
  async function integrateNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const reviewedChanges = state.codeChanges.filter((c) => c.status === 'reviewed');

    if (reviewedChanges.length === 0) {
      return { phase: 'complete' };
    }

    // For each reviewed change, mark the story as completed
    const completedStoryIds = reviewedChanges.map((c) => c.storyId);
    const completedStories = state.activeStories
      .filter((s) => completedStoryIds.includes(s.id))
      .map((s) => ({ ...s, status: 'completed' as const }));

    const remainingActive = state.activeStories.filter(
      (s) => !completedStoryIds.includes(s.id),
    );

    // Mark changes as merged
    const mergedChanges = state.codeChanges.map((change) => {
      if (change.status === 'reviewed') {
        return { ...change, status: 'merged' as const };
      }
      return change;
    });

    // Check if any blocked stories can be unblocked
    const unblocked: string[] = [];
    const stillBlocked: string[] = [];

    for (const blockedId of state.blockedStories) {
      const blockedStory = state.storyQueue.find((s) => s.id === blockedId);
      if (!blockedStory) continue;

      const allDepsCompleted = blockedStory.dependencies?.every((depId) =>
        [...state.completedStories, ...completedStories].some((s) => s.id === depId),
      );

      if (allDepsCompleted) {
        unblocked.push(blockedId);
      } else {
        stillBlocked.push(blockedId);
      }
    }

    // Move unblocked stories back to queue
    const updatedQueue = [
      ...state.storyQueue.filter((s) => !state.blockedStories.includes(s.id)),
      ...state.storyQueue.filter((s) => unblocked.includes(s.id)),
    ];

    // Determine next phase
    const hasMoreWork = updatedQueue.length > 0 || remainingActive.length > 0;

    return {
      activeStories: remainingActive,
      completedStories: [...state.completedStories, ...completedStories],
      codeChanges: mergedChanges,
      storyQueue: updatedQueue,
      blockedStories: stillBlocked,
      phase: hasMoreWork ? 'assign' : 'complete',
    };
  }

  return {
    smDraftNode,
    assignNode,
    devSwarmNode,
    qaReviewNode,
    integrateNode,
  };
}
