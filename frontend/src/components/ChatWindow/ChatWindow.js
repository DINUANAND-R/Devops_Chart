import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { messagesAPI } from '../../services/api';
import MessageBubble from '../MessageBubble/MessageBubble';
import MessageInput from './MessageInput';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import GroupInfo from '../GroupInfo/GroupInfo';

const formatDateLabel = (dateStr) => {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
};

const getInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const ChatWindow = () => {
  const { user } = useAuth();
  const { activeChat, messages, setMessagesForChat, typingUsers, onlineUsers } = useChat();
  const { emit } = useSocket();
  const messagesEndRef = useRef(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const scrollRef = useRef(null);

  const chatId = activeChat?._id;
  const chatMessages = messages[chatId] || [];

  const otherMember = !activeChat?.isGroup
    ? activeChat?.members?.find((m) => m._id !== user?._id)
    : null;

  const chatName = activeChat?.isGroup
    ? activeChat.groupName
    : otherMember?.name || 'Chat';

  const isOnline = !activeChat?.isGroup && onlineUsers.has(otherMember?._id);
  const typingList = Object.values(typingUsers[chatId] || {});

  // Join room & load messages when chat changes
  useEffect(() => {
    if (!chatId) return;

    setPage(1);
    setHasMore(true);
    setReplyTo(null);
    emit('join_chat', { chatId });

    const load = async () => {
      setLoadingMessages(true);
      try {
        const { data } = await messagesAPI.getMessages(chatId, 1, 30);
        setMessagesForChat(chatId, data.messages);
        setHasMore(data.pagination.pages > 1);
      } catch (err) {
        console.error('Load messages error:', err);
      } finally {
        setLoadingMessages(false);
      }
    };
    load();
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Load older messages (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMessages) return;
    const nextPage = page + 1;
    setLoadingMessages(true);
    try {
      const { data } = await messagesAPI.getMessages(chatId, nextPage, 30);
      setMessagesForChat(chatId, [...data.messages, ...chatMessages]);
      setHasMore(nextPage < data.pagination.pages);
      setPage(nextPage);
    } catch { } finally { setLoadingMessages(false); }
  }, [chatId, page, hasMore, loadingMessages, chatMessages, setMessagesForChat]);

  const handleScroll = (e) => {
    if (e.target.scrollTop < 80) loadMore();
  };

  // Group messages by date
  const groupedMessages = chatMessages.reduce((groups, msg) => {
    const dateKey = format(new Date(msg.createdAt), 'yyyy-MM-dd');
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
    return groups;
  }, {});

  return (
    <div className="chat-window" style={{ display: 'flex', flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Header */}
        <div className="chat-header">
          <div className="avatar">
            <div className="avatar-img">
              {activeChat?.isGroup
                ? activeChat.groupName?.[0]?.toUpperCase() || '👥'
                : getInitials(chatName)}
            </div>
            {isOnline && <div className="online-dot" />}
          </div>
          <div className="chat-header-info">
            <div className="chat-header-name">{chatName}</div>
            <div className={`chat-header-sub${isOnline ? ' online' : ''}`}>
              {activeChat?.isGroup
                ? `${activeChat.members?.length} members`
                : isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
          {activeChat?.isGroup && (
            <button
              className="icon-btn"
              title="Group info"
              id="group-info-btn"
              onClick={() => setShowGroupInfo((p) => !p)}
            >
              ℹ️
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="messages-area" onScroll={handleScroll} ref={scrollRef}>
          {loadingMessages && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          )}

          {Object.entries(groupedMessages).map(([dateKey, msgs]) => (
            <React.Fragment key={dateKey}>
              <div className="msg-date-divider">
                {formatDateLabel(msgs[0].createdAt)}
              </div>
              {msgs.map((msg, idx) => (
                <MessageBubble
                  key={msg._id}
                  msg={msg}
                  isOutgoing={msg.senderId?._id === user?._id || msg.senderId === user?._id}
                  showName={activeChat?.isGroup && (idx === 0 || msgs[idx - 1]?.senderId?._id !== msg.senderId?._id)}
                  onReply={() => setReplyTo(msg)}
                  chatId={chatId}
                />
              ))}
            </React.Fragment>
          ))}

          {typingList.length > 0 && (
            <div className="typing-indicator">
              <div className="dots">
                <div className="dot" /><div className="dot" /><div className="dot" />
              </div>
              <span>{typingList.length === 1 ? 'Someone is typing…' : 'Several people are typing…'}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <MessageInput chatId={chatId} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
      </div>

      {/* Group Info Panel */}
      {showGroupInfo && activeChat?.isGroup && (
        <GroupInfo chat={activeChat} onClose={() => setShowGroupInfo(false)} currentUserId={user?._id} />
      )}
    </div>
  );
};

export default ChatWindow;
