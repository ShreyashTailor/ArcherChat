import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X, Shield, UserX, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { generateFingerprint } from "@/lib/crypto";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type SafeUser } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProfileViewProps {
  userId: number;
  onClose: () => void;
}

export function ProfileView({ userId, onClose }: ProfileViewProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/users", userId],
  });

  const { data: isBlocked = false } = useQuery<boolean>({
    queryKey: ["/api/blocks", userId],
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (isBlocked) {
        await apiRequest("DELETE", `/api/blocks/${userId}`, undefined);
      } else {
        await apiRequest("POST", "/api/blocks", { blockedId: userId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocks", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: isBlocked ? "User unblocked" : "User blocked",
        description: isBlocked
          ? "You can now receive messages from this user"
          : "You will no longer receive messages from this user",
      });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const copyFingerprint = () => {
    if (user) {
      const fingerprint = generateFingerprint(user.publicKey);
      navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied to clipboard",
        description: "Encryption fingerprint copied",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-card rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5">
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-close-profile"
            onClick={onClose}
            className="absolute top-2 right-2 z-10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Profile Content */}
        <div className="px-6 pb-6">
          <div className="-mt-16 mb-4">
            {isLoading ? (
              <Skeleton className="h-32 w-32 rounded-full mx-auto" />
            ) : (
              <Avatar className="h-32 w-32 mx-auto border-4 border-card" data-testid="avatar-profile">
                <AvatarImage src={user?.profilePicture || undefined} />
                <AvatarFallback className="text-4xl">
                  {getInitials(user?.displayName || "")}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3 mb-6">
              <Skeleton className="h-6 w-32 mx-auto" />
              <Skeleton className="h-4 w-24 mx-auto" />
            </div>
          ) : (
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold" data-testid="text-profile-name">
                {user?.displayName}
              </h2>
              <p className="text-sm text-muted-foreground font-mono mt-1">
                @{user?.username}
              </p>
            </div>
          )}

          {/* Encryption Fingerprint */}
          {user && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4" />
                  <span>Encryption Fingerprint</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="button-copy-fingerprint"
                  onClick={copyFingerprint}
                  className="h-8 w-8"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {generateFingerprint(user.publicKey)}
              </p>
            </div>
          )}

          {/* Actions */}
          {currentUser?.id !== userId && (
            <div className="space-y-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant={isBlocked ? "default" : "destructive"}
                    data-testid="button-block-user"
                    className="w-full h-12"
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    {isBlocked ? "Unblock User" : "Block User"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {isBlocked ? "Unblock user?" : "Block user?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {isBlocked
                        ? `You will be able to receive messages from ${user?.displayName} again.`
                        : `${user?.displayName} will no longer be able to send you messages. You can unblock them later.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => blockMutation.mutate()}
                      className={
                        isBlocked
                          ? ""
                          : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      }
                    >
                      {isBlocked ? "Unblock" : "Block"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              Verify the encryption fingerprint to ensure secure communication
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
