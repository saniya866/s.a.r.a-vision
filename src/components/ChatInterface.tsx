import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  FileText,
  Eye,
  EyeOff,
  Mic,
  MicOff,
  Volume2,
  Map as MapIcon,
  BookOpen,
  Tag,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { filename: string; type: string }[];
};

type Document = {
  id: string;
  filename: string;
  file_type: string;
  storage_path: string;
  extracted_text?: string | null;
};

interface ChatInterfaceProps {
  documents: Document[];
}

const cleanLatex = (text: string): string => {
  return text
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => inner.trim())
    .replace(/\$(.*?)\$/g, (_, inner) => inner.trim())
    .replace(/\\\((.+?)\\\)/g, (_, inner) => inner.trim())
    .replace(/\\\[(.+?)\\\]/g, (_, inner) => inner.trim())
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1) / ($2)')
    .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\(times|cdot)/g, '×')
    .replace(/\\pm/g, '±')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\infty/g, '∞')
    .replace(/\\sum/g, 'sum')
    .replace(/\\int/g, 'integral')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\_/g, '_')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/  +/g, ' ');
};

const speakText = (text: string) => {
  if (!('speechSynthesis' in window)) {
    toast.error("Speech synthesis not supported in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const cleaned = text
    .replace(/[#*`_~>|]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, '. ')
    .trim();
  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
};

const ChatInterface = ({ documents }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // --- Web Speech API ---
  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
      setListening(false);
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error("Voice recognition failed. Try again.");
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  // --- Session stats ---
  const stats = useMemo(() => {
    const docsWithText = documents.filter((d) => d.extracted_text);
    const totalPages = docsWithText.reduce((sum, d) => {
      const text = d.extracted_text || "";
      // rough estimate: ~3000 chars per page
      return sum + Math.max(1, Math.ceil(text.length / 3000));
    }, 0);

    const allText = docsWithText.map((d) => d.extracted_text || "").join(" ");
    // Extract capitalized multi-word terms and single proper nouns
    const termSet = new Set<string>();
    const matches = allText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (matches) {
      matches.forEach((m) => {
        if (m.length > 3 && !["The", "This", "That", "These", "Those", "With", "From", "Your", "Have", "Will", "Been", "Each", "When", "What", "Where", "Which", "About", "Their", "There", "Would", "Could", "Should", "After", "Before", "Into", "Over", "Also", "Just", "Here", "Some", "Other", "More", "Only", "Very", "Much", "Such", "Most", "Than"].includes(m)) {
          termSet.add(m);
        }
      });
    }
    return { totalPages, keyTerms: termSet.size };
  }, [documents]);

  // --- Knowledge Map ---
  const handleGenerateMap = async () => {
    if (documents.length === 0) {
      toast.error("Upload a document first.");
      return;
    }
    const contextTexts = documents
      .filter((d) => d.extracted_text)
      .map((d) => `[${d.filename}]: ${d.extracted_text}`);

    if (contextTexts.length === 0) {
      toast.error("Documents still processing. Wait a moment.");
      return;
    }

    const mapPrompt = `Analyze the uploaded documents and create a structured Knowledge Map using bullet points. Organize it into these sections:

**Key Entities** — Company names, people, roles, dates, locations
**Core Skills Required** — Technical and soft skills mentioned
**Action Items** — Start dates, onboarding steps, deadlines, next steps

Use plain text only. Be thorough but concise.`;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: "📍 Generate Knowledge Map",
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const imageUrls: string[] = [];
      for (const doc of documents) {
        if (doc.file_type === "image") {
          const { data } = supabase.storage.from("documents").getPublicUrl(doc.storage_path);
          imageUrls.push(data.publicUrl);
        }
      }

      const response = await supabase.functions.invoke("rag-chat", {
        body: {
          messages: [],
          userMessage: mapPrompt,
          imageUrls,
          contextTexts,
          documentNames: documents.map((d) => d.filename),
        },
      });

      if (response.error) throw response.error;
      const data = response.data;
      if (data.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.content,
          sources: data.sources,
        },
      ]);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate map");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const imageUrls: string[] = [];
      const contextTexts: string[] = [];

      for (const doc of documents) {
        if (doc.extracted_text) {
          contextTexts.push(`[${doc.filename}]: ${doc.extracted_text}`);
        }
        if (doc.file_type === "image") {
          const { data } = supabase.storage.from("documents").getPublicUrl(doc.storage_path);
          imageUrls.push(data.publicUrl);
        }
      }

      if (documents.length === 0) {
        toast.error("No documents uploaded. Please upload a file first.");
        setLoading(false);
        return;
      }

      const response = await supabase.functions.invoke("rag-chat", {
        body: {
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          userMessage: input,
          imageUrls,
          contextTexts,
          documentNames: documents.map((d) => d.filename),
        },
      });

      if (response.error) throw response.error;
      const data = response.data;
      if (data.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      toast.error(error.message || "Failed to get response");
    } finally {
      setLoading(false);
    }
  };

  const docsWithText = documents.filter((d) => d.extracted_text);

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header */}
      <div className="h-14 flex items-center px-6 border-b border-border/50 glass-panel">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-medium">Multimodal Research Chat</h2>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">
            {documents.length} files loaded
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowContext(!showContext)}
            className="text-xs gap-1"
          >
            {showContext ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showContext ? "Hide" : "Show"} Sources
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      {documents.length > 0 && (
        <div className="px-6 py-2.5 border-b border-border/50 flex items-center gap-5 bg-secondary/30">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">{stats.totalPages}</span>
            <span className="text-xs text-muted-foreground">Pages Read</span>
          </div>
          <div className="w-px h-4 bg-border/50" />
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">{stats.keyTerms}</span>
            <span className="text-xs text-muted-foreground">Key Terms</span>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateMap}
              disabled={loading}
              className="text-xs gap-1.5 h-7 border-primary/30 hover:bg-primary/10 hover:text-primary"
            >
              <Map className="w-3 h-3" />
              Generate Map
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <ScrollArea className="flex-1 p-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 glow-primary">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                AI Research Assistant
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Upload PDFs and images to your knowledge base, then ask me anything.
                I can analyze text, read documents, and interpret visual content.
              </p>
            </div>
          )}

          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[75%] ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"} px-4 py-3`}>
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:text-sm [&>p]:leading-relaxed [&>ul]:text-sm [&>ol]:text-sm">
                    <ReactMarkdown>{cleanLatex(msg.content)}</ReactMarkdown>
                  </div>

                  {/* Read Aloud button for assistant messages */}
                  {msg.role === "assistant" && (
                    <button
                      onClick={() => speakText(msg.content)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                      title="Read aloud"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Read Aloud
                    </button>
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border/30">
                      <div className="flex flex-wrap gap-1.5">
                        {[...new Map(msg.sources.map((s) => [s.filename, s])).values()].map((src, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20"
                          >
                            <FileText className="w-3 h-3" />
                            {src.filename}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-1">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="chat-bubble-assistant px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing...
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Extracted text debug panel */}
        {showContext && (
          <div className="w-80 border-l border-border/50 flex flex-col bg-secondary/20">
            <div className="p-3 border-b border-border/50">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Extracted Text (Debug)
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Raw text the AI sees from your files
              </p>
            </div>
            <ScrollArea className="flex-1 p-3">
              {docsWithText.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No extracted text yet. Upload an image to see OCR results.
                </p>
              ) : (
                <div className="space-y-3">
                  {docsWithText.map((doc) => (
                    <div key={doc.id} className="rounded-lg bg-secondary/50 p-3">
                      <div className="flex items-center gap-1 mb-2">
                        <FileText className="w-3 h-3 text-primary" />
                        <span className="text-xs font-medium text-foreground">{doc.filename}</span>
                      </div>
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono leading-relaxed max-h-60 overflow-auto">
                        {doc.extracted_text}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="p-4 border-t border-border/50">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Button
            variant={listening ? "default" : "outline"}
            size="icon"
            onClick={toggleVoice}
            className={`rounded-xl shrink-0 ${listening ? "glow-primary animate-pulse" : ""}`}
            title={listening ? "Stop listening" : "Voice input"}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={listening ? "Listening..." : "Ask about your documents or images..."}
            className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="rounded-xl px-4 glow-primary"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
