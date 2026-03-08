// ─── Anthropic API Service ─────────────────────────────────────────────────────
// Provides two main functions:
//   sendAIPMMessage — orchestrator chat (multi-turn conversation with project context)
//   runSubAgent     — one-shot specialist agent task execution
//
// Cost calculation (claude-sonnet-4-6 pricing):
//   Input:  $3.00 per 1M tokens  → $0.000003 per token
//   Output: $15.00 per 1M tokens → $0.000015 per token
// ─────────────────────────────────────────────────────────────────────────────

const Anthropic = require('@anthropic-ai/sdk');
const { AIPM_SYSTEM_PROMPT, AGENT_SYSTEM_PROMPTS } = require('./agentPrompts');

// Initialise the Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Model used for all agents
const MODEL = 'claude-sonnet-4-6';

// Cost per token in USD
const COST_PER_INPUT_TOKEN = 0.000003;
const COST_PER_OUTPUT_TOKEN = 0.000015;

/**
 * Calculates the USD cost for a given token usage.
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number} cost in USD
 */
function calculateCost(inputTokens, outputTokens) {
  return inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;
}

/**
 * Send a message to the AIPM orchestrator in the context of a project.
 * Supports multi-turn conversation by accepting a messages history array.
 *
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 *   The full conversation history including the latest user message.
 * @param {Object} projectContext
 *   JSON object with project name, goal, milestones summary, active agents, etc.
 *   This is injected into the system prompt to ground the AI in project reality.
 * @returns {Promise<{content: string, inputTokens: number, outputTokens: number, cost: number}>}
 */
async function sendAIPMMessage(messages, projectContext = {}) {
  // Build a contextual system prompt that includes live project data
  const contextSection = projectContext && Object.keys(projectContext).length > 0
    ? `\n\n## Current Project Context\n\`\`\`json\n${JSON.stringify(projectContext, null, 2)}\n\`\`\``
    : '';

  const systemPrompt = AIPM_SYSTEM_PROMPT + contextSection;

  // Ensure messages are in the correct Anthropic format
  const formattedMessages = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: String(msg.content),
  }));

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: formattedMessages,
  });

  const content = response.content[0]?.text ?? '';
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  return {
    content,
    inputTokens,
    outputTokens,
    cost: calculateCost(inputTokens, outputTokens),
  };
}

/**
 * Parses a sub-agent's structured response into its component parts.
 *
 * Expected format:
 *   Line 1: LABEL IN ALL CAPS
 *   Lines 2+: Key: Value pairs (up to first blank line or section header)
 *   Remainder: Free-form prose
 *
 * @param {string} rawContent - The raw text response from the agent
 * @returns {{ label: string, fields: [string, string][], fileContent: string }}
 */
function parseAgentResponse(rawContent) {
  const lines = rawContent.split('\n');

  // Extract label — first non-empty line in ALL_CAPS (allowing spaces and colons)
  let label = '';
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const trimmed = lines[i].trim();
    if (trimmed && trimmed === trimmed.toUpperCase() && /^[A-Z\s\-_:]+$/.test(trimmed)) {
      label = trimmed;
      startIdx = i + 1;
      break;
    }
  }

  // Extract key: value fields from subsequent lines
  const fields = [];
  let fieldEndIdx = startIdx;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();

    // Stop at blank line or markdown section header
    if (line === '' || line.startsWith('#')) {
      fieldEndIdx = i;
      break;
    }

    // Match "Key: Value" pattern (key must not contain line breaks)
    const colonIdx = line.indexOf(': ');
    if (colonIdx > 0 && colonIdx < 50) {
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 2).trim();
      if (key && value && !key.startsWith('-') && !key.startsWith('*')) {
        fields.push([key, value]);
        fieldEndIdx = i + 1;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return {
    label: label || 'AGENT OUTPUT',
    fields,
    fileContent: rawContent, // Full content is the downloadable file
  };
}

/**
 * Generates a markdown-formatted file from the agent's response.
 *
 * @param {string} agentType
 * @param {string} taskDescription
 * @param {string} label
 * @param {[string, string][]} fields
 * @param {string} fullContent
 * @returns {string} Markdown string ready for storage upload
 */
function buildMarkdownFile(agentType, taskDescription, label, fields, fullContent) {
  const timestamp = new Date().toISOString();
  const fieldLines = fields.map(([k, v]) => `- **${k}**: ${v}`).join('\n');

  return `# ${label}

> Generated by **${agentType} Agent** — AI Project Management Hub
> Timestamp: ${timestamp}

## Task Description
${taskDescription}

## Summary Fields
${fieldLines || '_No structured fields extracted._'}

---

## Full Output

${fullContent}
`;
}

/**
 * Runs a specialist sub-agent for a given task.
 *
 * The agent receives:
 *   - Its specialist system prompt
 *   - A user message describing the task and project context
 *
 * @param {string} agentType - One of the agent_type enum values (Research, Code, etc.)
 * @param {string} taskDescription - What the agent needs to do
 * @param {Object} projectContext - Project name, goal, milestones, etc.
 * @param {string} outputFilename - Desired filename for the output file (e.g. "research-report.md")
 * @returns {Promise<{
 *   content: string,
 *   label: string,
 *   fields: [string, string][],
 *   fileContent: string,
 *   inputTokens: number,
 *   outputTokens: number,
 *   cost: number
 * }>}
 */
async function runSubAgent(agentType, taskDescription, projectContext = {}, outputFilename = '') {
  // Resolve the system prompt for this agent type
  const systemPrompt = AGENT_SYSTEM_PROMPTS[agentType];
  if (!systemPrompt) {
    throw new Error(`Unknown agent type: "${agentType}". Valid types: ${Object.keys(AGENT_SYSTEM_PROMPTS).join(', ')}`);
  }

  // Build the user message with full context
  const contextSummary = Object.keys(projectContext).length > 0
    ? `\n\n## Project Context\n\`\`\`json\n${JSON.stringify(projectContext, null, 2)}\n\`\`\``
    : '';

  const userMessage = `## Your Task\n${taskDescription}${contextSummary}\n\n${outputFilename ? `## Output File\nYour response will be saved as: \`${outputFilename}\`` : ''}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  const rawContent = response.content[0]?.text ?? '';
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  // Parse the structured response
  const { label, fields, fileContent } = parseAgentResponse(rawContent);

  // Build a polished markdown file for download
  const markdownFile = buildMarkdownFile(agentType, taskDescription, label, fields, fileContent);

  return {
    content: rawContent,
    label,
    fields,
    fileContent: markdownFile, // This is what gets uploaded to storage
    inputTokens,
    outputTokens,
    cost: calculateCost(inputTokens, outputTokens),
  };
}

module.exports = {
  sendAIPMMessage,
  runSubAgent,
  calculateCost,
  COST_PER_INPUT_TOKEN,
  COST_PER_OUTPUT_TOKEN,
};
