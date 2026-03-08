import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { imageUrl, documentId, fileType } = await req.json();
    if (!documentId) throw new Error("documentId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let extractedText = "";

    if (fileType === "pdf") {
      // For PDFs: download the file and send as base64 to Gemini vision
      if (!imageUrl) throw new Error("imageUrl is required for PDF extraction");

      const pdfResponse = await fetch(imageUrl);
      if (!pdfResponse.ok) throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
      const pdfBuffer = await pdfResponse.arrayBuffer();
      const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a document text extraction assistant. Extract ALL text from this PDF document exactly as it appears. Preserve structure, headings, paragraphs, lists, tables, names, dates, addresses, and all other content. Do not summarize or interpret — extract the raw text faithfully and completely.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all text from this PDF document completely and exactly as written:" },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${base64Pdf}`,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("PDF AI error:", response.status, errText);
        throw new Error(`PDF AI error: ${response.status}`);
      }

      const data = await response.json();
      extractedText = data.choices?.[0]?.message?.content || "";
    } else {
      // For images: use vision OCR as before
      if (!imageUrl) throw new Error("imageUrl is required");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are an OCR assistant. Extract ALL visible text from the image exactly as it appears. Preserve the structure, headings, names, dates, certificate titles, issuing organizations, and any other text. Do not summarize or interpret — just extract the raw text faithfully.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all text from this image exactly as written:" },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("OCR AI error:", response.status, errText);
        throw new Error(`OCR AI error: ${response.status}`);
      }

      const data = await response.json();
      extractedText = data.choices?.[0]?.message?.content || "";
    }

    // Update the document record with extracted text
    const { error: updateError } = await supabase
      .from("documents")
      .update({ extracted_text: extractedText, status: "ready" })
      .eq("id", documentId);

    if (updateError) {
      console.error("DB update error:", updateError);
      throw new Error("Failed to save extracted text");
    }

    return new Response(JSON.stringify({ extractedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-extract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
