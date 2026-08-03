import React from 'react';

function Participants({ participants, hostId, currentUserId, isHost, onRemove }) {
  console.log('👥 Participants render:', participants);
  
  // Ensure participants is an array
  const participantsList = Array.isArray(participants) ? participants : [];
  
  // Remove duplicates based on id
  const uniqueParticipants = participantsList.filter((participant, index, self) => 
    index === self.findIndex(p => p.id === participant.id)
  );

  // Sort: host first, then alphabetically
  const sortedParticipants = [...uniqueParticipants].sort((a, b) => {
    if (a.id === hostId) return -1;
    if (b.id === hostId) return 1;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });

  return (
    <div className="participants-container">
      <h3 className="participants-title">
        👥 Participants ({sortedParticipants.length})
      </h3>
      <div className="participants-list">
        {sortedParticipants.length === 0 ? (
          <div className="empty-state">No participants yet</div>
        ) : (
          sortedParticipants.map((participant) => {
            const isCurrentUser = participant.id === currentUserId;
            const isHostUser = participant.id === hostId;
            const canRemove = isHost && !isHostUser && !isCurrentUser;

            return (
              <div
                key={participant.id || Math.random().toString()} // Ensure unique key
                className={`participant-item ${isCurrentUser ? 'current-user' : ''} ${isHostUser ? 'host' : ''}`}
              >
                <div className="participant-info">
                  <span className="participant-name">
                    {participant.displayName || 'Unknown'}
                    {isCurrentUser && ' (you)'}
                  </span>
                  {isHostUser && (
                    <span className="role-badge host">👑 Host</span>
                  )}
                  {!isHostUser && (
                    <span className="role-badge participant">👤 Participant</span>
                  )}
                </div>
                {canRemove && (
                  <button
                    onClick={() => onRemove(participant.id)}
                    className="btn-remove"
                    title="Remove participant"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .participants-container {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .participants-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #a0a0aa;
        }
        .participants-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .participant-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: #25252b;
          border-radius: 8px;
          border: 1px solid transparent;
          transition: border-color 0.2s;
        }
        .participant-item.current-user {
          border-color: #6c63ff;
          background: rgba(108, 99, 255, 0.08);
        }
        .participant-item.host {
          background: rgba(255, 215, 0, 0.06);
        }
        .participant-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .participant-name {
          font-size: 14px;
          font-weight: 500;
        }
        .role-badge {
          font-size: 11px;
          padding: 2px 10px;
          border-radius: 12px;
          font-weight: 500;
        }
        .role-badge.host {
          background: rgba(255, 215, 0, 0.15);
          color: #ffd700;
        }
        .role-badge.participant {
          background: #1a1a1f;
          color: #a0a0aa;
        }
        .btn-remove {
          background: transparent;
          border: none;
          color: #f44336;
          font-size: 16px;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-remove:hover {
          background: rgba(244, 67, 54, 0.1);
        }
        .empty-state {
          color: #a0a0aa;
          font-size: 14px;
          text-align: center;
          padding: 20px 0;
        }
      `}</style>
    </div>
  );
}

export default Participants;