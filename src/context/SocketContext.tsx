import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * MaliMart Realtime layer.
 *
 * Originally built on Socket.IO. Migrated to Supabase Realtime so the app can run on
 * Vercel (serverless) without a long-lived Node process. The public API (`emit`, `on`)
 * is kept similar to the old socket API so existing call sites don't need rewiring.
 *
 * Events are broadcast over a single Supabase channel: `malimart:events`.
 *
 * Channels:
 *   - bargain:propose / bargain:new        (buyer ↔ seller bargaining)
 *   - bargain:update  / bargain:updated    (status changes)
 *   - admin:alert     / admin:new_alert    (operational alerts)
 */

const REALTIME_CHANNEL = 'malimart:events';

type Handler = (data: any) => void;

interface RealtimeContextType {
  /** True once the Supabase realtime channel has subscribed. */
  isConnected: boolean;
  /** Broadcast an event to all connected clients. */
  emit: (event: string, data?: any) => Promise<void> | void;
  /** Subscribe to an event. Returns an unsubscribe function. */
  on: (event: string, handler: Handler) => () => void;
  /** Compatibility shim — exposes a minimal socket-like surface. */
  socket: {
    emit: (event: string, data?: any) => void;
    on: (event: string, handler: Handler) => void;
    off: (event: string, handler?: Handler) => void;
  } | null;
}

const noopContext: RealtimeContextType = {
  isConnected: false,
  emit: () => {},
  on: () => () => {},
  socket: null,
};

const SocketContext = createContext<RealtimeContextType>(noopContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = supabase.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: false, ack: false } },
    });

    // Dispatcher: every broadcast comes through here, we fan out to registered handlers.
    channel.on('broadcast', { event: '*' }, (payload: any) => {
      const eventName: string | undefined = payload?.event;
      if (!eventName) return;
      const set = handlersRef.current.get(eventName);
      if (!set) return;
      set.forEach((h) => {
        try {
          h(payload?.payload);
        } catch (err) {
          console.error(`[Realtime] handler for "${eventName}" threw:`, err);
        }
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setIsConnected(false);
      }
    });

    channelRef.current = channel;

    return () => {
      setIsConnected(false);
      handlersRef.current.clear();
      supabase.removeChannel(channel).catch(() => {});
      channelRef.current = null;
    };
  }, []);

  const value = useMemo<RealtimeContextType>(() => {
    const emit = async (event: string, data: any = {}) => {
      const ch = channelRef.current;
      if (!ch) return;
      try {
        await ch.send({ type: 'broadcast', event, payload: data });
      } catch (err) {
        console.error(`[Realtime] emit "${event}" failed:`, err);
      }
    };

    const on = (event: string, handler: Handler) => {
      if (!handlersRef.current.has(event)) {
        handlersRef.current.set(event, new Set());
      }
      handlersRef.current.get(event)!.add(handler);
      return () => {
        handlersRef.current.get(event)?.delete(handler);
      };
    };

    const socket = {
      emit: (event: string, data: any = {}) => {
        void emit(event, data);
      },
      on: (event: string, handler: Handler) => {
        on(event, handler);
      },
      off: (event: string, handler?: Handler) => {
        if (!handler) {
          handlersRef.current.delete(event);
        } else {
          handlersRef.current.get(event)?.delete(handler);
        }
      },
    };

    return { isConnected, emit, on, socket };
  }, [isConnected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
