import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';

const useMessages = (chatId) => {
  const { socket, emit, on, off } = useSocket();
  const { user } = useAuth();
  const {
    appendMessage, updateMessage, removeMessage,
    setUserTyping, clearUserTyping,
    setUserOnline, setUserOffline,
    incrementUnread, activeChat,
  } = useChat();

  const activeChatRef = useRef(activeChat);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  // Register global socket listeners once
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      appendMessage(msg.chatId, msg);
      // If this message isn't for the active chat, bump unread count
      if (String(msg.chatId) !== String(activeChatRef.current?._id)) {
        incrementUnread(msg.chatId);
      } else {
        // Mark as read immediately
        emit('message_read', { messageId: msg._id, chatId: msg.chatId });
      }
    };

    const handleMessageEdited = ({ messageId, content, chatId, editedAt }) => {
      updateMessage(chatId, messageId, { content, editedAt });
    };

    const handleMessageDeleted = ({ messageId, chatId }) => {
      removeMessage(chatId, messageId);
    };

    const handleReactionUpdated = ({ messageId, reactions, chatId }) => {
      updateMessage(chatId, messageId, { reactions });
    };

    const handleMessageSeen = ({ messageId, chatId }) => {
      updateMessage(chatId, messageId, { status: 'read' });
    };

    const handleMessageDelivered = ({ messageId, chatId }) => {
      updateMessage(chatId, messageId, { status: 'delivered' });
    };

    const handleTypingStart = ({ chatId, userId }) => {
      if (userId !== user?._id) setUserTyping(chatId, userId, '');
    };

    const handleTypingStop = ({ chatId, userId }) => {
      clearUserTyping(chatId, userId);
    };

    const handleUserOnline = ({ userId }) => setUserOnline(userId);
    const handleUserOffline = ({ userId }) => setUserOffline(userId);

    on('new_message', handleNewMessage);
    on('message_edited', handleMessageEdited);
    on('message_deleted', handleMessageDeleted);
    on('reaction_updated', handleReactionUpdated);
    on('message_seen', handleMessageSeen);
    on('message_delivered', handleMessageDelivered);
    on('user_typing', handleTypingStart);
    on('user_stop_typing', handleTypingStop);
    on('user_online', handleUserOnline);
    on('user_offline', handleUserOffline);

    return () => {
      off('new_message', handleNewMessage);
      off('message_edited', handleMessageEdited);
      off('message_deleted', handleMessageDeleted);
      off('reaction_updated', handleReactionUpdated);
      off('message_seen', handleMessageSeen);
      off('message_delivered', handleMessageDelivered);
      off('user_typing', handleTypingStart);
      off('user_stop_typing', handleTypingStop);
      off('user_online', handleUserOnline);
      off('user_offline', handleUserOffline);
    };
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback((data) => {
    emit('send_message', { chatId, ...data });
  }, [chatId, emit]);

  const sendTypingStart = useCallback(() => {
    emit('typing_start', { chatId });
  }, [chatId, emit]);

  const sendTypingStop = useCallback(() => {
    emit('typing_stop', { chatId });
  }, [chatId, emit]);

  const sendReaction = useCallback((messageId, emoji) => {
    emit('message_reaction', { messageId, emoji, chatId });
  }, [chatId, emit]);

  const sendDelete = useCallback((messageId) => {
    emit('delete_message', { messageId, chatId });
  }, [chatId, emit]);

  const sendEdit = useCallback((messageId, content) => {
    emit('edit_message', { messageId, content, chatId });
  }, [chatId, emit]);

  return { sendMessage, sendTypingStart, sendTypingStop, sendReaction, sendDelete, sendEdit };
};

export default useMessages;
