'use client';

import { useEffect, useState } from 'react';
import { Plus, MessageSquare, Trash2, Settings, Sun, Moon } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { chatHistoryDB, ChatHistory } from '@/lib/indexdb';
import { useTheme } from 'next-themes';

interface ChatSidebarProps {
  onNewChat: () => void;
  currentChatId?: string;
  onSelectChat: (chatId: string) => void;
  onToggleSettings: () => void;
  currentModel: string | null;
}

export function ChatSidebar({
  onNewChat,
  currentChatId,
  onSelectChat,
  onToggleSettings,
  currentModel
}: ChatSidebarProps) {
  const [chats, setChats] = useState<ChatHistory[]>([]);
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    loadChats();
  }, [currentChatId]);

  const loadChats = async () => {
    const allChats = await chatHistoryDB.getAllChats();
    setChats(allChats.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ));
  };

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await chatHistoryDB.deleteChat(id);
    if (id === currentChatId) {
      onNewChat();
    } else {
      loadChats();
    }
  };

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b p-2">
        <div className="px-2 py-1 mb-2 text-sm text-muted-foreground truncate">
          Choose your Model: {currentModel || "Qwen/Qwen2.5-14B-Instruct-AWQ"}
        </div>
        <Button
          onClick={onNewChat}
          className="w-full justify-start"
          variant="default"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-[calc(100vh-13rem)]">
          <div className="space-y-1 p-2">
            {chats.map((chat) => (
              <Button
                key={chat.id}
                variant={currentChatId === chat.id ? "secondary" : "ghost"}
                className="w-full justify-start relative group"
                onClick={() => onSelectChat(chat.id)}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                <span className="truncate">{chat.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 opacity-0 group-hover:opacity-100"
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="border-t space-y-2 p-2">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          Toggle theme
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={onToggleSettings}
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
} 