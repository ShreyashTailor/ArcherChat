import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { encryptMessage } from "@/lib/crypto";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MessageInputProps {
  recipientId: number;
  recipientPublicKey: string;
}

export function MessageInput({ recipientId, recipientPublicKey }: MessageInputProps) {
  const { keyPair } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { text?: string; imageFile?: File }) => {
      if (!keyPair) throw new Error("No encryption keys available");
      
      const currentUser = localStorage.getItem("archer_user");
      if (!currentUser) throw new Error("User not found");
      const senderPublicKey = JSON.parse(currentUser).publicKey;

      let content = data.text || "";
      let type: "text" | "image" = "text";

      if (data.imageFile) {
        const base64 = await fileToBase64(data.imageFile);
        content = base64;
        type = "image";
      }

      const encrypted = await encryptMessage(content, senderPublicKey, recipientPublicKey);

      await apiRequest("POST", "/api/messages", {
        recipientId,
        type,
        ...encrypted,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", recipientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setMessage("");
      setImageFile(null);
      setImagePreview(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Image must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSend = () => {
    if (imageFile) {
      sendMessageMutation.mutate({ imageFile });
    } else if (message.trim()) {
      sendMessageMutation.mutate({ text: message.trim() });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-card p-4">
      {imagePreview && (
        <div className="mb-3 relative inline-block">
          <img
            src={imagePreview}
            alt="Preview"
            className="h-24 rounded-lg object-cover"
            data-testid="image-preview"
          />
          <Button
            variant="destructive"
            size="icon"
            data-testid="button-remove-image"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={() => {
              setImageFile(null);
              setImagePreview(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
          data-testid="input-file"
        />

        <Button
          variant="ghost"
          size="icon"
          data-testid="button-attach"
          onClick={() => fileInputRef.current?.click()}
          disabled={sendMessageMutation.isPending || !!imageFile}
          className="shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </Button>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message..."
          data-testid="input-message"
          disabled={sendMessageMutation.isPending || !!imageFile}
          className="min-h-[44px] max-h-32 resize-none"
          rows={1}
        />

        <Button
          size="icon"
          data-testid="button-send"
          onClick={handleSend}
          disabled={
            sendMessageMutation.isPending || (!message.trim() && !imageFile)
          }
          className="shrink-0"
        >
          {sendMessageMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
