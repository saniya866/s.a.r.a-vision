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

    let systemContext = `You are a STRICT RAG (Retrieval-Augmented Generation) Research Assistant.

CRITICAL RULES — FOLLOW WITHOUT EXCEPTION:
1. You MUST answer ONLY using the EXTRACTED DOCUMENT TEXT provided below. This is your SOLE source of truth.
2. If the answer IS found in the documents, answer thoroughly and accurately using ONLY the document content.
3. If the answer is NOT found in the documents, respond with EXACTLY: "I cannot find this information in your uploaded files." — Do NOT guess, do NOT use general knowledge, do NOT hallucinate, do NOT make up any information.
4. NEVER use your training data or general knowledge to answer questions about documents.
5. NEVER invent or fabricate details about certificates, documents, or their contents.
6. Do NOT include "Source:" citations inline — the system will automatically display source chips. Just answer the question.
7. Use markdown formatting for clarity.
8. NEVER use LaTeX, dollar signs ($), or math code blocks for formulas. Always write math in plain readable text. For example write "x^2 + 3x + 1" or "x squared plus 3x plus 1", NOT "$x^2$" or "\\(x^2\\)".
9. When describing formulas or equations from images, write them in plain English so they are easy to read on screen. For example: "The quadratic formula is: x = (-b ± sqrt(b^2 - 4ac)) / (2a)".
`;

    const hasContext = contextTexts && contextTexts.length > 0 && contextTexts.some((t: string) => t.trim().length > 0);
    const hasImages = imageUrls && imageUrls.length > 0;

    if (hasContext) {
      systemContext += `\n\n--- EXTRACTED DOCUMENT TEXT (THIS IS YOUR ONLY SOURCE — USE NOTHING ELSE) ---\n${contextTexts.join("\n\n---\n\n")}\n--- END OF DOCUMENT TEXT ---`;
    } else if (hasImages) {
      systemContext += `\n\nNo extracted text is available. Use your vision capability to read text directly from the provided document images. Answer based ONLY on what you can see in the documents. If the image contains math formulas, describe them in plain readable text — never use LaTeX.`;
    } else {
      systemContext += `\n\nThe uploaded documents are still being processed and no text has been extracted yet. Respond to the user with: "Your documents are still being processed. Please wait a few seconds and try again."`;
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

    // Always include all documents that have extracted text as sources
    const sources = (documentNames || []).map((name: string) => ({
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
