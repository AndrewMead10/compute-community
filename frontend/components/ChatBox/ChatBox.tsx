'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Message, ChatBoxProps } from './types';
import { cn } from '@/lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useTheme } from 'next-themes';
import {
    Copy,
    CheckCheck,
    Volume2,
    RefreshCw,
    ThumbsUp,
    ThumbsDown,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { MessageInput } from './MessageInput';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export const ChatBox: React.FC<ChatBoxProps> = ({
    messages,
    onSendMessage,
    onRegenerateMessage,
    onLike,
    onDislike,
    generateAudio,
    isGenerating = false,
    modelName,
    webSearchEnabled = false,
    onToggleWebSearch,
    allowFileUpload = false,
    onFileUpload,
    allowAudioInput = false,
    onAudioInput,
    thinkingTokens = { start: '<think>', end: '</think>' },
    className,
    isNewChat = false,
}) => {
    const [input, setInput] = useState('');
    const [files, setFiles] = useState<File[] | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [hasScrolled, setHasScrolled] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

    // Handle auto-scrolling
    useEffect(() => {
        if (autoScroll && chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, autoScroll]);

    // Handle scroll events
    const handleScroll = () => {
        if (!chatContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
        setAutoScroll(scrollTop + clientHeight >= scrollHeight - 10);
        setHasScrolled(scrollTop > 0);
    };

    // Handle message submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isGenerating) return;

        // Handle file uploads if present
        if (files && files.length > 0 && onFileUpload) {
            files.forEach((file) => onFileUpload(file));
        }

        onSendMessage(input.trim());
        setInput('');
        setFiles(null);
        setAutoScroll(true);
    };

    // Handle copy functionality
    const handleCopy = async (text: string, key: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedStates({ ...copiedStates, [key]: true });
        setTimeout(() => {
            setCopiedStates({ ...copiedStates, [key]: false });
        }, 2000);
    };

    const containerClasses = cn(
        'flex flex-col w-full h-full overflow-hidden',
        className
    );

    const messageContainerClasses = cn(
        'flex-1 overflow-y-auto p-4 space-y-4 h-full',
        isNewChat ? 'flex flex-col justify-end' : ''
    );

    return (
        <div className={containerClasses}>
            <div className="relative flex-1 overflow-hidden">
                <div
                    className={cn(
                        'absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background to-transparent pointer-events-none z-10 transition-opacity duration-200',
                        hasScrolled ? 'opacity-100' : 'opacity-0'
                    )}
                />
                <div
                    ref={chatContainerRef}
                    onScroll={handleScroll}
                    className={messageContainerClasses}
                    style={{ overflowY: 'auto', maxHeight: '100%' }}
                >
                    <div className="max-w-4xl mx-auto">
                        {messages.map((message, index) => (
                            <MessageComponent
                                key={index}
                                message={message}
                                onCopy={handleCopy}
                                copiedStates={copiedStates}
                                onRegenerateMessage={onRegenerateMessage}
                                onLike={onLike}
                                onDislike={onDislike}
                                generateAudio={generateAudio}
                                modelName={modelName}
                                thinkingTokens={thinkingTokens}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="">
                <div className="max-w-4xl mx-auto">
                    <form onSubmit={handleSubmit} className="p-4">
                        <MessageInput
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            isGenerating={isGenerating}
                            allowAttachments={allowFileUpload}
                            files={files}
                            setFiles={setFiles}
                            placeholder="Type a message..."
                            webSearchEnabled={webSearchEnabled}
                            onToggleWebSearch={onToggleWebSearch}
                            allowAudioInput={allowAudioInput}
                            onAudioInput={onAudioInput}
                        />
                    </form>
                </div>
            </div>
        </div>
    );
};

interface MessageComponentProps {
    message: Message;
    onCopy: (text: string, key: string) => void;
    copiedStates: { [key: string]: boolean };
    onRegenerateMessage?: () => void;
    onLike?: () => void;
    onDislike?: () => void;
    generateAudio?: (text: string) => Promise<void>;
    modelName?: string;
    thinkingTokens: { start: string; end: string };
}

const MessageComponent: React.FC<MessageComponentProps> = ({
    message,
    onCopy,
    copiedStates,
    onRegenerateMessage,
    onLike,
    onDislike,
    generateAudio,
    modelName,
    thinkingTokens,
}) => {
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);
    const [mounted, setMounted] = useState(false);
    const messageKey = `${message.role}-${message.content.substring(0, 20)}`;
    const { theme } = useTheme();

    // Set mounted state
    useEffect(() => {
        setMounted(true);
    }, []);

    const renderMarkdown = (content: string) => {
        return (
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const key = `${messageKey}-${children}`;

                        // Don't render syntax highlighting until theme is available
                        if (!mounted) {
                            return <code {...props}>{children}</code>;
                        }

                        return match ? (
                            <div className="relative">
                                <SyntaxHighlighter
                                    language={match?.[1] || 'text'}
                                    PreTag="div"
                                    className="rounded-lg"
                                    style={theme === 'dark' ? vscDarkPlus : prism}
                                    children={String(children).replace(/\n$/, '')}
                                />
                                <button
                                    onClick={() => onCopy(String(children), key)}
                                    className="absolute top-2 right-2 p-1 rounded bg-primary/10 hover:bg-primary/20"
                                    title="Copy code"
                                >
                                    {copiedStates[key] ? (
                                        <CheckCheck className="w-4 h-4" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        ) : (
                            <code className="bg-muted px-1 py-0.5 rounded" {...props}>
                                {children}
                            </code>
                        );
                    },
                    p: ({ children }) => (
                        <p className={message.role === 'assistant' ? 'mb-4' : ''}>{children}</p>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-outside ml-6 space-y-1">{children}</ol>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc list-outside ml-6 space-y-1">{children}</ul>
                    ),
                    li: ({ children }) => (
                        <li className="pl-1 mb-1">{children}</li>
                    ),
                }}
                className="prose dark:prose-invert max-w-none prose-pre:p-0 leading-7"
            >
                {content}
            </ReactMarkdown>
        );
    };

    return (
        <div
            className={cn(
                'py-2.5 px-5 border-b text-md mt-2',
                message.role === 'assistant'
                    ? 'mr-4'
                    : 'bg-primary text-primary-foreground justify-self-end rounded-3xl'
            )}
        >
            {message.thinking && (
                <div className="mb-2">
                    <button
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        {isThinkingExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                        Thinking
                    </button>
                    {isThinkingExpanded && (
                        <div className="mt-2 text-sm text-muted-foreground">
                            {message.thinking
                                .replace(thinkingTokens.start, '')
                                .replace(thinkingTokens.end, '')}
                        </div>
                    )}
                </div>
            )}

            {renderMarkdown(message.content)}

            {message.role === 'assistant' && (
                <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        {onRegenerateMessage && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={onRegenerateMessage}
                                            className="p-1 hover:text-foreground"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Regenerate response</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {onLike && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={onLike}
                                            className="p-1 hover:text-foreground"
                                        >
                                            <ThumbsUp className="w-4 h-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Like response</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {onDislike && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={onDislike}
                                            className="p-1 hover:text-foreground"
                                        >
                                            <ThumbsDown className="w-4 h-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Dislike response</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {generateAudio && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => generateAudio(message.content)}
                                            className="p-1 hover:text-foreground"
                                        >
                                            <Volume2 className="w-4 h-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Generate audio</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => onCopy(message.content, messageKey)}
                                        className="p-1 hover:text-foreground"
                                    >
                                        {copiedStates[messageKey] ? (
                                            <CheckCheck className="w-4 h-4" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{copiedStates[messageKey] ? 'Copied!' : 'Copy message'}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    {modelName && (
                        <span className="text-xs">{modelName}</span>
                    )}
                </div>
            )}
        </div>
    );
}; 