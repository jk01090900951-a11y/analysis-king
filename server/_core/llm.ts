import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";

const client = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY });

interface InvokeLLMParams {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  response_format?: {
    type: "json_schema";
    json_schema: { name: string; strict: boolean; schema: Record<string, unknown> };
  };
  model?: string;
}

// 2026: OpenAI → Claude(Anthropic) API로 교체.
// routers.ts는 `response.choices[0].message.content`(OpenAI 응답 모양)를 기대하므로,
// 여기서 Claude 응답을 동일한 모양으로 감싸 반환합니다 — routers.ts는 수정할 필요 없음.
export async function invokeLLM(params: InvokeLLMParams) {
  const systemMsg = params.messages.find((m) => m.role === "system")?.content;
  const chatMessages = params.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // 비용 효율: 분석글 생성처럼 구조화된 텍스트 생성엔 Haiku면 충분함 (필요시 model 파라미터로 override 가능)
  const model = params.model ?? "claude-haiku-4-5-20251001";

  if (params.response_format?.type === "json_schema") {
    const schema = params.response_format.json_schema;
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemMsg,
      messages: chatMessages,
      tools: [
        {
          name: schema.name,
          description: `${schema.name} 결과를 지정된 형식으로 제출합니다.`,
          input_schema: schema.schema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: schema.name },
    });

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const contentStr = toolUse ? JSON.stringify(toolUse.input) : "{}";

    // OpenAI 응답 모양으로 감싸서 반환 (routers.ts 호환)
    return { choices: [{ message: { content: contentStr } }] };
  }

  // response_format 없는 일반 텍스트 생성 호출
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemMsg,
    messages: chatMessages,
  });
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return { choices: [{ message: { content: textBlock?.text ?? "" } }] };
}
