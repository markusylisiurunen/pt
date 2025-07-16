import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import { readDocumentContentBySlug } from "../db/docs.ts";
import { Config } from "../entities/config.ts";
import { systemPrompt } from "../prompts/system.ts";
import {
  getDateAtTimeZone,
  getTimeAtTimeZone,
  getTimeZoneOffsetInMinutes,
  getWeekdayAtTimeZone,
} from "../util/datetime.ts";
import {
  appendFoodLogEntryTool,
  executeAppendFoodLogEntryTool,
} from "./tool_append_food_log_entry.ts";
import {
  appendWeightLogEntryTool,
  executeAppendWeightLogEntryTool,
} from "./tool_append_weight_log_entry.ts";
import { executeExecutePythonTool, executePythonTool } from "./tool_execute_python.ts";
import { executeReadDocumentTool, readDocumentTool } from "./tool_read_document.ts";
import { executeRemoveLogEntryTool, removeLogEntryTool } from "./tool_remove_log_entry.ts";
import { executeSaveMemoryTool, saveMemoryTool } from "./tool_save_memory.ts";
import { executeSearchFineliTool, searchFineliTool } from "./tool_search_fineli.ts";
import {
  executeUpsertKnownIngredientTool,
  upsertKnownIngredientTool,
} from "./tool_upsert_known_ingredient.ts";

type ContentDeltaEvent = {
  type: "content_delta";
  content: string;
};

type ToolUseEvent = {
  type: "tool_use";
  name: string;
};

type AgentEvent = ContentDeltaEvent | ToolUseEvent;

class Agent {
  private id: string;

  private anthropicApiKey: string;
  private geminiApiKey: string;

  private client: Anthropic;
  private db: DatabaseSync;

  private largeModel: Anthropic.Model = "claude-sonnet-4-0";
  private smallModel: Anthropic.Model = "claude-claude-3-5-haiku-latest";

  constructor(anthropicApiKey: string, geminiApiKey: string, db: DatabaseSync) {
    this.id = crypto.randomUUID();
    this.anthropicApiKey = anthropicApiKey;
    this.geminiApiKey = geminiApiKey;
    this.client = new Anthropic({
      apiKey: anthropicApiKey,
      defaultHeaders: {
        "anthropic-beta": "interleaved-thinking-2025-05-14",
      },
    });
    this.db = db;
  }

  async *send(
    id: string,
    content: string,
    images?: { mimeType: "image/jpeg" | "image/png"; base64Data: string }[],
  ): AsyncGenerator<AgentEvent> {
    const messages: Anthropic.MessageParam[] = this.loadChatHistory(id);
    messages.push({
      role: "user",
      content: [
        { type: "text", text: this.getSystemReminder() + "\n\n" },
        { type: "text", text: content },
      ],
    });
    if (images && images.length > 0) {
      for (const image of images) {
        (messages.at(-1)!.content as Anthropic.ContentBlockParam[]).push({
          type: "image",
          source: { type: "base64", media_type: image.mimeType, data: image.base64Data },
        });
      }
    }

    let turnsLeft = 16;

    while (turnsLeft-- > 0) {
      this.refreshCacheBreakpoints(messages);
      const stream = this.client.messages.stream({
        max_tokens: 8192,
        messages: messages,
        metadata: { user_id: this.id },
        model: this.largeModel,
        system: [
          {
            type: "text",
            text: this.getSystemPrompt(),
            cache_control: { type: "ephemeral" },
          },
        ],
        thinking: { type: "enabled", budget_tokens: 4096 },
        tools: this.getTools(),
      });

      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          yield { type: "content_delta", content: chunk.delta.text };
        }
      }

      const message = await stream.finalMessage();
      messages.push({ role: "assistant", content: message.content });

      const toolUseBlocks = message.content.filter((i) => i.type === "tool_use");
      if (toolUseBlocks.length === 0) {
        break;
      }

      for (const block of toolUseBlocks) {
        yield { type: "tool_use", name: block.name };
      }

      for (const toolUseBlock of toolUseBlocks) {
        const result: Anthropic.Messages.ContentBlockParam = {
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: await this.callTool(toolUseBlock.name, toolUseBlock.input),
        };
        messages.push({ role: "user", content: [result] });
      }
    }

    this.saveChatHistory(id, messages);
  }

  private loadChatHistory(chatId: string): Anthropic.MessageParam[] {
    const result = this.db.prepare(`SELECT messages FROM chats WHERE id = ?`).get(chatId);
    if (!result) {
      return [];
    }

    const parsed = result as { messages: string };
    return JSON.parse(parsed.messages);
  }

  private saveChatHistory(chatId: string, messages: Anthropic.MessageParam[]): void {
    const messagesJson = JSON.stringify(messages);
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO chats (id, messages, created_at, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET messages = ?, updated_at = ?
        `,
      )
      .run(chatId, messagesJson, now, now, messagesJson, now);
  }

  private getSystemPrompt(): string {
    const now = new Date().toISOString();
    return systemPrompt
      .replace("{{current_date}}", getDateAtTimeZone(now, "Europe/Helsinki"))
      .replace("{{current_time_zone}}", "Europe/Helsinki")
      .replace("{{current_time_zone_offset}}", "" + getTimeZoneOffsetInMinutes("Europe/Helsinki"))
      .replace("{{current_weekday}}", getWeekdayAtTimeZone(now, "Europe/Helsinki"))
      .replace("{{user_info}}", this.getUserInfo())
      .replace("{{user_memories}}", this.getUserMemories());
  }

  private getSystemReminder(): string {
    const now = new Date();
    return `<system_reminder>
Current time: ${getTimeAtTimeZone(now.toISOString(), "Europe/Helsinki")}
</system_reminder>`;
  }

  private getUserInfo(): string {
    const content = readDocumentContentBySlug(this.db, "config");
    const config = Config.safeParse(JSON.parse(content || "{}"));
    if (config.success && config.data.userInfo) {
      return config.data.userInfo;
    }
    return "No user information is available.";
  }

  private getUserMemories(): string {
    const content = readDocumentContentBySlug(this.db, "config");
    const config = Config.safeParse(JSON.parse(content || "{}"));
    if (config.success && config.data.memoryEntries.length > 0) {
      return config.data.memoryEntries.map((entry) => "- " + entry).join("\n");
    }
    return "No user memories are available.";
  }

  private refreshCacheBreakpoints(messages: Anthropic.MessageParam[]) {
    // reset cache control breakpoints
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role !== "user") continue;
      if (!Array.isArray(messages[i].content)) continue;
      for (let u = 0; u < messages[i].content.length; u++) {
        if ((messages[i].content[u] as Anthropic.ContentBlockParam).type === "text") {
          (messages[i].content[u] as Anthropic.TextBlockParam).cache_control = undefined;
        }
        if ((messages[i].content[u] as Anthropic.ContentBlockParam).type === "tool_result") {
          (messages[i].content[u] as Anthropic.ToolResultBlockParam).cache_control = undefined;
        }
      }
    }

    // set the cache breakpoint for the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "user") continue;
      if (!Array.isArray(messages[i].content)) continue;
      let found = false;
      for (let u = messages[i].content.length - 1; u >= 0; u--) {
        if (found) break;
        if ((messages[i].content[u] as Anthropic.ContentBlockParam).type === "text") {
          found = true;
          (messages[i].content[u] as Anthropic.TextBlockParam).cache_control = {
            type: "ephemeral",
          };
        }
      }
      if (found) break;
    }

    // set the cache breakpoint for the last tool result
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "user") continue;
      if (!Array.isArray(messages[i].content)) continue;
      let found = false;
      for (let u = messages[i].content.length - 1; u >= 0; u--) {
        if (found) break;
        if ((messages[i].content[u] as Anthropic.ContentBlockParam).type === "tool_result") {
          found = true;
          (messages[i].content[u] as Anthropic.ToolResultBlockParam).cache_control = {
            type: "ephemeral",
          };
        }
      }
      if (found) break;
    }
  }

  private getTools(): Anthropic.Tool[] {
    return [
      appendFoodLogEntryTool(),
      appendWeightLogEntryTool(),
      executePythonTool(),
      readDocumentTool(),
      removeLogEntryTool(),
      saveMemoryTool(),
      searchFineliTool(),
      upsertKnownIngredientTool(),
    ];
  }

  private async callTool(name: string, input: unknown): Promise<string> {
    const tools: Record<string, () => string | Promise<string>> = {
      [appendFoodLogEntryTool().name]: () => executeAppendFoodLogEntryTool(this.db, input),
      [appendWeightLogEntryTool().name]: () => executeAppendWeightLogEntryTool(this.db, input),
      [executePythonTool().name]: () => executeExecutePythonTool(input),
      [readDocumentTool().name]: () => executeReadDocumentTool(this.db, input),
      [removeLogEntryTool().name]: () => executeRemoveLogEntryTool(this.db, input),
      [saveMemoryTool().name]: () => executeSaveMemoryTool(this.db, input),
      [searchFineliTool().name]: () => executeSearchFineliTool(this.geminiApiKey, input),
      [upsertKnownIngredientTool().name]: () => executeUpsertKnownIngredientTool(this.db, input),
    };
    if (name in tools) {
      return await tools[name]();
    }
    throw new Error(`Unknown tool: ${name}`);
  }
}

export { Agent, type AgentEvent };
