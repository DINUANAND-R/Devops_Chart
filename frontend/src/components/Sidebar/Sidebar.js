import React, { useState, useCallback, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { chatsAPI, usersAPI } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import ChatListItem from './ChatListItem';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { chats, activeChat, selectChat, addOrUpdateChat, loadingChats, unreadCounts } = useChat();
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [selectedForGroup, setSelectedForGroup] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  const filteredChats = chats.filter((c) => {
    const name = c.isGroup
      ? c.groupName
      : c.members?.find((m) => m._id !== user?._id)?.name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleUserSearch = useCallback(async (q) => {
    setUserSearch(q);
    clearTimeout(searchTimer.current);
    if (q.length < 2) return setUserResults([]);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await usersAPI.search(q);
        setUserResults(data.users);
      } catch { setUserResults([]); }
      finally { setSearching(false); }
    }, 350);
  }, []);

  const startChat = async (targetUser) => {
    try {
      const { data } = await chatsAPI.createOrGet(targetUser._id);
      addOrUpdateChat(data.chat);
      selectChat(data.chat);
      setShowNewChat(false);
      setUserSearch('');
      setUserResults([]);
    } catch (err) {
      console.error(err);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedForGroup.length < 2) return;
    try {
      const { data } = await chatsAPI.createGroup({
        groupName: groupName.trim(),
        members: selectedForGroup.map((u) => u._id),
      });
      addOrUpdateChat(data.chat);
      selectChat(data.chat);
      setShowNewGroup(false);
      setGroupName('');
      setSelectedForGroup([]);
      setUserSearch('');
      setUserResults([]);
    } catch (err) {
      console.error(err);
    }
  };

  const getInitials = (name = '') =>
    name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <div className="logo-icon">💬</div>
          NexChat
        </div>
        <div className="sidebar-actions">
          <button
            className="icon-btn"
            title="New Chat"
            id="btn-new-chat"
            onClick={() => setShowNewChat(true)}
          >
            ✏️
          </button>
          <button
            className="icon-btn"
            title="New Group"
            id="btn-new-group"
            onClick={() => setShowNewGroup(true)}
          >
            👥
          </button>
          <button
            className="icon-btn"
            title={`Logged in as ${user?.name}`}
            id="btn-logout"
            onClick={logout}
          >
            🚪
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <div className="search-input-wrap">
          <span>🔍</span>
          <input
            className="search-input"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="chat-search"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="chat-list">
        {loadingChats ? (
          <div className="chat-list-empty">
            <div className="spinner" style={{ width: 30, height: 30 }} />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="chat-list-empty">
            <div className="empty-icon">💬</div>
            <p>No conversations yet. Start a new chat!</p>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <ChatListItem
              key={chat._id}
              chat={chat}
              active={activeChat?._id === chat._id}
              currentUserId={user?._id}
              unread={unreadCounts[chat._id] || 0}
              onClick={() => selectChat(chat)}
            />
          ))
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">New Chat</div>
            <input
              className="form-input"
              placeholder="Search by name or email…"
              value={userSearch}
              onChange={(e) => handleUserSearch(e.target.value)}
              autoFocus
              id="new-chat-search"
            />
            <div style={{ marginTop: '0.75rem' }}>
              {searching && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem' }}>Searching…</div>}
              {userResults.map((u) => (
                <div key={u._id} className="user-result" onClick={() => startChat(u)}>
                  <div className="avatar">
                    <div className="avatar-img">{getInitials(u.name)}</div>
                    {u.status === 'online' && <div className="online-dot" />}
                  </div>
                  <div className="user-result-info">
                    <div className="user-result-name">{u.name}</div>
                    <div className="user-result-email">{u.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroup && (
        <div className="modal-overlay" onClick={() => setShowNewGroup(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">New Group</div>
            <input
              className="form-input"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{ marginBottom: '0.75rem' }}
              id="group-name-input"
            />
            {selectedForGroup.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {selectedForGroup.map((u) => (
                  <span
                    key={u._id}
                    style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    {u.name}
                    <button onClick={() => setSelectedForGroup((p) => p.filter((x) => x._id !== u._id))} style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <input
              className="form-input"
              placeholder="Search members…"
              value={userSearch}
              onChange={(e) => handleUserSearch(e.target.value)}
              style={{ marginBottom: '0.5rem' }}
              id="group-member-search"
            />
            {userResults
              .filter((u) => !selectedForGroup.find((s) => s._id === u._id))
              .map((u) => (
                <div
                  key={u._id}
                  className="user-result"
                  onClick={() => setSelectedForGroup((p) => [...p, u])}
                >
                  <div className="avatar">
                    <div className="avatar-img">{getInitials(u.name)}</div>
                  </div>
                  <div className="user-result-info">
                    <div className="user-result-name">{u.name}</div>
                    <div className="user-result-email">{u.email}</div>
                  </div>
                </div>
              ))}
            <button
              className="btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={createGroup}
              disabled={!groupName.trim() || selectedForGroup.length < 2}
              id="create-group-btn"
            >
              Create Group ({selectedForGroup.length} members)
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
