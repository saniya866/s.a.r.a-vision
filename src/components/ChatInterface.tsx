import { useState, useRef, useEffect } from "react";
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

const ChatInterface = ({ documents }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
        if (doc.file_type === "image") {
          const { data } = supabase.storage
            .from("documents")
            .getPublicUrl(doc.storage_path);
          imageUrls.push(data.publicUrl);
        }
        if (doc.extracted_text) {
          contextTexts.push(`[${doc.filename}]: ${doc.extracted_text}`);
        }
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

      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
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
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border/30">
                      <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((src, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md"
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

      <div className="p-4 border-t border-border/50">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask about your documents or images..."
            className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            disabled={loading}
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
