import OpenAI from "openai";
import { ENV } from "./env";

const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

interface InvokeLLMParams {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  response_format?: {
    type: "json_schema";
    json_schema: { name: string; strict: boolean; schema: Record<string, unknown> };
  };
  model?: string;
}

export async function invokeLLM(params: InvokeLLMParams) {
  const response = await client.chat.completions.create({
    model: params.model ?? "gpt-4o",
    messages: params.messages,
    max_tokens: 8000,
    ...(params.response_format
      ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: params.response_format.json_schema.name,
              strict: params.response_format.json_schema.strict,
              schema: params.response_format.json_schema.schema,
            },
          },
        }
      : {}),
  });
  return response;
}
