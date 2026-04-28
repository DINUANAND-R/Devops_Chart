import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar/Sidebar';
import ChatWindow from '../components/ChatWindow/ChatWindow';
import useMessages from '../hooks/useMessages';

// Register all global socket events at the page level
const SocketEventManager = () => {
  const { activeChat } = useChat();
  // useMessages with no chatId just registers global listeners
  useMessages(activeChat?._id);
  return null;
};

const ChatPage = () => {
  const { fetchChats } = useChat();
  const { activeChat } = useChat();

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  return (
    <div className="app-layout">
      <SocketEventManager />
      <Sidebar />
      {activeChat ? (
        <ChatWindow />
      ) : (
        <div className="chat-window">
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <h2>NexChat</h2>
            <p>Select a conversation from the sidebar or start a new chat to begin messaging.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
