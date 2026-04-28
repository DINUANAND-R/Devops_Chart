import React from 'react';

const getInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const GroupInfo = ({ chat, onClose, currentUserId }) => {
  const admins = new Set((chat.admins || []).map(String));

  return (
    <div className="group-info-panel">
      <div className="group-info-header">
        <button className="icon-btn" onClick={onClose} id="close-group-info">✕</button>
        <span style={{ fontWeight: 600 }}>Group Info</span>
      </div>

      <div className="group-info-cover">
        <div className="avatar avatar-lg">
          <div className="avatar-img" style={{ width: 72, height: 72, fontSize: '2rem' }}>
            {chat.groupName?.[0]?.toUpperCase() || '👥'}
          </div>
        </div>
        <div className="group-info-name">{chat.groupName}</div>
        {chat.groupDescription && (
          <div className="group-info-desc">{chat.groupDescription}</div>
        )}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {chat.members?.length} members
        </div>
      </div>

      <div className="group-members">
        <div className="members-title">Members</div>
        {(chat.members || []).map((member) => {
          const isAdmin = admins.has(String(member._id));
          const isMe = String(member._id) === currentUserId;
          return (
            <div key={member._id} className="member-item">
              <div className="avatar avatar-sm">
                <div className="avatar-img">
                  {member.avatar
                    ? <img src={member.avatar} alt={member.name} />
                    : getInitials(member.name)}
                </div>
                {member.status === 'online' && <div className="online-dot" style={{ width: 10, height: 10 }} />}
              </div>
              <div>
                <div className="member-name">
                  {member.name}{isMe ? ' (You)' : ''}
                </div>
                {isAdmin && <div className="member-role">Admin</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GroupInfo;
