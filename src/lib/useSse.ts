import { useEffect, useRef, useState } from 'react';

const SSE_URL = `${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/events/stream`;

export interface SseEventData {
  type: string;
  [key: string]: any;
}

export function useSse(onEvent: (event: SseEventData) => void) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let active = true;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let timeoutId: NodeJS.Timeout;
    let delay = 1000;

    async function connect() {
      if (!active) return;
      const token = localStorage.getItem('accessToken');
      if (!token) {
        // Retry connection in 3s if no token (user might login soon)
        timeoutId = setTimeout(connect, 3000);
        return;
      }

      try {
        const response = await fetch(SSE_URL, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          // Attempt to refresh token or wait
          console.warn('SSE Unauthorized, retrying shortly...');
          setConnected(false);
          timeoutId = setTimeout(connect, 5000);
          return;
        }

        if (!response.ok) {
          throw new Error(`SSE HTTP error: ${response.status}`);
        }

        setConnected(true);
        delay = 1000; // Reset delay on successful connection
        
        const responseBody = response.body;
        if (!responseBody) throw new Error('No response body');

        reader = responseBody.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        let id: string | null = null;
        let eventName: string | null = null;
        const dataLines: string[] = [];

        while (active) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Keep the last partial line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '') {
              // Empty line signals end of event
              if (dataLines.length > 0) {
                const dataStr = dataLines.join('\n');
                try {
                  const parsedData = JSON.parse(dataStr);
                  // Normalize event structure
                  onEventRef.current({
                    type: eventName || 'message',
                    ...parsedData,
                  });
                } catch (e) {
                  onEventRef.current({
                    type: eventName || 'message',
                    data: dataStr,
                  });
                }
                dataLines.length = 0;
                id = null;
                eventName = null;
              }
            } else if (trimmed.startsWith('id:')) {
              id = trimmed.substring(3).trim();
            } else if (trimmed.startsWith('event:')) {
              eventName = trimmed.substring(6).trim();
            } else if (trimmed.startsWith('data:')) {
              dataLines.push(trimmed.substring(5).trim());
            }
          }
        }
      } catch (err) {
        console.error('SSE Connection error:', err);
        setConnected(false);
        if (active) {
          // Exponential backoff
          timeoutId = setTimeout(connect, delay);
          delay = Math.min(delay * 2, 30000);
        }
      }
    }

    connect();

    return () => {
      active = false;
      if (reader) {
        reader.cancel().catch(() => {});
      }
      clearTimeout(timeoutId);
    };
  }, []);

  return { connected };
}
