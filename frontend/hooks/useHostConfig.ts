import { useEffect, useState, useCallback } from 'react';
import { HostConfiguration } from '@/types/settings';

const STORAGE_KEY = 'host_configurations';
const SELECTED_HOST_KEY = 'selected_host_id';
const HOST_CONFIG_CHANGE_EVENT = 'hostConfigChange';

// Create a custom event dispatcher
export const dispatchHostConfigChange = () => {
  window.dispatchEvent(new Event(HOST_CONFIG_CHANGE_EVENT));
};

export function useHostConfig() {
  const [selectedHost, setSelectedHost] = useState<HostConfiguration | null>(null);

  const loadSelectedHost = useCallback(() => {
    const savedHosts = localStorage.getItem(STORAGE_KEY);
    const selectedHostId = localStorage.getItem(SELECTED_HOST_KEY);

    if (savedHosts && selectedHostId) {
      const hosts = JSON.parse(savedHosts);
      const host = hosts.find((h: HostConfiguration) => h.id === selectedHostId);
      if (host) {
        setSelectedHost(host);
        return;
      }
    }

    // If no host is selected or the selected host doesn't exist,
    // try to select the first available host
    if (savedHosts) {
      const hosts = JSON.parse(savedHosts);
      if (hosts.length > 0) {
        setSelectedHost(hosts[0]);
        localStorage.setItem(SELECTED_HOST_KEY, hosts[0].id);
      } else {
        setSelectedHost(null);
      }
    }
  }, []);

  useEffect(() => {
    loadSelectedHost();

    // old -Listen for storage changes
    // Listen for both storage changes from other tabs and our custom event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === SELECTED_HOST_KEY) {
        loadSelectedHost();
      }
    };

    const handleConfigChange = () => {
      loadSelectedHost();
    };

    window.addEventListener('storage', handleStorageChange);
    //return () => window.removeEventListener('storage', handleStorageChange);
    window.addEventListener(HOST_CONFIG_CHANGE_EVENT, handleConfigChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(HOST_CONFIG_CHANGE_EVENT, handleConfigChange);
    };
  }, [loadSelectedHost]);

  return {
    selectedHost,
    baseUrl: selectedHost?.baseUrl || 'https://openrouter.ai/api/v1',
    apiKey: selectedHost?.apiKey,
    modelName: selectedHost?.modelName || 'Qwen/Qwen2.5-14B-Instruct-AWQ',
    refresh: loadSelectedHost,
  };
} 