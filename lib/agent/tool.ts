import Anthropic from "@anthropic-ai/sdk";
import z from "zod";

type JsonValue = string | number | boolean | null | undefined | JsonValue[] | {
  [key: string]: JsonValue;
};

type AgentTool =
  | { mutates: true; definition: Anthropic.Tool; execute: (input: unknown) => string }
  | { mutates: false; definition: Anthropic.Tool; execute: (input: unknown) => Promise<string> };

function defineMutationTool<T extends z.ZodType>(
  name: string,
  description: string,
  schema: T,
  execute: (input: z.output<T>) => Exclude<JsonValue, undefined>,
): Extract<AgentTool, { mutates: true }> {
  return {
    mutates: true,
    definition: {
      name,
      description,
      input_schema: z.toJSONSchema(schema, { io: "input" }) as Anthropic.Tool.InputSchema,
    },
    execute: (input) => JSON.stringify(execute(schema.parse(input))),
  };
}

function defineReadTool<T extends z.ZodType>(
  name: string,
  description: string,
  schema: T,
  execute: (input: z.output<T>) => Promise<string>,
): Extract<AgentTool, { mutates: false }> {
  return {
    mutates: false,
    definition: {
      name,
      description,
      input_schema: z.toJSONSchema(schema, { io: "input" }) as Anthropic.Tool.InputSchema,
    },
    execute: async (input) => await execute(schema.parse(input)),
  };
}

export { type AgentTool, defineMutationTool, defineReadTool };
