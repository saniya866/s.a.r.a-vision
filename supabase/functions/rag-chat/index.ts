import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { messages, userMessage, imageUrls, contextTexts, documentNames } = await req.json();

    const userContent: any[] = [];

    let systemContext = `You are an AI Research Assistant with a professional, analytical personality.

CRITICAL RULES:
1. ALWAYS check the uploaded document text below FIRST before answering any question.
2. If information IS found in the documents, answer thoroughly like a knowledgeable assistant, citing the source document.
3. If information is NOT found in the documents, respond with: "The answer isn't in the files, but here is what I know..." and then provide your general knowledge on the topic.
4. NEVER hallucinate or invent details about certificates, documents, or their contents.
5. Always mention which source documents your answer draws from when using document content.
6. Use markdown formatting for clarity.
`;

    if (contextTexts && contextTexts.length > 0) {
      systemContext += `\n\n--- EXTRACTED DOCUMENT TEXT ---\n${contextTexts.join("\n\n---\n\n")}\n--- END OF DOCUMENT TEXT ---`;
    } else {
      systemContext += `\n\nNo document text has been extracted yet. If the user asks about document contents, let them know the documents are still being processed or no text was extracted.`;
    }

    userContent.push({ type: "text", text: userMessage });

    if (imageUrls && imageUrls.length > 0) {
      for (const url of imageUrls) {
        userContent.push({
          type: "image_url",
          image_url: { url },
        });
      }
    }

    const conversationMessages = [
      { role: "system", content: systemContext },
      ...(messages || []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: userContent },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: conversationMessages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    const sources = (documentNames || [])
      .filter((name: string) => content.toLowerCase().includes(name.toLowerCase().replace(/\.[^.]+$/, "")))
      .map((name: string) => ({
        filename: name,
        type: name.match(/\.(jpg|jpeg|png)$/i) ? "image" : "pdf",
      }));

    return new Response(JSON.stringify({ content, sources }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rag-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
