import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { type Conversation } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatListProps {
  conversations: Conversation[];
  selectedUserId: number | null;
  onSelectUser: (userId: number) => void;
  isLoading: boolean;
}

export function ChatList({
  conversations,
  selectedUserId,
  onSelectUser,
  isLoading,
}: ChatListProps) {
  const { toast } = useToast();
  const [longPressedUserId, setLongPressedUserId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const deleteChatMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/conversations/${userId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Chat deleted",
        description: "Conversation has been removed",
      });
    },
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (listRef.current && !listRef.current.contains(event.target as Node)) {
        setLongPressedUserId(null);
      }
    };

    if (longPressedUserId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
      };
    }
  }, [longPressedUserId]);

  const handleLongPressStart = (userId: number) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressedUserId(userId);
    }, 500); // 500ms long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleChatClick = (userId: number) => {
    if (longPressedUserId === userId) {
      setLongPressedUserId(null);
    } else {
      onSelectUser(userId);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "";
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 border-b border-border flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <p>No conversations yet</p>
          <p className="text-sm mt-1">Start chatting by searching for users</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <motion.div
            key={conversation.userId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`relative ${
              selectedUserId === conversation.userId ? "bg-accent" : ""
            }`}
          >
            <button
              data-testid={`chat-item-${conversation.userId}`}
              onClick={() => handleChatClick(conversation.userId)}
              onMouseDown={() => handleLongPressStart(conversation.userId)}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
              onTouchStart={() => handleLongPressStart(conversation.userId)}
              onTouchEnd={handleLongPressEnd}
              className="w-full p-4 flex items-center gap-3 border-b border-border hover-elevate active-elevate-2 text-left"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={conversation.profilePicture || undefined} />
                <AvatarFallback>{getInitials(conversation.displayName)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold truncate">
                    {conversation.displayName}
                  </h3>
                  {conversation.lastMessageTime && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(conversation.lastMessageTime)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.lastMessage || "No messages yet"}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <Badge
                      variant="default"
                      className="h-5 min-w-5 px-1.5 text-xs rounded-full"
                      data-testid={`unread-count-${conversation.userId}`}
                    >
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  @{conversation.username}
                </p>
              </div>
            </button>

            <AnimatePresence>
              {longPressedUserId === conversation.userId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
                >
                  <Button
                    variant="destructive"
                    size="icon"
                    data-testid={`button-delete-chat-${conversation.userId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserToDelete(conversation.userId);
                      setShowDeleteDialog(true);
                    }}
                    className="h-9 w-9 rounded-full"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all messages with{" "}
              {conversations.find((c) => c.userId === userToDelete)?.displayName}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLongPressedUserId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (userToDelete !== null) {
                  deleteChatMutation.mutate(userToDelete);
                  setLongPressedUserId(null);
                  setUserToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
