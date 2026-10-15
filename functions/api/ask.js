import { KNOWLEDGE } from "../_knowledge.js";
// Cloudflare Pages Function: POST /api/ask
// OPENAI_API_KEY 는 Cloudflare 대시보드의 환경변수(비밀)로만 저장합니다. 코드에 넣지 않습니다.

const SYSTEM = `당신은 부자창업스쿨 이홍규 대표의 관점으로 답하는 상권분석 상담 도우미입니다.
아래 [대표 판단 기준]이 당신의 지식이자 관점입니다. 답변은 반드시 이 기준에 근거하고, 관련 기준이나 숫자가 있으면 구체적으로 활용하세요.
원칙:
- 결론부터 말하고, "제 기준은 ~입니다"처럼 대표의 기준으로 답합니다.
- 말투는 ~습니다/~입니다. 짧은 문단과 줄바꿈. 350~600자.
- 마지막은 계약 전 스스로 확인할 질문 1~3개로 마무리합니다.
- 질문자의 특정 지역 시세·매출 같은 수치는 지어내지 말고, 확인하는 방법을 알려줍니다.
- 법률·세무 확정 판단은 하지 않고 전문가 확인을 권합니다.
- 상권·창업과 무관한 질문은 정중히 상권 질문으로 유도합니다.
- 한국어로만 답합니다. 영어 단어나 외국어 문장을 섞지 않습니다.
- 맨 끝에 한 줄: "더 구체적인 상황은 매월 무료 상권분석 라이브 세미나에서 직접 물어보세요."

[대표 판단 기준]
${KNOWLEDGE}`;

export async function onRequestPost({ request, env }) {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  try {
    if (!env.OPENAI_API_KEY && !env.AI) {
      return new Response(JSON.stringify({ error: "AI 설정이 아직 완료되지 않았습니다." }), { status: 500, headers });
    }
    const body = await request.json().catch(() => ({}));
    const question = String(body.question || "").trim().slice(0, 500);
    const context = String(body.context || "").slice(0, 500);
    if (question.length < 2) {
      return new Response(JSON.stringify({ error: "질문을 입력해 주세요." }), { status: 400, headers });
    }

    const messages = [
      { role: "system", content: SYSTEM },
      ...(context ? [{ role: "system", content: `사용자 체크리스트 결과: ${context}` }] : []),
      { role: "user", content: question }
    ];

    // 1순위: OpenAI 키가 있으면 OpenAI 사용
    if (env.OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: env.OPENAI_MODEL || "gpt-4o-mini", max_tokens: 700, temperature: 0.6, messages })
      });
      const data = await res.json();
      if (res.ok) {
        return new Response(JSON.stringify({ answer: data.choices?.[0]?.message?.content || "", engine: "openai" }), { headers });
      }
      if (!env.AI) {
        return new Response(JSON.stringify({ error: "AI 응답에 실패했습니다. 잠시 후 다시 시도해 주세요." }), { status: 502, headers });
      }
    }

    // 2순위: Cloudflare Workers AI (무료 한도)
    const models = body.model && String(body.model).startsWith("@cf/") ? [String(body.model)] : [env.CF_MODEL || "@cf/google/gemma-4-26b-a4b-it", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"];
    const errs = [];
    let answer = "", used = "";
    for (const m of models) {
      try {
        const out = await env.AI.run(m, { messages, max_tokens: 900, temperature: 0.5 });
        answer = out?.response || out?.choices?.[0]?.message?.content || "";
        if (typeof answer !== "string") answer = JSON.stringify(answer);
        if (answer) { used = m; break; }
      } catch (e) { errs.push(m + ": " + String(e?.message || e).slice(0, 200)); }
    }
    if (!answer) {
      return new Response(JSON.stringify({ error: "AI가 잠시 바쁩니다. 조금 뒤 다시 시도해 주세요.", errs }), { status: 503, headers });
    }
    return new Response(JSON.stringify({ answer, engine: used }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: "일시적인 오류가 발생했습니다." }), { status: 500, headers });
  }
}
