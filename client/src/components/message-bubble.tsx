import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCheck, Trash2 } from "lucide-react";
import { type DecryptedMessage } from "@shared/schema";
import { Button } from "@/components/ui/button";
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

interface MessageBubbleProps {
  message: DecryptedMessage;
  isOwn: boolean;
  isFirst: boolean;
  isLast: boolean;
  onDelete: () => void;
  currentUserId: number;
}

export function MessageBubble({ message, isOwn, isFirst, isLast, onDelete }: MessageBubbleProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isDeleted = message.deleted;
  const isImage = message.type === "image" && !isDeleted;

  const handleMessageClick = () => {
    if (!isDeleted && isOwn) {
      setIsSelected(!isSelected);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (messageRef.current && !messageRef.current.contains(event.target as Node)) {
        setIsSelected(false);
      }
    };

    if (isSelected) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isSelected]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isFirst ? "mt-3" : "mt-0.5"}`}
      >
        <div ref={messageRef} className="relative max-w-[75%]">
          <div
            onClick={handleMessageClick}
            data-testid={`message-${message.id}`}
            className={`rounded-2xl px-4 py-2 ${
              isOwn
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-card-border text-card-foreground"
            } ${isDeleted ? "opacity-60 italic" : ""} ${!isDeleted && isOwn ? "cursor-pointer" : ""}`}
          >
            {isImage ? (
              <div className="space-y-2">
                <img
                  src={message.content}
                  alt="Attachment"
                  className="max-h-80 rounded-xl object-cover"
                  data-testid={`image-message-${message.id}`}
                />
                {isLast && (
                  <div className="flex items-center justify-end gap-1 text-xs opacity-70">
                    <span>{formatTime(message.timestamp)}</span>
                    {isOwn && <CheckCheck className="h-3 w-3" />}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                {isLast && (
                  <div className="flex items-center justify-end gap-1 text-xs opacity-70">
                    <span>{formatTime(message.timestamp)}</span>
                    {isOwn && !isDeleted && <CheckCheck className="h-3 w-3" />}
                  </div>
                )}
              </div>
            )}
          </div>

          <AnimatePresence>
            {isSelected && isOwn && !isDeleted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="absolute -top-2 -right-2 z-10"
              >
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  className="h-7 w-7 rounded-full"
                  data-testid={`button-delete-message-${message.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the message for everyone. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsSelected(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setShowDeleteDialog(false);
                setIsSelected(false);
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
