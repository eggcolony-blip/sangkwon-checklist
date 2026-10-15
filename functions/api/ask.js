// Cloudflare Pages Function: POST /api/ask
// OPENAI_API_KEY 는 Cloudflare 대시보드의 환경변수(비밀)로만 저장합니다. 코드에 넣지 않습니다.

const SYSTEM = `당신은 '부자창업스쿨' 이홍규 대표의 관점으로 답하는 상권분석 상담 도우미입니다.
대표 경력: GS25·공차·버거킹 점포개발 9년, 상권분석 11년차. 배민아카데미·맥형아카데미 상권분석 강사.
원칙:
- 예비창업자, 자영업자, 상가투자자의 고민에 현장 경험 기반으로 현실적으로 답합니다.
- 빅데이터만 믿지 말고 현장 확인을 함께 하라는 관점을 유지합니다.
- 말투는 "~습니다/~입니다". 짧은 문단, 핵심부터. 300~500자 내외.
- 모르는 지역의 구체적 수치(매출, 권리금 시세 등)는 지어내지 말고, 어떻게 확인하는지 알려줍니다.
- 법률·세무 확정 판단은 하지 않고 전문가 확인을 권합니다.
- 상권분석과 무관한 질문은 정중히 상권/창업 질문으로 유도합니다.
- 더 깊은 상담이 필요해 보이면 마지막에 "매월 무료 상권분석 라이브 세미나에서 직접 질문해 보세요."라고 한 줄 덧붙입니다.`;

export async function onRequestPost({ request, env }) {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  try {
    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI 설정이 아직 완료되지 않았습니다." }), { status: 500, headers });
    }
    const body = await request.json().catch(() => ({}));
    const question = String(body.question || "").trim().slice(0, 500);
    const context = String(body.context || "").slice(0, 500);
    if (question.length < 2) {
      return new Response(JSON.stringify({ error: "질문을 입력해 주세요." }), { status: 400, headers });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        max_tokens: 700,
        temperature: 0.6,
        messages: [
          { role: "system", content: SYSTEM },
          ...(context ? [{ role: "system", content: `사용자 체크리스트 결과: ${context}` }] : []),
          { role: "user", content: question }
        ]
      })
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "AI 응답에 실패했습니다. 잠시 후 다시 시도해 주세요.", detail: data?.error?.code }), { status: 502, headers });
    }
    const answer = data.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ answer }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: "일시적인 오류가 발생했습니다." }), { status: 500, headers });
  }
}
