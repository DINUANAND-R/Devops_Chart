import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const StatusIcon = ({ status }) => {
  if (status === 'read') return <span className="msg-status read" title="Read">✓✓</span>;
  if (status === 'delivered') return <span className="msg-status delivered" title="Delivered">✓✓</span>;
  return <span className="msg-status sent" title="Sent">✓</span>;
};

const MessageBubble = ({ msg, isOutgoing, showName, onReply, chatId }) => {
  const { user } = useAuth();
  const { emit } = useSocket();
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const hoverTimer = useRef(null);

  const senderName =
    typeof msg.senderId === 'object' ? msg.senderId?.name : 'Unknown';

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setShowActions(true), 300);
  };
  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current);
    setShowActions(false);
    setShowReactionPicker(false);
  };

  const handleDelete = () => {
    if (window.confirm('Delete this message?')) {
      emit('delete_message', { messageId: msg._id, chatId });
    }
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (editContent.trim() && editContent !== msg.content) {
      emit('edit_message', { messageId: msg._id, content: editContent.trim(), chatId });
    }
    setEditing(false);
  };

  const handleReact = (emoji) => {
    emit('message_reaction', { messageId: msg._id, emoji, chatId });
    setShowReactionPicker(false);
  };

  const renderContent = () => {
    if (msg.isDeleted) {
      return <span className="msg-content deleted">🚫 Message deleted</span>;
    }
    if (editing) {
      return (
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', gap: '0.4rem' }}>
          <input
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            autoFocus
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', padding: '0.2rem 0.4rem', flex: 1 }}
          />
          <button type="submit" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>Save</button>
          <button type="button" onClick={() => setEditing(false)} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cancel</button>
        </form>
      );
    }
    if (msg.type === 'image' && msg.fileUrl) {
      return (
        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
          <img src={msg.fileUrl} alt={msg.fileName || 'image'} className="msg-image" loading="lazy" />
        </a>
      );
    }
    if ((msg.type === 'file' || msg.type === 'video' || msg.type === 'audio') && msg.fileUrl) {
      return (
        <a href={msg.fileUrl} download={msg.fileName} className="msg-file" rel="noopener noreferrer">
          <span className="msg-file-icon">
            {msg.type === 'audio' ? '🎵' : msg.type === 'video' ? '🎬' : '📎'}
          </span>
          <div className="msg-file-info">
            <div className="msg-file-name">{msg.fileName || 'File'}</div>
            {msg.fileSize && (
              <div className="msg-file-size">{(msg.fileSize / 1024).toFixed(1)} KB</div>
            )}
          </div>
        </a>
      );
    }
    return <span className="msg-content">{msg.content}</span>;
  };

  // Count reactions
  const reactionMap = {};
  (msg.reactions || []).forEach((r) => {
    reactionMap[r.emoji] = (reactionMap[r.emoji] || 0) + 1;
  });
  const myUserId = user?._id;
  const myReactions = new Set((msg.reactions || []).filter((r) => String(r.userId) === myUserId).map((r) => r.emoji));

  return (
    <div
      className={`message-wrap ${isOutgoing ? 'outgoing' : 'incoming'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="message-bubble" style={{ position: 'relative' }}>
        {/* Sender name in group */}
        {showName && !isOutgoing && (
          <div className="msg-sender-name">{senderName}</div>
        )}

        {/* Reply preview */}
        {msg.replyTo && (
          <div className="reply-preview">
            ↩ {typeof msg.replyTo === 'object' ? msg.replyTo.content?.slice(0, 60) || 'Message' : 'Message'}
          </div>
        )}

        {renderContent()}

        {/* Footer */}
        <div className="msg-footer">
          {msg.editedAt && !msg.isDeleted && <span className="msg-edited">edited</span>}
          <span className="msg-time">{format(new Date(msg.createdAt), 'HH:mm')}</span>
          {isOutgoing && !msg.isDeleted && <StatusIcon status={msg.status} />}
        </div>

        {/* Reactions */}
        {Object.keys(reactionMap).length > 0 && (
          <div className="msg-reactions">
            {Object.entries(reactionMap).map(([emoji, count]) => (
              <button
                key={emoji}
                className={`reaction-pill${myReactions.has(emoji) ? ' mine' : ''}`}
                onClick={() => handleReact(emoji)}
              >
                {emoji} <span>{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {showActions && !msg.isDeleted && (
          <div className="msg-actions">
            <button
              className="msg-action-btn"
              title="React"
              onClick={() => setShowReactionPicker((p) => !p)}
            >
              😊
            </button>
            <button className="msg-action-btn" title="Reply" onClick={() => { onReply(msg); setShowActions(false); }}>
              ↩
            </button>
            {isOutgoing && (
              <>
                <button className="msg-action-btn" title="Edit" onClick={() => { setEditing(true); setShowActions(false); }}>
                  ✏️
                </button>
                <button className="msg-action-btn danger" title="Delete" onClick={handleDelete}>
                  🗑️
                </button>
              </>
            )}
          </div>
        )}

        {/* Reaction picker */}
        {showReactionPicker && (
          <div style={{
            position: 'absolute', bottom: '100%', [isOutgoing ? 'right' : 'left']: 0,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-full)', padding: '0.35rem 0.5rem',
            display: 'flex', gap: '0.25rem', zIndex: 30, boxShadow: 'var(--shadow-md)',
          }}>
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                style={{ fontSize: '1.2rem', padding: '0.15rem', transition: 'transform 0.12s', border: 'none', background: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.3)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
