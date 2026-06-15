'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { chatbotApi, deviceApi } from '../lib/api';
import { ChatbotMessage } from '../lib/types';
import { MessageSquare, Send, X, Bot, Sparkles, RefreshCw, AlertCircle, Calendar, Utensils, CheckCircle2, XCircle, Loader2, MessageSquarePlus } from 'lucide-react';
import styles from './ChatbotBubble.module.css';

let currentLanguage = 'vi';

export function ChatbotBubble() {
  const { isAuthenticated } = useApp();
  const { language, t } = useLanguage();

  currentLanguage = language;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<(ChatbotMessage & { isHistory?: boolean })[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const model = 'gemma-4-e4b';
  const [errorKey, setErrorKey] = useState('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [toolStates, setToolStates] = useState<Record<string, 'pending' | 'loading' | 'success' | 'error' | 'rejected'>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load chat history or initialize session when opened for the first time
  const loadChatSession = React.useCallback(async (force = false) => {
    setIsLoading(true);
    setErrorKey('');
    try {
      const initRes = await chatbotApi.initChatbot(force);
      if (initRes.ok) {
        setCurrentSessionId(initRes.sessionId);

        // Always load chat history
        const histRes = await chatbotApi.getChatbotHistory();
        let historyMessages: (ChatbotMessage & { isHistory?: boolean })[] = [];
        if (histRes.ok) {
          historyMessages = histRes.history.map((msg) => ({
            ...msg,
            isHistory: true,
          }));
        }

        if (initRes.isNewSession) {
          // It's a new session, append greeting
          const greetingMsg: ChatbotMessage & { isHistory?: boolean } = {
            role: 'assistant',
            content: initRes.greeting || t('chatbot.greeting'),
            createdAt: new Date().toISOString(),
            sessionId: initRes.sessionId,
            isHistory: false,
          };
          setMessages([...historyMessages, greetingMsg]);
        } else {
          setMessages(historyMessages);
          if (historyMessages.length > 0 && historyMessages[historyMessages.length - 1].role === 'user') {
            setErrorKey('chatbot.history_no_response');
          }
        }
        setHasInitialized(true);
      } else {
        setErrorKey('chatbot.connect_failed');
      }
    } catch (err) {
      console.error('Failed to initialize Nomi chatbot', err);
      setErrorKey('chatbot.connect_failed');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen && !hasInitialized && isAuthenticated) {
      const timer = setTimeout(() => {
        loadChatSession();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, hasInitialized, isAuthenticated, loadChatSession]);

  // Reset state during render if auth status changes
  const [prevAuth, setPrevAuth] = useState(isAuthenticated);
  if (isAuthenticated !== prevAuth) {
    setPrevAuth(isAuthenticated);
    if (!isAuthenticated) {
      setIsOpen(false);
      setMessages([]);
      setHasInitialized(false);
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMsgText = inputText.trim();
    const msgId = generateUUID();
    const userMessage: ChatbotMessage = {
      role: 'user',
      content: userMsgText,
      createdAt: new Date().toISOString(),
      sessionId: currentSessionId,
      clientMsgId: msgId,
    };

    // Optimistically add user message to UI
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setErrorKey('');

    try {
      const res = await chatbotApi.sendChatbotMessage([userMessage], model, msgId);
      if (res.ok) {
        const aiMessage = {
          ...res.message,
          sessionId: res.message.sessionId || currentSessionId,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        setErrorKey('chatbot.connect_failed');
      }
    } catch (err) {
      console.error('Failed to send chatbot message', err);
      setErrorKey('chatbot.connect_failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryMessage = async () => {
    if (isLoading) return;

    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return;

    const lastUserMessage = userMessages[userMessages.length - 1];
    const msgId = lastUserMessage.clientMsgId || generateUUID();
    const userMessageWithId = {
      ...lastUserMessage,
      clientMsgId: msgId,
    };

    setIsLoading(true);
    setErrorKey('');

    try {
      const res = await chatbotApi.sendChatbotMessage([userMessageWithId], model, msgId);
      if (res.ok) {
        const aiMessage = {
          ...res.message,
          sessionId: res.message.sessionId || currentSessionId,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        setErrorKey('chatbot.connect_failed');
      }
    } catch (err) {
      console.error('Failed to retry sending chatbot message', err);
      setErrorKey('chatbot.connect_failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptTool = async (toolCallId: string, name: string, argsVal: any) => {
    setToolStates((prev) => ({ ...prev, [toolCallId]: 'loading' }));
    try {
      const args = typeof argsVal === 'string' ? JSON.parse(argsVal) : argsVal;
      if (name === 'proposeFeedNow') {
        const { deviceId, openDurationMs } = args;
        await deviceApi.feedNow(deviceId, openDurationMs);
        setToolStates((prev) => ({ ...prev, [toolCallId]: 'success' }));
      } else if (name === 'proposeSaveSchedule') {
        const { deviceId, entries } = args;
        const formattedEntries = entries.map((e: any) => ({
          time: e.time,
          openDurationMs: Number(e.openDurationMs),
        }));
        await deviceApi.updateProposedSchedule(deviceId, formattedEntries);
        setToolStates((prev) => ({ ...prev, [toolCallId]: 'success' }));
      } else {
        throw new Error(`Unknown tool name: ${name}`);
      }
    } catch (err) {
      console.error('Failed to execute proposed action', err);
      setToolStates((prev) => ({ ...prev, [toolCallId]: 'error' }));
    }
  };

  const handleRejectTool = (toolCallId: string) => {
    setToolStates((prev) => ({ ...prev, [toolCallId]: 'rejected' }));
  };

  const renderToolProposal = (toolCall: any, state: 'pending' | 'loading' | 'success' | 'error' | 'rejected' | 'disabled') => {
    let title = '';
    let details: React.ReactNode = null;
    let deviceId = '';

    try {
      const args = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      deviceId = args.deviceId;

      if (toolCall.function.name === 'proposeFeedNow') {
        const duration = (args.openDurationMs / 1000).toFixed(1);
        title = t('chatbot.proposal.feed_now_title');
        details = (
          <div className={styles.toolDetailItem}>
            <span>{t('chatbot.proposal.device')}: <strong>{deviceId}</strong></span>
            <span>{t('chatbot.proposal.duration')}: <strong>{duration}s</strong></span>
          </div>
        );
      } else if (toolCall.function.name === 'proposeSaveSchedule') {
        title = t('chatbot.proposal.save_schedule_title');
        details = (
          <div className={styles.toolDetailList}>
            <div className={styles.toolDetailItem}>
              <span>{t('chatbot.proposal.device')}: <strong>{deviceId}</strong></span>
            </div>
            <div className={styles.scheduleEntries}>
              {args.entries && args.entries.map((entry: any, idx: number) => (
                <div key={idx} className={styles.scheduleEntryBadge}>
                  <span>🕒 {entry.time}</span>
                  <span>({(entry.openDurationMs / 1000).toFixed(1)}s)</span>
                </div>
              ))}
            </div>
          </div>
        );
      } else {
        return null;
      }
    } catch (e) {
      console.error('Failed to parse tool arguments', e);
      return null;
    }

    return (
      <div key={toolCall.id} className={styles.toolCard}>
        <div className={styles.toolHeader}>
          {toolCall.function.name === 'proposeFeedNow' ? <Utensils size={16} /> : <Calendar size={16} />}
          <span className={styles.toolTitle}>{title}</span>
        </div>
        <div className={styles.toolBody}>
          {details}
        </div>
        <div className={styles.toolFooter}>
          {state === 'pending' && (
            <div className={styles.toolActions}>
              <button
                type="button"
                className={styles.rejectBtn}
                onClick={() => handleRejectTool(toolCall.id)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className={styles.acceptBtn}
                onClick={() => handleAcceptTool(toolCall.id, toolCall.function.name, toolCall.function.arguments)}
              >
                {t('common.confirm')}
              </button>
            </div>
          )}
          {state === 'loading' && (
            <div className={styles.toolStatus}>
              <Loader2 size={16} className={styles.spinning} />
              <span>{t('chatbot.proposal.executing')}</span>
            </div>
          )}
          {state === 'success' && (
            <div className={`${styles.toolStatus} ${styles.statusSuccess}`}>
              <CheckCircle2 size={16} />
              <span>{t('chatbot.proposal.success')}</span>
            </div>
          )}
          {state === 'rejected' && (
            <div className={`${styles.toolStatus} ${styles.statusRejected}`}>
              <XCircle size={16} />
              <span>{t('chatbot.proposal.rejected')}</span>
            </div>
          )}
          {state === 'error' && (
            <div className={styles.toolActionsError}>
              <div className={`${styles.toolStatus} ${styles.statusError}`}>
                <AlertCircle size={16} />
                <span>{t('chatbot.proposal.failed')}</span>
              </div>
              <div className={styles.toolActions}>
                <button
                  type="button"
                  className={styles.rejectBtn}
                  onClick={() => handleRejectTool(toolCall.id)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className={styles.acceptBtn}
                  onClick={() => handleAcceptTool(toolCall.id, toolCall.function.name, toolCall.function.arguments)}
                >
                  {t('common.retry')}
                </button>
              </div>
            </div>
          )}
          {state === 'disabled' && (
            <div className={`${styles.toolStatus} ${styles.statusDisabled}`}>
              <span>{t('chatbot.proposal.expired')}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isAuthenticated) return null;

  return (
    <div className={styles.container}>
      {/* Floating Chat Bubble Button */}
      <button
        className={styles.bubbleButton}
        onClick={() => setIsOpen(!isOpen)}
        title={t('chatbot.title')}
        aria-label={t('chatbot.title')}
      >
        {isOpen ? <X /> : <MessageSquare />}
      </button>

      {/* Chat Popover Window */}
      <div className={`${styles.chatWindow} ${isOpen ? styles.chatWindowOpen : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Bot size={24} className="spinning-slow" style={{ color: 'var(--primary)' }} />
            <div className={styles.headerInfo}>
              <div className={styles.title}>
                {t('chatbot.title')}
                <Sparkles size={12} style={{ color: 'var(--accent)' }} />
              </div>
              <div className={styles.statusWrapper}>
                <span className={styles.statusDot} />
                {t('chatbot.status_online')}
              </div>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.actionBtn}
              onClick={() => {
                if (window.confirm(t('chatbot.confirm_reset'))) {
                  loadChatSession(true);
                }
              }}
              title={t('chatbot.new_topic')}
              disabled={isLoading}
            >
              <MessageSquarePlus size={16} />
            </button>
            <button
              className={styles.actionBtn}
              onClick={() => loadChatSession(false)}
              title={t('chatbot.reset_session')}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? styles.spinning : ''} />
            </button>
            <button
              className={styles.actionBtn}
              onClick={() => setIsOpen(false)}
              title={t('common.cancel')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className={styles.messageList}>
          {messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            // Show session divider when sessionId changes between consecutive messages
            const isNewSessionStart = prevMsg && prevMsg.sessionId && msg.sessionId && prevMsg.sessionId !== msg.sessionId;

            return (
              <React.Fragment key={index}>
                {isNewSessionStart && (
                  <div className={styles.sessionDivider}>
                    <span className={styles.sessionDividerText}>
                      <Bot size={12} /> {t('chatbot.new_session_divider')}
                    </span>
                  </div>
                )}
                <div
                  className={`${styles.messageWrapper} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant
                    }`}
                >
                  {msg.content && msg.content.trim() !== '' && (
                    <div
                      className={`${styles.messageBubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant
                        }`}
                    >
                      {renderMarkdown(msg.content)}
                    </div>
                  )}

                  {/* Render Tool Proposals if present */}
                  {msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.map((toolCall) => {
                    const state = toolStates[toolCall.id] || (msg.isHistory ? 'disabled' : 'pending');
                    return renderToolProposal(toolCall, state);
                  })}

                  <div
                    className={`${styles.meta} ${msg.role === 'user' ? styles.metaUser : styles.metaAssistant
                      }`}
                  >
                    {msg.createdAt && (
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    {msg.role === 'assistant' && msg.model && (
                      <span>• Nomi</span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <div className={styles.typingBubble}>
              <div className={styles.typingDot} />
              <div className={styles.typingDot} />
              <div className={styles.typingDot} />
            </div>
          )}

          {/* Error Message */}
          {errorKey && (
            <div className={`${styles.errorWrapper} animate-fade-in`}>
              <div className={styles.errorBubble}>
                <AlertCircle size={16} />
                <span>{t(errorKey)}</span>
              </div>
              <button
                type="button"
                className={styles.retryButton}
                onClick={handleRetryMessage}
                disabled={isLoading}
              >
                <RefreshCw size={12} className={isLoading ? styles.spinning : ''} />
                <span>{t('common.retry')}</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <form className={styles.inputArea} onSubmit={handleSendMessage}>
          <input
            type="text"
            className={styles.input}
            placeholder={t('chatbot.placeholder')}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isLoading || !inputText.trim()}
          >
            <Send size={16} />
          </button>
        </form>

        {/* Disclaimer */}
        <div className={styles.disclaimer}>
          {t('chatbot.disclaimer')}
        </div>
      </div>
    </div>
  );
}

function tokenizeFormula(formula: string): string[] {
  let cleaned = formula.trim();
  // Remove outer math delimiters if present
  if (cleaned.startsWith('$') && cleaned.endsWith('$')) {
    cleaned = cleaned.slice(1, -1).trim();
  } else if (cleaned.startsWith('\\(') && cleaned.endsWith('\\)')) {
    cleaned = cleaned.slice(2, -2).trim();
  }
  
  // Clean markdown bold, italic, code formatting
  cleaned = cleaned.replace(/[\*\_\`]/g, ' ');
  
  // Replace standard LaTeX formatting commands with space
  cleaned = cleaned.replace(/\\(frac|sqrt|text|limits|mathbf|mathit|mathrm)/g, ' ');
  
  // Replace mathematical delimiters and operators with space
  cleaned = cleaned.replace(/[\\\{\}\_\^\=\+\-\*\/\(\)\[\]\,\;\:]/g, ' ');
  
  // Split by whitespace, convert to lowercase, and keep only non-empty words
  return cleaned.split(/\s+/)
                .map(w => w.toLowerCase())
                .filter(w => w.length > 0);
}

function extractFormulas(text: string): string[] {
  const formulas: string[] = [];
  
  // Match block formulas: $$...$$ or \[...\]
  const blockFormulaRegex = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g;
  let blockMatch;
  while ((blockMatch = blockFormulaRegex.exec(text)) !== null) {
    formulas.push(blockMatch[1] || blockMatch[2]);
  }
  
  // Match inline formulas: $...$ or \(...\)
  const inlineFormulaRegex = /(?<!\$)\$([^\$]+)\$(?!\$)|\\\((.*?)\\\)/g;
  let inlineMatch;
  while ((inlineMatch = inlineFormulaRegex.exec(text)) !== null) {
    formulas.push(inlineMatch[1] || inlineMatch[2]);
  }
  
  return formulas;
}

function getFormulaTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  const formulas = extractFormulas(text);
  formulas.forEach(formula => {
    tokenizeFormula(formula).forEach(t => tokens.add(t));
  });
  return tokens;
}

function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const variables = getFormulaTokens(text);
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let inUl = false;
  let ulItems: React.ReactNode[] = [];

  let inOl = false;
  let olItems: React.ReactNode[] = [];

  let inBlockquote = false;
  let quoteLines: React.ReactNode[] = [];

  let inFormulaType: '$$' | '\\[' | null = null;
  let formulaLines: string[] = [];

  let inCode = false;
  let codeLines: string[] = [];

  const closeUl = (key: number) => {
    if (inUl) {
      elements.push(
        <ul key={`ul-${key}`} style={{ paddingLeft: '20px', margin: '8px 0', listStyleType: 'disc' }}>
          {ulItems}
        </ul>
      );
      inUl = false;
      ulItems = [];
    }
  };

  const closeOl = (key: number) => {
    if (inOl) {
      elements.push(
        <ol key={`ol-${key}`} style={{ paddingLeft: '20px', margin: '8px 0', listStyleType: 'decimal' }}>
          {olItems}
        </ol>
      );
      inOl = false;
      olItems = [];
    }
  };

  const closeQuote = (key: number) => {
    if (inBlockquote) {
      elements.push(
        <blockquote key={`quote-${key}`} style={{
          borderLeft: '3px solid var(--accent)',
          background: 'hsla(0, 0%, 100%, 0.03)',
          padding: '8px 12px',
          margin: '10px 0',
          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
          fontStyle: 'italic',
          color: 'var(--text-secondary)'
        }}>
          {quoteLines}
        </blockquote>
      );
      inBlockquote = false;
      quoteLines = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // 1. Handle Code Block
    if (inCode) {
      if (trimmed.startsWith('```')) {
        elements.push(
          <pre key={`code-${index}`} style={{
            background: 'hsla(0, 0%, 0%, 0.25)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            margin: '10px 0',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            color: 'var(--text-secondary)'
          }}>
            {codeLines.join('\n')}
          </pre>
        );
        inCode = false;
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      return;
    }

    if (trimmed.startsWith('```')) {
      closeUl(index);
      closeOl(index);
      closeQuote(index);
      inCode = true;
      return;
    }

    // 2. Handle Formula Block
    if (inFormulaType) {
      const isEnd = (inFormulaType === '$$' && trimmed.endsWith('$$')) ||
                    (inFormulaType === '\\[' && trimmed.endsWith('\\]'));
      if (isEnd) {
        const lastLinePart = trimmed.substring(0, trimmed.length - 2);
        if (lastLinePart) {
          formulaLines.push(lastLinePart);
        }
        const formula = formulaLines.join('\n');
        elements.push(
          <div key={`formula-${index}`} style={{
            margin: '12px 0',
            padding: '12px 16px',
            background: 'hsla(var(--hue-accent), 95%, 55%, 0.04)',
            border: '1px solid hsla(var(--hue-accent), 95%, 55%, 0.25)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.95rem',
            fontWeight: 500,
            color: 'var(--accent)',
            whiteSpace: 'nowrap',
            overflowX: 'auto',
          }}>
            {cleanLatex(formula)}
          </div>
        );
        inFormulaType = null;
        formulaLines = [];
      } else {
        formulaLines.push(line);
      }
      return;
    }

    if (trimmed.startsWith('$$') || trimmed.startsWith('\\[')) {
      closeUl(index);
      closeOl(index);
      closeQuote(index);
      const currentType = trimmed.startsWith('$$') ? '$$' : '\\[';
      const isEnd = (currentType === '$$' && trimmed.endsWith('$$') && trimmed.length > 4) ||
                    (currentType === '\\[' && trimmed.endsWith('\\]') && trimmed.length > 4);
      if (isEnd) {
        const formula = trimmed.substring(2, trimmed.length - 2);
        elements.push(
          <div key={`formula-${index}`} style={{
            margin: '12px 0',
            padding: '12px 16px',
            background: 'hsla(var(--hue-accent), 95%, 55%, 0.04)',
            border: '1px solid hsla(var(--hue-accent), 95%, 55%, 0.25)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.95rem',
            fontWeight: 500,
            color: 'var(--accent)',
            whiteSpace: 'nowrap',
            overflowX: 'auto',
          }}>
            {cleanLatex(formula)}
          </div>
        );
      } else {
        inFormulaType = currentType;
        const firstLinePart = trimmed.substring(2);
        if (firstLinePart) {
          formulaLines.push(firstLinePart);
        }
      }
      return;
    }

    // 2.5. Handle horizontal rule / divider
    const isDivider = /^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed);
    if (isDivider) {
      closeUl(index);
      closeOl(index);
      closeQuote(index);
      elements.push(
        <hr key={index} className={styles.divider} />
      );
      return;
    }

    // 3. Handle blockquote
    const isQuote = trimmed.startsWith('>');
    if (isQuote) {
      closeUl(index);
      closeOl(index);
      if (!inBlockquote) {
        inBlockquote = true;
        quoteLines = [];
      }
      const quoteContent = trimmed.substring(1).trim();
      quoteLines.push(
        <p key={index} style={{ margin: '4px 0' }}>
          {parseInlineStyles(quoteContent, variables)}
        </p>
      );
      return;
    } else {
      closeQuote(index);
    }

    // 4. Handle lists and headings
    const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');
    const isNumList = /^\d+\.\s/.test(trimmed);

    if (isBullet) {
      closeOl(index);
      if (!inUl) {
        inUl = true;
        ulItems = [];
      }
      const itemContent = trimmed.substring(2);
      ulItems.push(
        <li key={index} style={{ marginBottom: '4px' }}>
          {parseInlineStyles(itemContent, variables)}
        </li>
      );
      return;
    } else {
      closeUl(index);
    }

    if (isNumList) {
      closeUl(index);
      if (!inOl) {
        inOl = true;
        olItems = [];
      }
      const match = trimmed.match(/^(\d+\.)\s(.*)/);
      const itemContent = match ? match[2] : trimmed;
      olItems.push(
        <li key={index} style={{ marginBottom: '4px' }}>
          {parseInlineStyles(itemContent, variables)}
        </li>
      );
      return;
    } else {
      closeOl(index);
    }

    // 5. Handle headings and normal text
    const isH3 = trimmed.startsWith('### ');
    const isH2 = trimmed.startsWith('## ');
    const isH1 = trimmed.startsWith('# ');

    if (isH3) {
      elements.push(
        <h4 key={index} style={{ margin: '14px 0 6px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {parseInlineStyles(trimmed.substring(4), variables)}
        </h4>
      );
    } else if (isH2) {
      elements.push(
        <h3 key={index} style={{ margin: '16px 0 8px 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {parseInlineStyles(trimmed.substring(3), variables)}
        </h3>
      );
    } else if (isH1) {
      elements.push(
        <h2 key={index} style={{ margin: '18px 0 10px 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {parseInlineStyles(trimmed.substring(2), variables)}
        </h2>
      );
    } else if (trimmed !== '') {
      elements.push(
        <p key={index} style={{ margin: '8px 0' }}>
          {parseInlineStyles(line, variables)}
        </p>
      );
    }
  });

  closeUl(lines.length);
  closeOl(lines.length);
  closeQuote(lines.length);

  if (inFormulaType && formulaLines.length > 0) {
    const formula = formulaLines.join('\n');
    elements.push(
      <div key={`formula-final`} style={{
        margin: '12px 0',
        padding: '12px 16px',
        background: 'hsla(var(--hue-accent), 95%, 55%, 0.04)',
        border: '1px solid hsla(var(--hue-accent), 95%, 55%, 0.25)',
        borderRadius: 'var(--radius-sm)',
        textAlign: 'center',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.95rem',
        fontWeight: 500,
        color: 'var(--accent)',
        whiteSpace: 'nowrap',
        overflowX: 'auto',
      }}>
        {cleanLatex(formula)}
      </div>
    );
  }

  if (inCode && codeLines.length > 0) {
    elements.push(
      <pre key={`code-final`} style={{
        background: 'hsla(0, 0%, 0%, 0.25)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        padding: '12px',
        margin: '10px 0',
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        color: 'var(--text-secondary)'
      }}>
        {codeLines.join('\n')}
      </pre>
    );
  }

  return elements;
}

function findMatchingBrace(str: string, startIndex: number): number {
  let level = 1;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '{') {
      level++;
    } else if (str[i] === '}') {
      level--;
      if (level === 0) {
        return i;
      }
    }
  }
  return -1;
}

function cleanMathSymbols(text: string): string {
  let result = text;
  
  // Replace fractions \frac{a}{b} -> a / b using balanced brace matching
  let fracIdx;
  let fracSearchIdx = 0;
  while ((fracIdx = result.indexOf('\\frac{', fracSearchIdx)) !== -1) {
    let startParam1 = fracIdx + 6;
    let endParam1 = findMatchingBrace(result, startParam1);
    if (endParam1 === -1) {
      fracSearchIdx = startParam1;
      continue;
    }
    const param1 = result.substring(startParam1, endParam1);
    
    let startParam2 = endParam1 + 1;
    if (result[startParam2] !== '{') {
      while (startParam2 < result.length && /\s/.test(result[startParam2])) {
        startParam2++;
      }
    }
    if (result[startParam2] !== '{') {
      fracSearchIdx = startParam1;
      continue;
    }
    
    let endParam2 = findMatchingBrace(result, startParam2 + 1);
    if (endParam2 === -1) {
      fracSearchIdx = startParam2 + 1;
      continue;
    }
    const param2 = result.substring(startParam2 + 1, endParam2);
    
    result = result.substring(0, fracIdx) + param1 + ' / ' + param2 + result.substring(endParam2 + 1);
    fracSearchIdx = 0; // Reset search index as string changed
  }

  // Replace \text{...} using balanced brace matching
  let textIdx;
  let textSearchIdx = 0;
  while ((textIdx = result.indexOf('\\text{', textSearchIdx)) !== -1) {
    let start = textIdx + 6;
    let end = findMatchingBrace(result, start);
    if (end === -1) {
      textSearchIdx = start;
      continue;
    }
    const inner = result.substring(start, end);
    result = result.substring(0, textIdx) + inner + result.substring(end + 1);
    textSearchIdx = 0;
  }

  // Replace superscripts ^{...} using balanced brace matching
  let superIdx;
  let superSearchIdx = 0;
  while ((superIdx = result.indexOf('^{', superSearchIdx)) !== -1) {
    let start = superIdx + 2;
    let end = findMatchingBrace(result, start);
    if (end === -1) {
      superSearchIdx = start;
      continue;
    }
    const inner = result.substring(start, end);
    result = result.substring(0, superIdx) + '^' + inner + result.substring(end + 1);
    superSearchIdx = 0;
  }

  // Replace subscripts _{...} using balanced brace matching
  let subIdx;
  let subSearchIdx = 0;
  while ((subIdx = result.indexOf('_{', subSearchIdx)) !== -1) {
    let start = subIdx + 2;
    let end = findMatchingBrace(result, start);
    if (end === -1) {
      subSearchIdx = start;
      continue;
    }
    const inner = result.substring(start, end);
    result = result.substring(0, subIdx) + '_' + inner + result.substring(end + 1);
    subSearchIdx = 0;
  }

  // Replace square roots: \sqrt{x} -> √(x) using balanced brace matching
  let sqrtIdx;
  let sqrtSearchIdx = 0;
  while ((sqrtIdx = result.indexOf('\\sqrt{', sqrtSearchIdx)) !== -1) {
    let start = sqrtIdx + 6;
    let end = findMatchingBrace(result, start);
    if (end === -1) {
      sqrtSearchIdx = start;
      continue;
    }
    const inner = result.substring(start, end);
    result = result.substring(0, sqrtIdx) + '√(' + inner + ')' + result.substring(end + 1);
    sqrtSearchIdx = 0;
  }

  // Remove backslashes for standard math functions
  result = result.replace(/\\(ln|log|exp|sin|cos|tan)(?![a-zA-Z])/g, '$1');

  // Replace spacing commands
  result = result.replace(/\\quad/g, '  ');
  result = result.replace(/\\qquad/g, '    ');
  result = result.replace(/\\([,;:])|\\!/g, (match, p1) => p1 ? ' ' : '');
  
  // Replace dots
  result = result.replace(/\\dots/g, '…');

  // Replace standard symbols
  result = result.replace(/\(ms\)/g, currentLanguage === 'en' ? '(ms)' : '(mili giây)');
  result = result.replace(/\s*\\div\s*/g, ' ÷ ');
  result = result.replace(/\s*\\rightarrow\s*/g, ' → ');
  result = result.replace(/\s*\\to\s*/g, ' → ');
  result = result.replace(/\s*\\times\s*/g, ' × ');
  result = result.replace(/\s*\\approx\s*/g, ' ≈ ');
  result = result.replace(/\s*\\neq\s*/g, ' ≠ ');
  result = result.replace(/\s*\\cdot\s*/g, ' · ');
  result = result.replace(/\s*\\pm\s*/g, ' ± ');
  
  result = result.replace(/\s*\\leq\s*/g, ' ≤ ');
  result = result.replace(/\s*\\le\s*/g, ' ≤ ');
  result = result.replace(/\s*\\geq\s*/g, ' ≥ ');
  result = result.replace(/\s*\\ge\s*/g, ' ≥ ');
  
  result = result.replace(/\\alpha/g, 'α');
  result = result.replace(/\\beta/g, 'β');
  result = result.replace(/\\gamma/g, 'γ');
  result = result.replace(/\\delta/g, 'δ');
  result = result.replace(/\\Delta/g, 'Δ');
  result = result.replace(/\\theta/g, 'θ');
  result = result.replace(/\\pi/g, 'π');
  result = result.replace(/\\sigma/g, 'σ');
  result = result.replace(/\\mu/g, 'μ');

  return result;
}

function parseMathToReact(str: string): React.ReactNode {
  if (!str) return null;

  const targets = [
    { key: '\\frac{', len: 6 },
    { key: '\\text{', len: 6 },
    { key: '\\sqrt{', len: 6 },
    { key: '^{', len: 2 },
    { key: '_{', len: 2 }
  ];

  let firstIndex = -1;
  let selectedTarget: { key: string, len: number } | null = null;

  for (const t of targets) {
    const idx = str.indexOf(t.key);
    if (idx !== -1) {
      if (firstIndex === -1 || idx < firstIndex) {
        firstIndex = idx;
        selectedTarget = t;
      }
    }
  }

  if (firstIndex === -1 || !selectedTarget) {
    return str;
  }

  const before = str.substring(0, firstIndex);
  const start = firstIndex + selectedTarget.len;
  const end = findMatchingBrace(str, start);
  
  if (end === -1) {
    return (
      <>
        {parseMathToReact(before)}
        {str.substring(firstIndex, start)}
        {parseMathToReact(str.substring(start))}
      </>
    );
  }

  const inner = str.substring(start, end);
  const after = str.substring(end + 1);

  if (selectedTarget.key === '\\frac{') {
    let startParam2 = end + 1;
    if (str[startParam2] !== '{') {
      while (startParam2 < str.length && /\s/.test(str[startParam2])) {
        startParam2++;
      }
    }
    if (str[startParam2] !== '{') {
      return (
        <>
          {parseMathToReact(before)}
          <span style={{ color: 'red' }}>\frac{'{'}{inner}{'}'}</span>
          {parseMathToReact(after)}
        </>
      );
    }
    const endParam2 = findMatchingBrace(str, startParam2 + 1);
    if (endParam2 === -1) {
      return (
        <>
          {parseMathToReact(before)}
          <span style={{ color: 'red' }}>\frac{'{'}{inner}{'}'}</span>
          {parseMathToReact(str.substring(startParam2))}
        </>
      );
    }
    const param2 = str.substring(startParam2 + 1, endParam2);
    const afterParam2 = str.substring(endParam2 + 1);

    return (
      <>
        {parseMathToReact(before)}
        <span style={{ 
          display: 'inline-flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          verticalAlign: 'middle', 
          padding: '0 8px', 
          lineHeight: 1.25 
        }}>
          <span style={{ 
            borderBottom: '1.5px solid var(--accent)', 
            paddingBottom: '4px', 
            textAlign: 'center', 
            width: '100%', 
            display: 'block' 
          }}>
            {parseMathToReact(inner)}
          </span>
          <span style={{ 
            paddingTop: '4px', 
            textAlign: 'center', 
            width: '100%', 
            display: 'block' 
          }}>
            {parseMathToReact(param2)}
          </span>
        </span>
        {parseMathToReact(afterParam2)}
      </>
    );
  }

  if (selectedTarget.key === '\\text{') {
    return (
      <>
        {parseMathToReact(before)}
        <span style={{ fontFamily: 'var(--font-sans)', fontStyle: 'normal', fontWeight: 500 }}>
          {parseMathToReact(inner)}
        </span>
        {parseMathToReact(after)}
      </>
    );
  }

  if (selectedTarget.key === '\\sqrt{') {
    return (
      <>
        {parseMathToReact(before)}
        <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
          <span style={{ fontSize: '1.25em', lineHeight: 1, marginRight: '-1px', transform: 'translateY(-1px)' }}>√</span>
          <span style={{ borderTop: '1.5px solid currentColor', paddingTop: '1px', display: 'inline-block' }}>
            {parseMathToReact(inner)}
          </span>
        </span>
        {parseMathToReact(after)}
      </>
    );
  }

  if (selectedTarget.key === '^{') {
    return (
      <>
        {parseMathToReact(before)}
        <sup style={{ fontSize: '0.75em', verticalAlign: 'super', lineHeight: 0, marginLeft: '1px' }}>
          {parseMathToReact(inner)}
        </sup>
        {parseMathToReact(after)}
      </>
    );
  }

  if (selectedTarget.key === '_{') {
    return (
      <>
        {parseMathToReact(before)}
        <sub style={{ fontSize: '0.75em', verticalAlign: 'sub', lineHeight: 0, marginLeft: '1px' }}>
          {parseMathToReact(inner)}
        </sub>
        {parseMathToReact(after)}
      </>
    );
  }

  return str;
}

function cleanLatex(formula: string): React.ReactNode {
  let cleaned = formula;
  
  // Replace spacing commands
  cleaned = cleaned.replace(/\\quad/g, '  ');
  cleaned = cleaned.replace(/\\qquad/g, '    ');
  cleaned = cleaned.replace(/\\([,;:])|\\!/g, (match, p1) => p1 ? ' ' : '');
  
  // Remove backslashes for standard math functions
  cleaned = cleaned.replace(/\\(ln|log|exp|sin|cos|tan)(?![a-zA-Z])/g, '$1');

  // Replace dots
  cleaned = cleaned.replace(/\\dots/g, '…');

  // Replace standard symbols
  cleaned = cleaned.replace(/\(ms\)/g, currentLanguage === 'en' ? '(ms)' : '(mili giây)');
  cleaned = cleaned.replace(/\s*\\div\s*/g, ' ÷ ');
  cleaned = cleaned.replace(/\s*\\rightarrow\s*/g, ' → ');
  cleaned = cleaned.replace(/\s*\\to\s*/g, ' → ');
  cleaned = cleaned.replace(/\s*\\times\s*/g, ' × ');
  cleaned = cleaned.replace(/\s*\\approx\s*/g, ' ≈ ');
  cleaned = cleaned.replace(/\s*\\neq\s*/g, ' ≠ ');
  cleaned = cleaned.replace(/\s*\\cdot\s*/g, ' · ');
  cleaned = cleaned.replace(/\s*\\pm\s*/g, ' ± ');
  
  cleaned = cleaned.replace(/\s*\\leq\s*/g, ' ≤ ');
  cleaned = cleaned.replace(/\s*\\le\s*/g, ' ≤ ');
  cleaned = cleaned.replace(/\s*\\geq\s*/g, ' ≥ ');
  cleaned = cleaned.replace(/\s*\\ge\s*/g, ' ≥ ');
  
  cleaned = cleaned.replace(/\\alpha/g, 'α');
  cleaned = cleaned.replace(/\\beta/g, 'β');
  cleaned = cleaned.replace(/\\gamma/g, 'γ');
  cleaned = cleaned.replace(/\\delta/g, 'δ');
  cleaned = cleaned.replace(/\\Delta/g, 'Δ');
  cleaned = cleaned.replace(/\\theta/g, 'θ');
  cleaned = cleaned.replace(/\\pi/g, 'π');
  cleaned = cleaned.replace(/\\sigma/g, 'σ');
  cleaned = cleaned.replace(/\\mu/g, 'μ');

  return parseMathToReact(cleaned.trim());
}

function cleanInlineMath(text: string): string {
  let result = text;
  result = cleanMathSymbols(result);
  result = result.replace(/\$\$([^\$]+)\$\$/g, '$1');
  result = result.replace(/\$([^\$]+)\$/g, '$1');
  result = result.replace(/\\\((.*?)\\\)/g, '$1');
  result = result.replace(/\\\[(.*?)\\\]/g, '$1');
  result = result.replace(/\s+/g, ' ');
  return result;
}

function parseInlineStyles(text: string, variables?: Set<string>): React.ReactNode[] {
  // Parse mathematical symbol definitions/annotations first
  const annotMatch = text.match(/^\s*([^\:]+?)\s*\:\s*(.*)$/);
  if (annotMatch) {
    const rawKey = annotMatch[1].trim();
    const desc = annotMatch[2].trim();

    // Clean delimiters to check length
    let cleanKeyText = rawKey;
    if (cleanKeyText.startsWith('$') && cleanKeyText.endsWith('$')) {
      cleanKeyText = cleanKeyText.slice(1, -1).trim();
    } else if (cleanKeyText.startsWith('\\(') && cleanKeyText.endsWith('\\)')) {
      cleanKeyText = cleanKeyText.slice(2, -2).trim();
    }

    const words = cleanKeyText.split(/\s+/);
    if (cleanKeyText.length <= 30 && words.length <= 5) {
      // Check if it matches variables from formulas
      let isVariable = false;
      if (variables && variables.size > 0) {
        const keyTokens = tokenizeFormula(rawKey);
        if (keyTokens.length > 0) {
          isVariable = keyTokens.every(t => variables.has(t));
        }
      }

      if (isVariable) {
        // Render key using cleanLatex if it has math delimiters or looks like math
        let renderKey: React.ReactNode;
        if (rawKey.startsWith('$') && rawKey.endsWith('$')) {
          renderKey = cleanLatex(rawKey.slice(1, -1));
        } else if (rawKey.startsWith('\\(') && rawKey.endsWith('\\)')) {
          renderKey = cleanLatex(rawKey.slice(2, -2));
        } else {
          renderKey = cleanLatex(rawKey);
        }

        return [
          <span key="key" style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontStyle: 'normal',
            fontWeight: 600,
            color: 'var(--accent)',
            background: 'hsla(var(--hue-accent), 95%, 55%, 0.08)',
            padding: '2px 8px',
            borderRadius: '6px',
            marginRight: '8px',
            border: '1px solid hsla(var(--hue-accent), 95%, 55%, 0.2)'
          }}>
            {renderKey}
          </span>,
          <span key="colon" style={{ color: 'var(--text-muted)', marginRight: '6px' }}>:</span>,
          ...parseInlineStyles(desc, variables)
        ];
      }
    }
  }

  const parts: React.ReactNode[] = [];
  // Tokenize bold, italic, inline code, and inline math ($...$ or \(...\))
  const tokenRegex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\$[^\$]+\$|\\\(.*?\\\))/g;
  const matches = [...text.matchAll(tokenRegex)];

  if (matches.length === 0) {
    return [cleanInlineMath(text)];
  }

  let lastIndex = 0;
  matches.forEach((match, mIdx) => {
    const matchText = match[0];
    const matchIndex = match.index!;

    if (matchIndex > lastIndex) {
      parts.push(cleanInlineMath(text.substring(lastIndex, matchIndex)));
    }

    if (matchText.startsWith('**') && matchText.endsWith('**')) {
      parts.push(<strong key={mIdx}>{matchText.slice(2, -2)}</strong>);
    } else if (matchText.startsWith('*') && matchText.endsWith('*')) {
      parts.push(<em key={mIdx}>{matchText.slice(1, -1)}</em>);
    } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
      parts.push(
        <code
          key={mIdx}
          style={{
            background: 'hsla(0, 0%, 100%, 0.1)',
            padding: '2px 4px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.85em',
          }}
        >
          {matchText.slice(1, -1)}
        </code>
      );
    } else if ((matchText.startsWith('$') && matchText.endsWith('$')) ||
               (matchText.startsWith('\\(') && matchText.endsWith('\\)'))) {
      const isDollar = matchText.startsWith('$');
      const innerMath = isDollar ? matchText.slice(1, -1) : matchText.slice(2, -2);
      
      let isVariable = false;
      if (variables && variables.size > 0) {
        const keyTokens = tokenizeFormula(matchText);
        if (keyTokens.length > 0) {
          isVariable = keyTokens.every(t => variables.has(t));
        }
      }

      if (isVariable) {
        parts.push(
          <span key={mIdx} style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontStyle: 'normal',
            fontWeight: 600,
            color: 'var(--accent)',
            background: 'hsla(var(--hue-accent), 95%, 55%, 0.08)',
            padding: '2px 8px',
            borderRadius: '6px',
            marginRight: '4px',
            marginLeft: '4px',
            border: '1px solid hsla(var(--hue-accent), 95%, 55%, 0.2)',
            verticalAlign: 'middle'
          }}>
            {cleanLatex(innerMath)}
          </span>
        );
      } else {
        parts.push(<React.Fragment key={mIdx}>{cleanLatex(innerMath)}</React.Fragment>);
      }
    }

    lastIndex = matchIndex + matchText.length;
  });

  if (lastIndex < text.length) {
    parts.push(cleanInlineMath(text.substring(lastIndex)));
  }

  return parts;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
