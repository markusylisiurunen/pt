import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import { readAgentDocuments } from "../db/agent.ts";
import { FoodLogEntry } from "../entities/log.ts";
import { systemPrompt } from "../prompts/system.ts";
import {
  getDateAtTimeZone,
  getTimeAtTimeZone,
  getTimeZoneOffsetInMinutes,
  getWeekdayAtTimeZone,
} from "../util/datetime.ts";
import { type AgentTool, createTools } from "./tools.ts";

type AgentEvent =
  | { type: "content_delta"; content: string }
  | { type: "tool_use"; name: string };

type ChatMessage = Anthropic.Beta.BetaMessageParam;

const unexecutedResult = "Tool was not executed: the turn was interrupted before execution.";

class Agent {
  private id = crypto.randomUUID();
  private model = "claude-sonnet-5-5";
  private maxTokens: number | undefined;
  private client: Anthropic;
  private db: DatabaseSync;
  private tools: AgentTool[];
  private activeChats = new Set<string>();

  constructor(anthropicApiKey: string, db: DatabaseSync, client?: Anthropic) {
    this.client = client ?? new Anthropic({ apiKey: anthropicApiKey });
    this.db = db;
    this.tools = createTools(db);
  }

  async *send(
    id: string,
    content: string,
    images: { mimeType: "image/jpeg" | "image/png"; base64Data: string }[],
    signal?: AbortSignal,
  ): AsyncGenerator<AgentEvent> {
    if (this.activeChats.has(id)) throw new Error("This chat already has a response in progress.");
    const messages = this.recoverChatHistory(id);
    this.activeChats.add(id);
    try {
      signal?.throwIfAborted();
      if (this.maxTokens === undefined) {
        const model = await this.client.models.retrieve(this.model, {}, { signal });
        if (!model.max_tokens || model.max_tokens <= 0) {
          throw new Error("Sonnet's maximum output allowance is unavailable.");
        }
        this.maxTokens = model.max_tokens;
      }
      messages.push({
        role: "user",
        content: [
          ...(content ? [{ type: "text" as const, text: content }] : []),
          ...images.map((image) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: image.mimeType,
              data: image.base64Data,
            },
          })),
        ],
      });
      this.saveChatHistory(id, messages);

      for (let round = 0; round < 256; round++) {
        signal?.throwIfAborted();
        this.refreshCacheBreakpoints(messages);
        const stream = this.client.beta.messages.stream({
          max_tokens: this.maxTokens,
          messages: [
            ...messages,
            {
              role: "user",
              content: `<current_context>\n${this.getCurrentContext()}\n</current_context>`,
            },
          ],
          metadata: { user_id: this.id },
          model: this.model,
          system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          tools: this.tools.map((tool) => tool.definition),
        }, { signal });

        let message;
        try {
          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              yield { type: "content_delta", content: chunk.delta.text };
            }
          }
          message = await stream.finalMessage();
        } finally {
          stream.abort();
        }

        if (
          message.stop_reason === "max_tokens" ||
          message.stop_reason === "model_context_window_exceeded"
        ) {
          messages.push({
            role: "assistant",
            content: message.content.filter((block) => block.type !== "tool_use"),
          });
          const notice = message.stop_reason === "max_tokens"
            ? "This response reached Sonnet's output limit and is incomplete. " +
              "No tools from the incomplete response were executed. Earlier saved changes remain."
            : "This conversation reached Sonnet's context limit. Start a new chat to continue. " +
              "Earlier saved changes remain.";
          yield this.finishWithNotice(id, messages, notice);
          return;
        }

        messages.push({ role: "assistant", content: message.content });
        const blocks = message.content.filter((block) => block.type === "tool_use");
        if (blocks.length === 0) {
          this.saveChatHistory(id, messages);
          return;
        }

        const results: Anthropic.Beta.BetaToolResultBlockParam[] = blocks.map((block) => ({
          type: "tool_result",
          tool_use_id: block.id,
          content: unexecutedResult,
          is_error: true,
        }));
        messages.push({ role: "user", content: results });
        this.saveChatHistory(id, messages);

        for (const [index, block] of blocks.entries()) {
          signal?.throwIfAborted();
          yield { type: "tool_use", name: block.name };
          signal?.throwIfAborted();
          const tool = this.tools.find((tool) => tool.definition.name === block.name);
          try {
            if (!tool) throw new Error(`Unknown tool: ${block.name}`);
            if (tool.mutates) {
              this.db.exec("BEGIN IMMEDIATE");
              try {
                const result = tool.execute(block.input);
                results[index] = { type: "tool_result", tool_use_id: block.id, content: result };
                this.saveChatHistory(id, messages);
                this.db.exec("COMMIT");
              } catch (error) {
                this.db.exec("ROLLBACK");
                throw error;
              }
            } else {
              results[index] = {
                type: "tool_result",
                tool_use_id: block.id,
                content: await tool.execute(block.input),
              };
              this.saveChatHistory(id, messages);
            }
          } catch (error) {
            console.error(`Tool ${block.name} failed:`, error);
            results[index] = {
              type: "tool_result",
              tool_use_id: block.id,
              content: `Tool failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              is_error: true,
            };
            this.saveChatHistory(id, messages);
          }
        }
      }
      yield this.finishWithNotice(
        id,
        messages,
        "Stopped after 256 model rounds. Earlier saved changes remain. " +
          "Send another message to continue the unfinished work.",
      );
    } catch (error) {
      if (
        error instanceof Anthropic.BadRequestError &&
        /context window|prompt is too long|input is too long|too many input tokens/i.test(
          error.message,
        )
      ) {
        yield this.finishWithNotice(
          id,
          messages,
          "This conversation exceeds Sonnet's context limit. Start a new chat to continue. " +
            "Earlier saved changes remain.",
        );
        return;
      }
      throw error;
    } finally {
      this.activeChats.delete(id);
      this.recoverChatHistory(id);
    }
  }

  private finishWithNotice(id: string, messages: ChatMessage[], notice: string): AgentEvent {
    const text = "\n\n" + notice;
    const last = messages.at(-1);
    if (last?.role === "assistant" && Array.isArray(last.content)) {
      last.content.push({ type: "text", text });
    } else {
      messages.push({ role: "assistant", content: [{ type: "text", text }] });
    }
    this.saveChatHistory(id, messages);
    return { type: "content_delta", content: text };
  }

  private loadChatHistory(chatId: string): ChatMessage[] {
    const row = this.db.prepare("SELECT messages FROM chats WHERE id = ?").get(chatId) as
      | { messages: string }
      | undefined;
    return row ? JSON.parse(row.messages) : [];
  }

  private recoverChatHistory(id: string): ChatMessage[] {
    const messages = this.loadChatHistory(id);
    if (!this.activeChats.has(id) && messages.at(-1)?.role === "user") {
      this.finishWithNotice(
        id,
        messages,
        "This turn was interrupted. Completed tool results remain saved. " +
          "The earlier request is no longer active: do not carry out its remaining actions " +
          "unless the user explicitly requests them again. Review the saved results before retrying.",
      );
    }
    return messages;
  }

  getHistory(id: string) {
    const history = this.recoverChatHistory(id);
    const messages: Record<string, unknown>[] = [];
    const calls = new Map<string, string>();
    for (const message of history) {
      if (typeof message.content === "string") {
        messages.push({ role: message.role, content: message.content, images: [] });
        continue;
      }
      const content = message.content ?? [];
      const text = content.filter((block): block is Anthropic.Beta.BetaTextBlockParam =>
        block.type === "text"
      )
        .map((block) => block.text).join("\n");
      const images = content.filter((block): block is Anthropic.Beta.BetaImageBlockParam =>
        block.type === "image"
      )
        .flatMap((block) =>
          block.source.type === "base64"
            ? [{
              mimeType: block.source.media_type,
              base64Data: `data:${block.source.media_type};base64,${block.source.data}`,
            }]
            : []
        );
      if (text || images.length) messages.push({ role: message.role, content: text, images });
      for (const block of content) {
        if (block.type === "tool_use") calls.set(block.id, block.name);
        if (block.type === "tool_result") {
          messages.push({
            role: "tool-result",
            name: calls.get(block.tool_use_id) ?? block.tool_use_id,
            status: block.content === unexecutedResult
              ? (this.activeChats.has(id) ? "pending" : "not-executed")
              : block.is_error
              ? "failed"
              : "completed",
            content: typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content),
          });
        }
      }
    }
    return { messages, active: this.activeChats.has(id) };
  }

  private saveChatHistory(chatId: string, messages: ChatMessage[]): void {
    const json = JSON.stringify(messages);
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO chats (id, messages, created_at, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET messages = excluded.messages, updated_at = excluded.updated_at
    `).run(chatId, json, now, now);
  }

  private getCurrentContext(): string {
    const now = new Date();
    const date = getDateAtTimeZone(now, "Europe/Helsinki");
    const { config, log } = readAgentDocuments(this.db);
    const today = log.entries.filter((entry): entry is FoodLogEntry =>
      entry.kind === "food" && getDateAtTimeZone(entry.ts, "Europe/Helsinki") === date
    );
    const latestWeight =
      log.entries.filter((entry) =>
        entry.kind === "weight" && new Date(entry.ts).getTime() <= now.getTime()
      ).sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0];
    return JSON.stringify({
      date,
      time: getTimeAtTimeZone(now, "Europe/Helsinki"),
      timeZone: "Europe/Helsinki",
      timeZoneOffsetMinutes: Math.round(getTimeZoneOffsetInMinutes("Europe/Helsinki", now)),
      weekday: getWeekdayAtTimeZone(now, "Europe/Helsinki"),
      profile: config.userInfo,
      goals: {
        dailyKcal: config.targetDailyIntakeCalories,
        dailyProtein: config.targetDailyIntakeProtein,
        targetWeightKg: config.targetWeightValue,
        targetWeightDate: config.targetWeightDate,
      },
      memories: config.memoryEntries,
      today: {
        entries: today.length,
        kcal: today.reduce((sum, entry) => sum + (entry.kcal ?? 0), 0),
        protein: today.reduce(
          (sum, entry) => sum + (entry.protein ?? 0),
          0,
        ),
        entriesWithMissingNutrition: today.filter((entry) =>
          entry.kcal === undefined || entry.protein === undefined
        ).length,
      },
      latestWeight: latestWeight ?? null,
    });
  }

  private refreshCacheBreakpoints(messages: ChatMessage[]) {
    for (const message of messages) {
      if (message.role !== "user" || !Array.isArray(message.content)) continue;
      for (const block of message.content) {
        if (block.type === "text" || block.type === "tool_result" || block.type === "image") {
          delete block.cache_control;
        }
      }
    }
    const last = messages.at(-1);
    if (last?.role === "user" && Array.isArray(last.content)) {
      const block = last.content.at(-1);
      if (
        block && (block.type === "text" || block.type === "tool_result" || block.type === "image")
      ) {
        block.cache_control = { type: "ephemeral" };
      }
    }
  }
}

export { Agent, type AgentEvent };
