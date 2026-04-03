import Anthropic from '@anthropic-ai/sdk';
import { loadKnowledgeBase, type Chunk } from './embeddings';
import { retrieveByKeyword, type RetrievedChunk } from './retriever';
import { buildSystemPrompt, buildMessages } from './prompt';
import { pokerTools, executeTool, type ToolDefinition } from './tools';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  response: string;
  retrievedChunks: string[];
}

export class ChatService {
  private client: Anthropic;
  private chunks: Chunk[];
  private model = 'claude-sonnet-4-6';

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });

    // ESM-compatible __dirname
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const knowledgeDir = join(currentDir, '..', 'knowledge');
    try {
      this.chunks = loadKnowledgeBase(knowledgeDir);
      console.log(`Loaded ${this.chunks.length} knowledge chunks`);
    } catch {
      console.warn('Could not load knowledge base, using empty chunks');
      this.chunks = [];
    }
  }

  /**
   * Process a user message through the RAG pipeline.
   */
  async chat(
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    // 1. Retrieve relevant chunks (using keyword fallback — no pgvector needed for dev)
    const retrievedChunks = retrieveByKeyword(userMessage, this.chunks, 5);

    // 2. Build the system prompt with context
    const systemPrompt = buildSystemPrompt(retrievedChunks);

    // 3. Build messages
    const { system, messages } = buildMessages(
      systemPrompt,
      userMessage,
      conversationHistory
    );

    // 4. Call Claude API with tools
    const anthropicMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system,
      messages: anthropicMessages,
      tools: pokerTools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Messages.Tool['input_schema'],
      })),
    });

    // 5. Handle tool use if Claude wants to call a tool
    let finalText = '';
    const toolMessages = [...anthropicMessages];

    while (response.stop_reason === 'tool_use') {
      const assistantContent = response.content;
      toolMessages.push({ role: 'assistant', content: assistantContent as unknown as string });

      const toolUseBlocks = assistantContent.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults = toolUseBlocks.map(block => ({
        type: 'tool_result' as const,
        tool_use_id: block.id,
        content: executeTool(block.name, block.input as Record<string, unknown>),
      }));

      toolMessages.push({ role: 'user', content: toolResults as unknown as string });

      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: toolMessages,
        tools: pokerTools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Messages.Tool['input_schema'],
        })),
      });
    }

    // Extract text from response
    for (const block of response.content) {
      if (block.type === 'text') {
        finalText += block.text;
      }
    }

    return {
      response: finalText,
      retrievedChunks: retrievedChunks.map(c => c.id),
    };
  }
}
