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
  // 2026 신규: Responses API의 내장 웹검색 도구 사용 여부 (오늘자 뉴스·최신 정보 반영용)
  enableWebSearch?: boolean;
}

// 2026 전면 개편: Chat Completions → Responses API로 전환 (gpt-5.6은 Responses API에서만 웹검색 도구 지원)
// 기존 호출부(routers.ts)는 response.choices[0].message.content 형태를 기대하므로,
// 실제로는 Responses API를 쓰되 반환 형태는 기존과 호환되게 감싸서 돌려줌 (호출부 수정 최소화)
export async function invokeLLM(params: InvokeLLMParams) {
  // Chat Completions 스타일 messages를 Responses API의 input으로 변환
  const input = params.messages.map((m) => ({ role: m.role, content: m.content }));

  const requestBody: Record<string, unknown> = {
    model: params.model ?? "gpt-5.6",
    input,
    max_output_tokens: 8000,
  };

  if (params.enableWebSearch) {
    requestBody.tools = [{ type: "web_search" }];
  }

  if (params.response_format?.type === "json_schema") {
    requestBody.text = {
      format: {
        type: "json_schema",
        name: params.response_format.json_schema.name,
        strict: params.response_format.json_schema.strict,
        schema: params.response_format.json_schema.schema,
      },
    };
  }

  const response: any = await (client as any).responses.create(requestBody);

  // Responses API는 output이 여러 아이템(web_search_call, message 등)의 배열이라, 그 중 실제 텍스트만 추출
  // (output_text가 SDK 헬퍼로 제공되면 그걸 우선 사용, 없으면 output 배열에서 message 타입을 직접 찾음)
  let content: string | undefined = response.output_text;
  if (!content && Array.isArray(response.output)) {
    const messageItem = response.output.find((item: any) => item.type === "message");
    const textPart = messageItem?.content?.find((c: any) => c.type === "output_text" || c.type === "text");
    content = textPart?.text;
  }

  // 기존 호출부(routers.ts)가 response.choices[0].message.content로 접근하므로, 그 형태로 감싸서 반환
  return {
    choices: [{ message: { content } }],
    _raw: response, // 필요시 원본 응답(웹검색 출처 등)에 접근 가능하도록 보존
  };
}

