import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type Conversation } from "@shared/schema";
import { ChatList } from "@/components/chat-list";
import { ConversationView } from "@/components/conversation-view";
import { ProfileView } from "@/components/profile-view";
import { UserSearch } from "@/components/user-search";
import { SettingsDialog } from "@/components/settings-dialog";
import { useLocation } from "wouter";

export default function ChatPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [viewingProfile, setViewingProfile] = useState<number | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (selectedUserId) {
        queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedUserId] });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedUserId]);

  const handleLogout = () => {
    logout();
    setLocation("/auth");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </AnimatePresence>

      {/* Left Sidebar - User Profile */}
      <aside className="hidden lg:flex w-20 bg-card border-r border-card-border flex-col items-center py-4 gap-4">
        <Avatar className="h-12 w-12" data-testid="avatar-current-user">
          <AvatarImage src={user?.profilePicture || undefined} />
          <AvatarFallback>{getInitials(user?.displayName || "")}</AvatarFallback>
        </Avatar>

        <div className="flex-1" />

        <SettingsDialog />

        <Button
          variant="ghost"
          size="icon"
          data-testid="button-logout"
          onClick={handleLogout}
          className="hover-elevate"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </aside>

      {/* Mobile Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: showSidebar ? 0 : "-100%" }}
        transition={{ type: "tween", duration: 0.2 }}
        className="fixed lg:hidden inset-y-0 left-0 z-50 w-20 bg-card border-r border-card-border flex flex-col items-center py-4 gap-4"
      >
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-close-sidebar"
          className="lg:hidden absolute top-2 right-2"
          onClick={() => setShowSidebar(false)}
        >
          <X className="h-5 w-5" />
        </Button>

        <Avatar className="h-12 w-12" data-testid="avatar-current-user">
          <AvatarImage src={user?.profilePicture || undefined} />
          <AvatarFallback>{getInitials(user?.displayName || "")}</AvatarFallback>
        </Avatar>

        <div className="flex-1" />

        <SettingsDialog />

        <Button
          variant="ghost"
          size="icon"
          data-testid="button-logout"
          onClick={handleLogout}
          className="hover-elevate"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </motion.aside>

      {/* Middle Panel - Chat List */}
      <div className="w-full lg:w-96 border-r border-border flex flex-col">
        <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-card">
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-toggle-sidebar"
            className="lg:hidden"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Chats</h1>
          <UserSearch onSelectUser={setSelectedUserId} />
        </div>

        <ChatList
          conversations={conversations}
          selectedUserId={selectedUserId}
          onSelectUser={setSelectedUserId}
          isLoading={isLoading}
        />
      </div>

      {/* Right Panel - Conversation */}
      <div className="hidden lg:flex flex-1 flex-col">
        {selectedUserId ? (
          <ConversationView
            userId={selectedUserId}
            onViewProfile={setViewingProfile}
            onBack={() => setSelectedUserId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg">Select a chat to start messaging</p>
              <p className="text-sm mt-2">Your messages are end-to-end encrypted</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Conversation View */}
      <AnimatePresence>
        {selectedUserId && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed inset-0 z-30 bg-background lg:hidden"
          >
            <ConversationView
              userId={selectedUserId}
              onViewProfile={setViewingProfile}
              onBack={() => setSelectedUserId(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile View */}
      <AnimatePresence>
        {viewingProfile && (
          <ProfileView userId={viewingProfile} onClose={() => setViewingProfile(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
