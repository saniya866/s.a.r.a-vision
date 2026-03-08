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

    // Build content parts for multimodal
    const userContent: any[] = [];

    // Strict retrieval system prompt
    let systemContext = `You are an AI Research Assistant with a professional, analytical personality. You help users understand their documents and images with precision and depth.

CRITICAL RULES:
- ONLY answer based on the text extracted from the uploaded documents provided below.
- If you cannot find specific text in the uploaded documents to answer a question, say "I cannot find that information in the uploaded files." instead of guessing or making up information.
- NEVER hallucinate or invent details about certificates, documents, or their contents.
- Cite specific sources when referencing uploaded documents.
- Use markdown formatting for clarity.
- Always mention which source documents your answer draws from.

`;

    if (contextTexts && contextTexts.length > 0) {
      systemContext += `\n\n--- EXTRACTED DOCUMENT TEXT (use ONLY this to answer) ---\n${contextTexts.join("\n\n---\n\n")}\n--- END OF DOCUMENT TEXT ---`;
    } else {
      systemContext += `\n\nNo document text has been extracted yet. If the user asks about document contents, let them know the documents are still being processed or no text was extracted.`;
    }

    // Build user message with images
    userContent.push({ type: "text", text: userMessage });

    if (imageUrls && imageUrls.length > 0) {
      for (const url of imageUrls) {
        userContent.push({
          type: "image_url",
          image_url: { url },
        });
      }
    }

    // Build conversation history
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

    // Extract sources from document names mentioned in the response
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
