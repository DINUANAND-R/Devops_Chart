import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';

const getInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd/MM/yy');
};

const ChatListItem = ({ chat, active, currentUserId, unread, onClick }) => {
  const other = !chat.isGroup
    ? chat.members?.find((m) => m._id !== currentUserId)
    : null;

  const name = chat.isGroup ? chat.groupName : other?.name || 'Unknown';
  const isOnline = !chat.isGroup && other?.status === 'online';

  const lastMsg = chat.lastMessage;
  let preview = 'No messages yet';
  if (lastMsg) {
    if (lastMsg.isDeleted) preview = '🚫 Message deleted';
    else if (lastMsg.type === 'image') preview = '📷 Photo';
    else if (lastMsg.type === 'file') preview = '📎 File';
    else if (lastMsg.type === 'audio') preview = '🎵 Audio';
    else preview = lastMsg.content || '';
  }

  const time = formatTime(chat.lastMessageAt);

  return (
    <div
      className={`chat-item${active ? ' active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      id={`chat-item-${chat._id}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="avatar">
        <div className="avatar-img">
          {chat.isGroup ? (chat.groupName?.[0]?.toUpperCase() || '👥') : getInitials(name)}
        </div>
        {isOnline && <div className="online-dot" />}
      </div>

      <div className="chat-item-info">
        <div className="chat-item-header">
          <span className="chat-item-name">{name}</span>
          <span className="chat-item-time">{time}</span>
        </div>
        <div className="chat-item-preview">
          <span className="chat-item-msg">{preview}</span>
          {unread > 0 && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
        </div>
      </div>
    </div>
  );
};

export default ChatListItem;
