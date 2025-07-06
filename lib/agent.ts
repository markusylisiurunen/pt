import Anthropic from "@anthropic-ai/sdk";
import z from "zod";
import { readDocumentContentBySlug, writeDocumentContentBySlug } from "./db.ts";
import { systemPrompt } from "./prompts/system.ts";

class Agent {
  private client: Anthropic;

  private largeModel: Anthropic.Model = "claude-sonnet-4-0";
  private smallModel: Anthropic.Model = "claude-claude-3-5-haiku-latest";

  private readonly trainingProgramSlug = "training-program";
  private readonly foodDiarySlug = "food-diary";

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *send(_id: string, content: string): AsyncGenerator<string> {
    // Initialise the message history (TODO: should load by chat ID)
    const messages: Anthropic.MessageParam[] = [];
    messages.push({ role: "user", content: content });

    // Enter the agentic loop
    let turnsLeft = 16;
    while (turnsLeft-- > 0) {
      // Run the next turn
      const response = await this.client.messages.create({
        model: this.largeModel,
        max_tokens: 16384,
        thinking: { type: "enabled", budget_tokens: 8192 },
        system: this.getSystemPrompt(),
        messages: messages,
        tools: [
          this.readTrainingProgramTool(),
          this.readFoodDiaryLogTool(),
          this.appendFoodDiaryLogTool(),
        ],
      });

      messages.push({ role: "assistant", content: response.content });

      // Yield the text content back to the caller
      for (const block of response.content) {
        if (block.type === "text") {
          yield block.text;
        }
      }

      // Check if Claude wanted to use tools
      const toolUseBlocks = response.content.filter((i) => i.type === "tool_use");

      if (toolUseBlocks.length === 0) {
        return;
      }

      // Execute the tools
      for (const block of toolUseBlocks) {
        yield `Executing tool: ${block.name} with input: ${JSON.stringify(block.input)}`;

        let content: string;

        switch (block.name) {
          case "read_training_program": {
            content = this.execReadTrainingProgramTool(block.input);
            break;
          }
          case "read_food_diary_log": {
            content = this.execReadFoodDiaryLogTool(block.input);
            break;
          }
          case "append_food_diary_log": {
            content = this.execAppendFoodDiaryLogTool(block.input);
            break;
          }
          default:
            throw new Error(`Unknown tool use: ${block.name}`);
        }

        const toolResult: Anthropic.Messages.ContentBlockParam = {
          type: "tool_result",
          tool_use_id: block.id,
          content: content,
        };
        messages.push({ role: "user", content: [toolResult] });
      }
    }
  }

  private getSystemPrompt(): string {
    const now = new Date();
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

    const date = `${getValue("year")}-${getValue("month")}-${getValue("day")}`;
    const time = `${getValue("hour")}:${getValue("minute")}`;

    const prompt = systemPrompt.replace("{{current_date}}", date).replace("{{current_time}}", time);

    return prompt;
  }

  // tool definitions ------------------------------------------------------------------------------

  private readTrainingProgramTool(): Anthropic.Tool {
    return {
      name: "read_training_program",
      description: "Read the user's current training program.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
    };
  }

  private execReadTrainingProgramTool(_: unknown): string {
    return readDocumentContentBySlug(this.trainingProgramSlug);
  }

  private readFoodDiaryLogTool(): Anthropic.Tool {
    return {
      name: "read_food_diary_log",
      description: "Read the user's food diary log entries for a date.",
      input_schema: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "The date to retrieve food diary entries for (must be YYYY-MM-DD).",
          },
        },
        required: ["date"],
      },
    };
  }

  private execReadFoodDiaryLogTool(input: unknown): string {
    const inputSchema = z.object({ date: z.string().min(10).max(10) });
    const parsedInput = inputSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new Error(`Invalid input. Expected date in YYYY-MM-DD format.`);
    }
    const content = readDocumentContentBySlug(this.foodDiarySlug) || "[]";
    const parsedContent = z
      .array(
        z.object({
          date: z.string().min(10).max(10),
          text: z.string().min(1),
          meta: z.object({
            kcal: z.number().min(0),
            protein: z.number().min(0),
          }),
        })
      )
      .safeParse(JSON.parse(content));
    if (!parsedContent.success) {
      throw new Error(`Invalid food diary content.`);
    }
    const entries = parsedContent.data.filter((entry) => entry.date === parsedInput.data.date);
    if (entries.length === 0) {
      return `No food diary entries found for ${parsedInput.data.date}.`;
    }
    const formatNumber = (n: number, maximumFractionDigits: number) =>
      n.toLocaleString("fi-FI", { maximumFractionDigits });
    return entries
      .map((i) => {
        const kcal = formatNumber(i.meta.kcal, 2);
        const protein = formatNumber(i.meta.protein, 2);
        return `- ${i.text} (kcal: ${kcal}, protein: ${protein} g)`;
      })
      .join("\n");
  }

  private appendFoodDiaryLogTool(): Anthropic.Tool {
    return {
      name: "append_food_diary_log",
      description: "Append one or more food diary log entries for a date.",
      input_schema: {
        type: "object",
        properties: {
          entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: {
                  type: "string",
                  description: "The date of the food diary entry (must be YYYY-MM-DD).",
                },
                text: {
                  type: "string",
                  description: "The food diary entry text. Never written in title case.",
                },
                meta: {
                  type: "object",
                  properties: {
                    kcal: {
                      type: "number",
                      minimum: 0,
                      description: "Total estimated calories on a best-effort basis.",
                    },
                    protein: {
                      type: "number",
                      minimum: 0,
                      description: "Total estimated protein on a best-effort basis.",
                    },
                  },
                  required: ["kcal", "protein"],
                },
              },
              required: ["date", "text", "meta"],
            },
          },
        },
        required: ["entries"],
      },
    };
  }

  private execAppendFoodDiaryLogTool(input: unknown): string {
    const inputSchema = z.object({
      entries: z
        .array(
          z.object({
            date: z.string().min(10).max(10),
            text: z.string().min(1),
            meta: z.object({ kcal: z.number().min(0), protein: z.number().min(0) }),
          })
        )
        .min(1),
    });
    const parsedInput = inputSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new Error(`Invalid input. Expected an array of food diary entries.`);
    }
    const content = readDocumentContentBySlug(this.foodDiarySlug) || "[]";
    const parsedContent = z
      .array(
        z.object({
          date: z.string().min(10).max(10),
          text: z.string().min(1),
          meta: z.object({ kcal: z.number().min(0), protein: z.number().min(0) }),
        })
      )
      .safeParse(JSON.parse(content));
    if (!parsedContent.success) {
      throw new Error(`Invalid food diary content.`);
    }
    parsedContent.data.push(...parsedInput.data.entries);
    writeDocumentContentBySlug(this.foodDiarySlug, JSON.stringify(parsedContent.data));
    return `Appended ${parsedInput.data.entries.length} food diary entries.`;
  }
}

export { Agent };
