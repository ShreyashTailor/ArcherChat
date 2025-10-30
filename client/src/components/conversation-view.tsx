import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { decryptMessage } from "@/lib/crypto";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Message, type SafeUser, type DecryptedMessage } from "@shared/schema";
import { MessageBubble } from "@/components/message-bubble";
import { MessageInput } from "@/components/message-input";

interface ConversationViewProps {
  userId: number;
  onViewProfile: (userId: number) => void;
  onBack: () => void;
}

export function ConversationView({ userId, onViewProfile, onBack }: ConversationViewProps) {
  const { user: currentUser, keyPair } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<DecryptedMessage[]>([]);

  useEffect(() => {
    setDecryptedMessages([]);
  }, [userId]);

  const { data: otherUser, isLoading: userLoading } = useQuery<SafeUser>({
    queryKey: ["/api/users", userId],
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", userId],
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      await apiRequest("DELETE", `/api/messages/${messageId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Message deleted" });
    },
  });

  const deleteMessagesMutation = useMutation({
    mutationFn: async (messageIds: number[]) => {
      await apiRequest("POST", "/api/messages/delete-bulk", { messageIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Messages deleted" });
    },
  });

  useEffect(() => {
    if (messages.length > 0 && keyPair && currentUser) {
      const decrypt = async () => {
        const decrypted: DecryptedMessage[] = [];

        for (const message of messages) {
          if (message.deleted) {
            decrypted.push({ ...message, content: "[Message deleted]" });
            continue;
          }

          try {
            const isSender = message.senderId === currentUser.id;
            const encryptedKey = isSender ? message.senderEncryptedKey : message.recipientEncryptedKey;
            const content = await decryptMessage(message.encryptedContent, encryptedKey, message.iv, keyPair.privateKey);
            decrypted.push({ ...message, content });
          } catch (error) {
            decrypted.push({ ...message, content: "[Failed to decrypt]" });
          }
        }

        setDecryptedMessages(decrypted);
      };

      decrypt();
    }
  }, [messages, keyPair, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [decryptedMessages]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const groupMessages = (messages: DecryptedMessage[]) => {
    const groups: DecryptedMessage[][] = [];
    let currentGroup: DecryptedMessage[] = [];

    messages.forEach((message, index) => {
      if (index === 0) {
        currentGroup.push(message);
        return;
      }

      const prevMessage = messages[index - 1];
      const timeDiff = Math.abs(
        new Date(message.timestamp).getTime() - new Date(prevMessage.timestamp).getTime()
      );
      const isSameSender = message.senderId === prevMessage.senderId;
      const withinTwoMinutes = timeDiff < 2 * 60 * 1000;

      if (isSameSender && withinTwoMinutes) {
        currentGroup.push(message);
      } else {
        groups.push([...currentGroup]);
        currentGroup = [message];
      }
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  };

  if (userLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="h-14 px-4 flex items-center gap-3 border-b border-border bg-card">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  const messageGroups = groupMessages(decryptedMessages);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-card">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-back"
            onClick={onBack}
            className="lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <Avatar className="h-10 w-10" data-testid={`avatar-user-${userId}`}>
            <AvatarImage src={otherUser.profilePicture || undefined} />
            <AvatarFallback>{getInitials(otherUser.displayName)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate" data-testid="text-chat-name">
              {otherUser.displayName}
            </h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" />
              End-to-end encrypted
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          data-testid="button-view-profile"
          onClick={() => onViewProfile(userId)}
        >
          <Info className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={i % 2 === 0 ? "flex justify-end" : ""}>
                <Skeleton className="h-12 w-64 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : messageGroups.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Lock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm mt-1">Send your first encrypted message</p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messageGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-1">
                {group.map((message, messageIndex) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.senderId === currentUser?.id}
                    isFirst={messageIndex === 0}
                    isLast={messageIndex === group.length - 1}
                    onDelete={() => deleteMessageMutation.mutate(message.id)}
                    currentUserId={currentUser?.id || 0}
                  />
                ))}
              </div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput recipientId={userId} recipientPublicKey={otherUser.publicKey} />
    </div>
  );
}
