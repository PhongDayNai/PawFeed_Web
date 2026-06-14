'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { chatbotApi, deviceApi } from '../lib/api';
import { ChatbotMessage } from '../lib/types';
import { MessageSquare, Send, X, Bot, Sparkles, RefreshCw, AlertCircle, Calendar, Utensils, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import styles from './ChatbotBubble.module.css';

export function ChatbotBubble() {
  const { isAuthenticated } = useApp();
  const { t } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<(ChatbotMessage & { isHistory?: boolean })[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const model = 'gemma-4-e4b';
  const [errorMsg, setErrorMsg] = useState('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [toolStates, setToolStates] = useState<Record<string, 'pending' | 'loading' | 'success' | 'error' | 'rejected'>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load chat history or initialize session when opened for the first time
  const loadChatSession = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const initRes = await chatbotApi.initChatbot();
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
            content: initRes.greeting || 'Chào bạn! Tôi là Nomi, trợ lý chăm sóc thú cưng PawFeed. Rất vui được hỗ trợ bạn hôm nay! Bé cưng của bạn thế nào rồi? 🐾',
            createdAt: new Date().toISOString(),
            sessionId: initRes.sessionId,
            isHistory: false,
          };
          setMessages([...historyMessages, greetingMsg]);
        } else {
          setMessages(historyMessages);
        }
        setHasInitialized(true);
      } else {
        setErrorMsg(t('chatbot.connect_failed'));
      }
    } catch (err) {
      console.error('Failed to initialize Nomi chatbot', err);
      setErrorMsg(t('chatbot.connect_failed'));
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
    setErrorMsg('');

    try {
      const res = await chatbotApi.sendChatbotMessage([userMessage], model, msgId);
      if (res.ok) {
        const aiMessage = {
          ...res.message,
          sessionId: res.message.sessionId || currentSessionId,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        setErrorMsg(t('chatbot.connect_failed'));
      }
    } catch (err) {
      console.error('Failed to send chatbot message', err);
      setErrorMsg(t('chatbot.connect_failed'));
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
    setErrorMsg('');

    try {
      const res = await chatbotApi.sendChatbotMessage([userMessageWithId], model, msgId);
      if (res.ok) {
        const aiMessage = {
          ...res.message,
          sessionId: res.message.sessionId || currentSessionId,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        setErrorMsg(t('chatbot.connect_failed'));
      }
    } catch (err) {
      console.error('Failed to retry sending chatbot message', err);
      setErrorMsg(t('chatbot.connect_failed'));
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
              onClick={loadChatSession}
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
          {errorMsg && (
            <div className={`${styles.errorWrapper} animate-fade-in`}>
              <div className={styles.errorBubble}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
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

function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let inUl = false;
  let ulItems: React.ReactNode[] = [];

  let inOl = false;
  let olItems: React.ReactNode[] = [];

  let inBlockquote = false;
  let quoteLines: React.ReactNode[] = [];

  let inFormula = false;
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
    if (inFormula) {
      if (trimmed.endsWith('$$')) {
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
            wordBreak: 'break-word',
            overflowX: 'auto',
          }}>
            {cleanLatex(formula)}
          </div>
        );
        inFormula = false;
        formulaLines = [];
      } else {
        formulaLines.push(line);
      }
      return;
    }

    if (trimmed.startsWith('$$')) {
      closeUl(index);
      closeOl(index);
      closeQuote(index);
      if (trimmed.endsWith('$$') && trimmed.length > 4) {
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
            wordBreak: 'break-word',
            overflowX: 'auto',
          }}>
            {cleanLatex(formula)}
          </div>
        );
      } else {
        inFormula = true;
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
          {parseInlineStyles(quoteContent)}
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
          {parseInlineStyles(itemContent)}
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
          {parseInlineStyles(itemContent)}
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
          {parseInlineStyles(trimmed.substring(4))}
        </h4>
      );
    } else if (isH2) {
      elements.push(
        <h3 key={index} style={{ margin: '16px 0 8px 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {parseInlineStyles(trimmed.substring(3))}
        </h3>
      );
    } else if (isH1) {
      elements.push(
        <h2 key={index} style={{ margin: '18px 0 10px 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {parseInlineStyles(trimmed.substring(2))}
        </h2>
      );
    } else if (trimmed !== '') {
      elements.push(
        <p key={index} style={{ margin: '8px 0' }}>
          {parseInlineStyles(line)}
        </p>
      );
    }
  });

  closeUl(lines.length);
  closeOl(lines.length);
  closeQuote(lines.length);

  if (inFormula && formulaLines.length > 0) {
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
        wordBreak: 'break-word',
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

function cleanLatex(formula: string): string {
  let result = formula;
  result = result.replace(/\(ms\)/g, '(mili giây)');
  result = result.replace(/\\text\{([^\}]+)\}/g, '$1');
  result = result.replace(/\\frac\{([^\}]+)\}\{([^\}]+)\}/g, '$1 / $2');
  result = result.replace(/\\times/g, '×');
  return result;
}

function cleanInlineMath(text: string): string {
  let result = text;
  result = result.replace(/\\text\{([^\}]+)\}/g, '$1');
  result = result.replace(/\\div/g, '÷');
  result = result.replace(/\\rightarrow/g, '→');
  result = result.replace(/\\to/g, '→');
  result = result.replace(/\\times/g, '×');
  result = result.replace(/\\le(?!a)/g, '≤');
  result = result.replace(/\\leq/g, '≤');
  result = result.replace(/\\ge(?!t)/g, '≥');
  result = result.replace(/\\geq/g, '≥');
  result = result.replace(/\$([^\$]+)\$/g, '$1');
  result = result.replace(/\s+/g, ' ');
  return result;
}

function parseInlineStyles(text: string): React.ReactNode[] {
  const cleanedText = cleanInlineMath(text);
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const matches = [...cleanedText.matchAll(regex)];

  if (matches.length === 0) {
    return [cleanedText];
  }

  let lastIndex = 0;
  matches.forEach((match, mIdx) => {
    const matchText = match[0];
    const matchIndex = match.index!;

    if (matchIndex > lastIndex) {
      parts.push(cleanedText.substring(lastIndex, matchIndex));
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
    }

    lastIndex = matchIndex + matchText.length;
  });

  if (lastIndex < cleanedText.length) {
    parts.push(cleanedText.substring(lastIndex));
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
