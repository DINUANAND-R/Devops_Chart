import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { chatsAPI, notificationsAPI } from '../services/api';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState({}); // { chatId: [msgs] }
  const [typingUsers, setTypingUsers] = useState({}); // { chatId: {userId: name} }
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loadingChats, setLoadingChats] = useState(false);
  const typingTimers = useRef({});

  // ─── Chats ──────────────────────────────────────────────────────────────
  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const { data } = await chatsAPI.getAll();
      setChats(data.chats);
      // Fetch unread counts
      const { data: notifData } = await notificationsAPI.getUnread();
      setUnreadCounts(notifData.counts);
    } catch (err) {
      console.error('fetchChats error:', err);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const selectChat = useCallback((chat) => {
    setActiveChat(chat);
    // Clear unread for this chat
    setUnreadCounts((prev) => ({ ...prev, [chat._id]: 0 }));
  }, []);

  const addOrUpdateChat = useCallback((chat) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => c._id === chat._id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...chat };
        return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      }
      return [chat, ...prev];
    });
  }, []);

  // ─── Messages ────────────────────────────────────────────────────────────
  const setMessagesForChat = useCallback((chatId, msgs) => {
    setMessages((prev) => ({ ...prev, [chatId]: msgs }));
  }, []);

  const appendMessage = useCallback((chatId, msg) => {
    setMessages((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), msg],
    }));
    // Update last message on chat card
    setChats((prev) => {
      const idx = prev.findIndex((c) => c._id === chatId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], lastMessage: msg, lastMessageAt: msg.createdAt };
      return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    });
  }, []);

  const updateMessage = useCallback((chatId, messageId, updates) => {
    setMessages((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map((m) =>
        m._id === messageId ? { ...m, ...updates } : m
      ),
    }));
  }, []);

  const removeMessage = useCallback((chatId, messageId) => {
    setMessages((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map((m) =>
        m._id === messageId ? { ...m, isDeleted: true, content: '' } : m
      ),
    }));
  }, []);

  // ─── Typing ──────────────────────────────────────────────────────────────
  const setUserTyping = useCallback((chatId, userId, name) => {
    setTypingUsers((prev) => ({
      ...prev,
      [chatId]: { ...(prev[chatId] || {}), [userId]: name },
    }));
    // Auto-clear after 4s
    const key = `${chatId}_${userId}`;
    clearTimeout(typingTimers.current[key]);
    typingTimers.current[key] = setTimeout(() => {
      setTypingUsers((prev) => {
        const updated = { ...prev };
        if (updated[chatId]) {
          const { [userId]: _, ...rest } = updated[chatId];
          updated[chatId] = rest;
        }
        return updated;
      });
    }, 4000);
  }, []);

  const clearUserTyping = useCallback((chatId, userId) => {
    setTypingUsers((prev) => {
      const updated = { ...prev };
      if (updated[chatId]) {
        const { [userId]: _, ...rest } = updated[chatId];
        updated[chatId] = rest;
      }
      return updated;
    });
  }, []);

  // ─── Presence ────────────────────────────────────────────────────────────
  const setUserOnline = useCallback((userId) => {
    setOnlineUsers((prev) => new Set([...prev, userId]));
  }, []);

  const setUserOffline = useCallback((userId) => {
    setOnlineUsers((prev) => {
      const s = new Set(prev);
      s.delete(userId);
      return s;
    });
  }, []);

  // ─── Unread ──────────────────────────────────────────────────────────────
  const incrementUnread = useCallback((chatId) => {
    setUnreadCounts((prev) => ({ ...prev, [chatId]: (prev[chatId] || 0) + 1 }));
  }, []);

  return (
    <ChatContext.Provider
      value={{
        chats, activeChat, messages, typingUsers, onlineUsers, unreadCounts, loadingChats,
        fetchChats, selectChat, addOrUpdateChat,
        setMessagesForChat, appendMessage, updateMessage, removeMessage,
        setUserTyping, clearUserTyping,
        setUserOnline, setUserOffline,
        incrementUnread,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
};
