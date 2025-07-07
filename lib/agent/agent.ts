import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import { systemPrompt } from "../prompts/system.ts";
import { appendFoodLogEntryTool, executeAppendFoodLogEntryTool } from "./append_food_log_entry.ts";
import {
  appendWeightLogEntryTool,
  executeAppendWeightLogEntryTool,
} from "./append_weight_log_entry.ts";
import {
  addKnownIngredientTool,
  executeAddKnownIngredientTool,
} from "./tool_add_known_ingredient.ts";
import { executeReadDocumentTool, readDocumentTool } from "./tool_read_document.ts";

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
  private client: Anthropic;
  private db: DatabaseSync;

  private largeModel: Anthropic.Model = "claude-sonnet-4-0";
  // private smallModel: Anthropic.Model = "claude-claude-3-5-haiku-latest";

  constructor(apiKey: string, db: DatabaseSync) {
    this.client = new Anthropic({ apiKey });
    this.db = db;
  }

  async *send(_id: string, content: string): AsyncGenerator<AgentEvent> {
    const messages: Anthropic.MessageParam[] = [];
    messages.push({ role: "user", content: content });

    let turnsLeft = 16;

    while (turnsLeft-- > 0) {
      const stream = this.client.messages.stream({
        max_tokens: 8192,
        messages: messages,
        model: this.largeModel,
        system: this.getSystemPrompt(),
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
        return;
      }

      for (const block of toolUseBlocks) {
        yield { type: "tool_use", name: block.name };
      }

      for (const toolUseBlock of toolUseBlocks) {
        const result: Anthropic.Messages.ContentBlockParam = {
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: this.callTool(toolUseBlock.name, toolUseBlock.input),
        };
        messages.push({ role: "user", content: [result] });
      }
    }
  }

  private getSystemPrompt(): string {
    const [date, time] = this.getFormattedDateAndTime(new Date());
    return systemPrompt.replace("{{current_date}}", date).replace("{{current_time}}", time);
  }

  private getFormattedDateAndTime(now: Date): [string, string] {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Helsinki",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getValue = (type: string) => parts.find((p) => p.type === type)?.value || "";
    return [
      `${getValue("year")}-${getValue("month")}-${getValue("day")}`,
      `${getValue("hour")}:${getValue("minute")}`,
    ];
  }

  private getTools(): Anthropic.Tool[] {
    return [
      addKnownIngredientTool(),
      appendFoodLogEntryTool(),
      appendWeightLogEntryTool(),
      readDocumentTool(),
    ];
  }

  private callTool(name: string, input: unknown): string {
    const tools: Record<string, () => string> = {
      [addKnownIngredientTool().name]: () => executeAddKnownIngredientTool(this.db, input),
      [appendFoodLogEntryTool().name]: () => executeAppendFoodLogEntryTool(this.db, input),
      [appendWeightLogEntryTool().name]: () => executeAppendWeightLogEntryTool(this.db, input),
      [readDocumentTool().name]: () => executeReadDocumentTool(this.db, input),
    };
    if (name in tools) {
      return tools[name]();
    }
    throw new Error(`Unknown tool: ${name}`);
  }
}

export { Agent, type AgentEvent };
