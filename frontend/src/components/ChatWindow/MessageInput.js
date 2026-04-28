import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { mediaAPI } from '../../services/api';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

const MessageInput = ({ chatId, replyTo, onClearReply }) => {
  const { emit } = useSocket();
  const [content, setContent] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef(null);
  const typingTimer = useRef(null);
  const isTyping = useRef(false);
  const fileInputRef = useRef(null);

  const triggerTypingStart = useCallback(() => {
    if (!isTyping.current) {
      emit('typing_start', { chatId });
      isTyping.current = true;
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      emit('typing_stop', { chatId });
      isTyping.current = false;
    }, 2500);
  }, [chatId, emit]);

  const handleChange = (e) => {
    setContent(e.target.value);
    if (e.target.value) triggerTypingStart();
    else {
      emit('typing_stop', { chatId });
      isTyping.current = false;
    }
    // Auto-resize
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  const sendText = () => {
    const text = content.trim();
    if (!text) return;
    emit('send_message', {
      chatId,
      content: text,
      type: 'text',
      replyTo: replyTo?._id || null,
    });
    setContent('');
    isTyping.current = false;
    clearTimeout(typingTimer.current);
    onClearReply?.();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleEmojiSelect = (emoji) => {
    setContent((p) => p + emoji.native);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await mediaAPI.upload(file);
      emit('send_message', {
        chatId,
        content: data.file.name,
        type: data.file.type,
        fileUrl: data.file.url,
        fileName: data.file.name,
        fileSize: data.file.size,
        replyTo: replyTo?._id || null,
      });
      onClearReply?.();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Close emoji picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.emoji-picker-wrap') && !e.target.closest('.emoji-btn')) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="input-area" style={{ position: 'relative' }}>
      {/* Reply bar */}
      {replyTo && (
        <div className="reply-bar">
          <span className="reply-bar-text">
            ↩ Replying to: <strong>{replyTo.content?.slice(0, 50) || 'a message'}</strong>
          </span>
          <button className="reply-bar-close" onClick={onClearReply}>✕</button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="emoji-picker-wrap">
          <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="dark" />
        </div>
      )}

      <div className="input-row">
        <div className="input-box">
          <button
            className="emoji-btn"
            onClick={() => setShowEmoji((p) => !p)}
            title="Emoji"
            id="emoji-btn"
            type="button"
          >
            😊
          </button>

          <textarea
            ref={textareaRef}
            className="msg-textarea"
            placeholder="Type a message…"
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            id="message-input"
          />

          <button
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            id="attach-btn"
            type="button"
            disabled={uploading}
          >
            {uploading ? '⏳' : '📎'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            id="file-input"
          />
        </div>

        <button
          className="send-btn"
          onClick={sendText}
          disabled={!content.trim() && !uploading}
          id="send-btn"
          title="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
