'use client';

import { useState, useEffect } from 'react';
import { ChatBox } from '@/components/ChatBox/ChatBox';
import { useChatState } from '@/components/ChatStateProvider';
import { useHostConfig, dispatchHostConfigChange } from '@/hooks/useHostConfig';
import { HostCard } from '@/components/settings/HostCard';
import { AddHostForm } from '@/components/settings/AddHostForm';
import { HostConfiguration, HostConfigurations } from '@/types/settings';
import { checkHostHealth, getAvailableModels } from '@/lib/openrouter';
import { v4 as uuidv4 } from 'uuid';
import { ChatSidebar } from '@/components/ChatSidebar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const STORAGE_KEY = 'host_configurations';
const SELECTED_HOST_KEY = 'selected_host_id';
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const MODEL_CHECK_INTERVAL = 30000; // 30 seconds

export default function Home() {
  const { messages, handleSendMessage, isGenerating, handleNewChat, handleLoadChat, currentChatId } = useChatState();
  const hostConfig = useHostConfig();
  const [showSettings, setShowSettings] = useState(false);
  const [hosts, setHosts] = useState<HostConfigurations>([]);
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [hostStatus, setHostStatus] = useState<Record<string, boolean>>({});
  const [hostToEdit, setHostToEdit] = useState<HostConfiguration | undefined>(undefined);
  const [showHostDialog, setShowHostDialog] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);

  // Load hosts and selected host
  useEffect(() => {
    const savedHosts = localStorage.getItem(STORAGE_KEY);
    const savedSelectedHostId = localStorage.getItem(SELECTED_HOST_KEY);

    if (savedHosts) {
      const parsedHosts = JSON.parse(savedHosts);
      setHosts(parsedHosts);

      // If there's a saved selected host that still exists, use it
      if (savedSelectedHostId && parsedHosts.some((h: HostConfiguration) => h.id === savedSelectedHostId)) {
        setSelectedHostId(savedSelectedHostId);
      } else if (parsedHosts.length > 0) {
        // Otherwise, select the first host
        setSelectedHostId(parsedHosts[0].id);
        localStorage.setItem(SELECTED_HOST_KEY, parsedHosts[0].id);
      }
    } else {
      // Migration: Check for old format
      const oldBaseUrl = localStorage.getItem('openrouter_base_url');
      const oldApiKey = localStorage.getItem('openrouter_api_key');

      if (oldBaseUrl && oldApiKey) {
        const migratedHost: HostConfiguration = {
          id: uuidv4(),
          name: 'Default Host',
          baseUrl: oldBaseUrl,
          apiKey: oldApiKey,
          modelName: 'Qwen/Qwen2.5-14B-Instruct-AWQ',
        };
        setHosts([migratedHost]);
        setSelectedHostId(migratedHost.id);

        // Save in new format and remove old keys
        localStorage.setItem(STORAGE_KEY, JSON.stringify([migratedHost]));
        localStorage.setItem(SELECTED_HOST_KEY, migratedHost.id);
        localStorage.removeItem('openrouter_base_url');
        localStorage.removeItem('openrouter_api_key');
      }
    }
  }, []);

  // Health check effect
  useEffect(() => {
    const checkAllHosts = async () => {
      const newStatus: Record<string, boolean> = {};
      for (const host of hosts) {
        newStatus[host.id] = await checkHostHealth(host.baseUrl);
      }
      setHostStatus(newStatus);
    };

    // Initial check
    if (hosts.length > 0) {
      checkAllHosts();
    }

    // Set up interval for periodic checks
    const interval = setInterval(checkAllHosts, HEALTH_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [hosts]);

  // Model polling effect
  useEffect(() => {
    const checkCurrentModel = async () => {
      if (!selectedHostId) return;
      const selectedHost = hosts.find(h => h.id === selectedHostId);
      if (!selectedHost) return;

      try {
        const models = await getAvailableModels(selectedHost.baseUrl, selectedHost.apiKey);
        if (models.length > 0) {
          const newModel = models[0].id;
          if (newModel !== selectedHost.modelName) {
            // Update host configuration with new model
            const updatedHost = { ...selectedHost, modelName: newModel };
            handleUpdateHost(updatedHost);
          }
          setCurrentModel(newModel);
        }
      } catch (error) {
        console.error('Error checking current model:', error);
      }
    };

    // Initial check
    if (selectedHostId) {
      checkCurrentModel();
    }

    // Set up interval for periodic checks
    const interval = setInterval(checkCurrentModel, MODEL_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [selectedHostId, hosts]);

  const handleAddHost = (newHost: Omit<HostConfiguration, 'id'>) => {
    const hostWithId: HostConfiguration = {
      ...newHost,
      id: uuidv4(),
    };
    const updatedHosts = [...hosts, hostWithId];
    setHosts(updatedHosts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHosts));

    // If this is the first host, select it
    if (updatedHosts.length === 1) {
      setSelectedHostId(hostWithId.id);
      localStorage.setItem(SELECTED_HOST_KEY, hostWithId.id);
    }

    // Check health of new host
    checkHostHealth(hostWithId.baseUrl).then(status => {
      setHostStatus(prev => ({ ...prev, [hostWithId.id]: status }));
    });

    // Close the dialog
    setShowHostDialog(false);

    // Dispatch the change event
    dispatchHostConfigChange();
  };

  const handleUpdateHost = (updatedHost: HostConfiguration) => {
    const updatedHosts = hosts.map(host =>
      host.id === updatedHost.id ? updatedHost : host
    );
    setHosts(updatedHosts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHosts));
    setHostToEdit(undefined);
    setShowHostDialog(false);

    // Check health of updated host
    checkHostHealth(updatedHost.baseUrl).then(status => {
      setHostStatus(prev => ({ ...prev, [updatedHost.id]: status }));
    });

    /**
    // Refresh the host config if this was the selected host
    if (updatedHost.id === selectedHostId) {
      hostConfig.refresh();
    }
    **/
    // Dispatch the change event
    dispatchHostConfigChange();
  };

  const handleDeleteHost = (id: string) => {
    const updatedHosts = hosts.filter(host => host.id !== id);
    setHosts(updatedHosts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHosts));

    // Remove health status
    setHostStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[id];
      return newStatus;
    });

    // If we're deleting the selected host, select another one if available
    if (id === selectedHostId) {
      const newSelectedId = updatedHosts.length > 0 ? updatedHosts[0].id : null;
      setSelectedHostId(newSelectedId);
      if (newSelectedId) {
        localStorage.setItem(SELECTED_HOST_KEY, newSelectedId);
      } else {
        localStorage.removeItem(SELECTED_HOST_KEY);
      }
    }

    // Dispatch the change event
    dispatchHostConfigChange();
  };

  const handleSelectHost = (id: string) => {
    setSelectedHostId(id);
    localStorage.setItem(SELECTED_HOST_KEY, id);
    // Dispatch the change event
    dispatchHostConfigChange();
  };

  // Add wrapper for handleNewChat
  const handleNewChatWithSettingsClose = () => {
    setShowSettings(false);
    handleNewChat();
  };

  const handleLoadChatWithSettingsClose = (chatId: string) => {
    handleLoadChat(chatId);
    setShowSettings(false);
  };

  const openAddHostDialog = () => {
    setHostToEdit(undefined);
    setShowHostDialog(true);
  };

  const handleEditHost = (host: HostConfiguration) => {
    setHostToEdit(host);
    setShowHostDialog(true);
  };

  return (
    <main className="flex-1 flex">
      <ChatSidebar
        onNewChat={handleNewChatWithSettingsClose}
        currentChatId={currentChatId}
        onSelectChat={handleLoadChatWithSettingsClose}
        onToggleSettings={() => setShowSettings(!showSettings)}
        currentModel={currentModel}
      />

      <div className="flex-1">
        {showSettings ? (
          <div className="container mx-auto py-4 px-6 max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-semibold">API Settings</h1>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {hosts.length} host{hosts.length !== 1 ? 's' : ''} configured
                </span>
                <Button onClick={openAddHostDialog} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Host
                </Button>
              </div>
            </div>

            <AddHostForm
              onAdd={handleAddHost}
              hostToEdit={hostToEdit}
              onUpdate={handleUpdateHost}
              onCancel={() => {
                setHostToEdit(undefined);
                setShowHostDialog(false);
              }}
              open={showHostDialog}
              onOpenChange={(open) => {
                setShowHostDialog(open);
                if (!open) setHostToEdit(undefined);
              }}
            />

            <div>
              {hosts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    No hosts configured yet. Add one to get started.
                  </p>
                </div>
              ) : (
                hosts.map(host => (
                  <HostCard
                    key={host.id}
                    host={host}
                    onDelete={handleDeleteHost}
                    onSelect={handleSelectHost}
                    onEdit={handleEditHost}
                    isSelected={host.id === selectedHostId}
                    isRunning={hostStatus[host.id] ?? null}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <ChatBox
            messages={messages}
            onSendMessage={handleSendMessage}
            isGenerating={isGenerating}
            modelName={hostConfig.modelName || 'AI Assistant'}
            isNewChat={messages.length === 0}
          />
        )}
      </div>
    </main>
  );
}
