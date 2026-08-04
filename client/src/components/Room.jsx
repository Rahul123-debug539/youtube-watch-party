import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoPlayer from './VideoPlayer';
import Participants from './Participants';
import { useWebSocket } from '../hooks/useWebSocket';
import Toast from './Toast';

function Room({ roomState, displayName, userId, onLeave }) {
  const navigate = useNavigate();
  
  // ===== ALL STATE DECLARATIONS =====
  const [room, setRoom] = useState(roomState);
  const [participants, setParticipants] = useState(roomState.participants || []);
  const [isHost, setIsHost] = useState(roomState.userRole === 'host');
  const [videoId, setVideoId] = useState(roomState.currentVideo);
  const [isPlaying, setIsPlaying] = useState(roomState.isPlaying || false);
  const [currentTime, setCurrentTime] = useState(roomState.currentTime || 0);
  const [isSynced, setIsSynced] = useState(true);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
  
  // ===== REFS =====
  const toastIdCounter = useRef(0);
  const hasJoinedRef = useRef(false);
  const syncTimerRef = useRef(null);
  const leaveInProgressRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  const currentTimeRef = useRef(currentTime);
  
  // Update refs
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  console.log('🔍 Room mounted:', { 
    isHost, 
    userId, 
    roomCode: room?.roomCode,
    isPlaying,
    currentTime,
    videoId,
    participantsCount: participants?.length 
  });

  // Use deployed backend URL
  const wsUrl = import.meta.env.VITE_WS_URL || 'wss://youtube-watch-party-s7p4.onrender.com/ws';

  const { sendMessage, isConnected, reconnect } = useWebSocket(wsUrl, {
    onOpen: () => {
      console.log('✅ WebSocket connected!');
      if (!hasJoinedRef.current && room && displayName) {
        hasJoinedRef.current = true;
        console.log('📤 Joining room as:', displayName);
        sendMessage('join_room', {
          roomCode: room.roomCode,
          displayName: displayName
        });
      }
    },
    onMessage: (data) => {
      handleSocketMessage(data);
    },
    onClose: () => {
      hasJoinedRef.current = false;
      if (!leaveInProgressRef.current) {
        addToast('Disconnected from server. Reconnecting...', 'error');
        setTimeout(() => {
          reconnect();
        }, 2000);
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      addToast('Connection error', 'error');
    }
  });

  // ===== AUTO SYNC CHECK =====
  useEffect(() => {
    if (isConnected && isPlayerReady) {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
      syncTimerRef.current = setInterval(() => {
        checkSync();
      }, 3000);
    }
    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [isConnected, isPlayerReady, currentTime, playerCurrentTime]);

  const checkSync = () => {
    const diff = Math.abs(playerCurrentTime - currentTime);
    if (diff > 2) {
      setIsSynced(false);
      console.log('🔄 Out of sync - diff:', diff);
    } else {
      setIsSynced(true);
    }
  };

  // ===== SOCKET MESSAGE HANDLER =====
  const handleSocketMessage = (data) => {
    const { type, payload } = data;
    console.log('📨 Message:', type, payload);

    switch (type) {
      case 'room_state':
        console.log('📊 Room state:', payload);
        setRoom(payload);
        setParticipants(payload.participants || []);
        const newIsHost = payload.userId === payload.hostId;
        setIsHost(newIsHost);
        setVideoId(payload.currentVideo);
        setIsPlaying(payload.isPlaying);
        setCurrentTime(payload.currentTime);
        setIsSynced(true);
        console.log(`👑 User is ${newIsHost ? 'HOST' : 'PARTICIPANT'}`);
        addToast(`You are ${newIsHost ? 'Host 🎬' : 'Participant 👤'}`, 'info');
        break;

      case 'user_joined':
        console.log('👤 User joined:', payload);
        setParticipants(prev => {
          const exists = prev.some(p => p.id === payload.userId);
          if (exists) return prev;
          return [...prev, payload];
        });
        addToast(`${payload.displayName} joined the room`, 'info');
        break;

      case 'user_left':
        console.log('👤 User left:', payload);
        setParticipants(prev => prev.filter(p => p.id !== payload.userId));
        addToast(`${payload.displayName} left the room`, 'info');
        break;

      case 'play':
        console.log('▶️ Play event received');
        setIsPlaying(true);
        setIsSynced(true);
        addToast('▶️ Video playing', 'info');
        break;

      case 'pause':
        console.log('⏸️ Pause event received');
        setIsPlaying(false);
        setIsSynced(true);
        addToast('⏸️ Video paused', 'info');
        break;

      case 'seek':
        console.log('⏩ Seek to:', payload.time);
        setCurrentTime(payload.time);
        setIsSynced(true);
        break;

      case 'change_video':
        console.log('🎬 Video changed:', payload.videoId);
        setVideoId(payload.videoId);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsSynced(true);
        addToast('🎬 Video changed', 'info');
        break;

      case 'sync_response':
        console.log('🔄 Sync response:', payload);
        setVideoId(payload.videoId);
        setCurrentTime(payload.time);
        setIsPlaying(payload.isPlaying);
        setIsSynced(true);
        addToast('🔄 Synced to current position!', 'success');
        break;

      case 'error':
        addToast(payload.message || 'Error', 'error');
        break;

      case 'removed_by_host':
        addToast('You were removed by host', 'error');
        setTimeout(() => { 
          if (!leaveInProgressRef.current) {
            leaveInProgressRef.current = true;
            onLeave(); 
            navigate('/');
          }
        }, 1500);
        break;

      case 'room_closed':
        addToast('Room closed by host', 'error');
        setTimeout(() => { 
          if (!leaveInProgressRef.current) {
            leaveInProgressRef.current = true;
            onLeave(); 
            navigate('/');
          }
        }, 1500);
        break;

      default:
        console.log('Unknown event:', type);
    }
  };

  // ===== TOAST =====
  const addToast = (message, type = 'info') => {
    const id = toastIdCounter.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // ===== HOST CONTROLS - ONLY HOST CAN USE =====
  const handlePlay = () => {
    console.log(`🎯 Play clicked - isHost: ${isHost}`);
    if (!isHost) {
      addToast('🔒 Only Host can play!', 'error');
      return;
    }
    if (!isConnected) {
      addToast('Not connected to server', 'error');
      return;
    }
    console.log('📤 Sending PLAY to server');
    sendMessage('play', {});
  };

  const handlePause = () => {
    console.log(`🎯 Pause clicked - isHost: ${isHost}`);
    if (!isHost) {
      addToast('🔒 Only Host can pause!', 'error');
      return;
    }
    if (!isConnected) {
      addToast('Not connected to server', 'error');
      return;
    }
    console.log('📤 Sending PAUSE to server');
    sendMessage('pause', {});
  };

  const handleSeek = (time) => {
    if (!isHost) {
      addToast('🔒 Only Host can seek!', 'error');
      return;
    }
    if (!isConnected) {
      addToast('Not connected to server', 'error');
      return;
    }
    console.log('📤 Sending SEEK to server:', time);
    sendMessage('seek', { time });
  };

  const handleChangeVideo = (newVideoId) => {
    if (!isHost) {
      addToast('🔒 Only Host can change video!', 'error');
      return;
    }
    if (!isConnected) {
      addToast('Not connected to server', 'error');
      return;
    }
    console.log('📤 Sending CHANGE_VIDEO to server:', newVideoId);
    sendMessage('change_video', { videoId: newVideoId });
  };

  const handleRemoveParticipant = (targetUserId) => {
    if (!isHost) {
      addToast('🔒 Only Host can remove participants!', 'error');
      return;
    }
    if (!isConnected) {
      addToast('Not connected to server', 'error');
      return;
    }
    const target = participants.find(p => p.id === targetUserId);
    if (target) {
      if (window.confirm(`Remove ${target.displayName} from the room?`)) {
        console.log('📤 Sending REMOVE_PARTICIPANT:', targetUserId);
        sendMessage('remove_participant', { targetUserId });
      }
    }
  };

  // ===== GO LIVE / SYNC (Available to everyone) =====
  const handleSyncRequest = () => {
    console.log('🔄 Sync requested by:', isHost ? 'Host' : 'Guest');
    if (!isConnected) {
      addToast('Not connected to server', 'error');
      return;
    }
    console.log('📤 Sending SYNC_REQUEST to server');
    sendMessage('sync_request', {});
    addToast('🔄 Syncing to current position...', 'info');
  };

  // ===== PLAYER TIME UPDATE =====
  const handlePlayerTimeUpdate = (time) => {
    setPlayerCurrentTime(time);
  };

  // ===== LEAVE ROOM =====
  const handleLeave = () => {
    if (window.confirm('Are you sure you want to leave the room?')) {
      leaveInProgressRef.current = true;
      console.log('👋 Leaving room...');
      onLeave();
      navigate('/');
    }
  };

  // ===== COPY ROOM CODE =====
  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    addToast('✅ Room code copied!', 'success');
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/room/${room.roomCode}`;
    navigator.clipboard.writeText(link);
    addToast('✅ Room link copied!', 'success');
  };

  // ===== RENDER =====
  return (
    <div className="room-container">
      {/* HEADER */}
      <div className="room-header">
        <div className="room-info">
          <h2>🎬 Watch Party</h2>
          <div className="room-code-wrapper">
            <span className="room-code">Room: {room?.roomCode || 'Loading...'}</span>
            <button onClick={copyRoomCode} className="icon-btn" title="Copy room code">📋</button>
            <button onClick={copyRoomLink} className="icon-btn" title="Copy room link">🔗</button>
          </div>
          <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </span>
          <span className={`role-badge ${isHost ? 'host' : 'participant'}`}>
            {isHost ? '👑 Host' : '👤 Participant'}
          </span>
          <span className={`sync-status ${isSynced ? 'synced' : 'unsynced'}`}>
            {isSynced ? '✅ Synced' : '🔄 Out of Sync'}
          </span>
        </div>
        <button onClick={handleLeave} className="btn-leave">🚪 Leave</button>
      </div>

      {/* CONTENT */}
      <div className="room-content">
        <div className="video-section">
          <VideoPlayer
            videoId={videoId}
            isPlaying={isPlaying}
            currentTime={currentTime}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            isHost={isHost}
            isConnected={isConnected}
            onVideoChange={handleChangeVideo}
            onSyncRequest={handleSyncRequest}
            isSynced={isSynced}
            onTimeUpdate={handlePlayerTimeUpdate}
            onPlayerReady={() => setIsPlayerReady(true)}
          />
        </div>
        <div className="participants-section">
          <Participants
            participants={participants}
            hostId={room?.hostId}
            currentUserId={userId}
            isHost={isHost}
            onRemove={handleRemoveParticipant}
          />
        </div>
      </div>

      {/* TOASTS */}
      <Toast toasts={toasts} />

      <style>{`
        .room-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* HEADER */
        .room-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #1a1a1f;
          border-radius: 12px;
          border: 1px solid #33333b;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .room-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .room-info h2 {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }
        .room-code-wrapper {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #25252b;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .room-code {
          font-family: monospace;
          font-weight: 600;
          font-size: 16px;
          letter-spacing: 1px;
          color: #6c63ff;
        }
        .icon-btn {
          background: transparent;
          border: none;
          color: #a0a0aa;
          padding: 4px 6px;
          font-size: 16px;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .icon-btn:hover {
          background: #33333b;
          color: #e8e8e8;
        }
        .status {
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 12px;
          background: #25252b;
        }
        .status.connected {
          color: #4caf50;
        }
        .status.disconnected {
          color: #f44336;
        }
        .role-badge {
          font-size: 13px;
          padding: 4px 12px;
          border-radius: 12px;
          font-weight: 500;
        }
        .role-badge.host {
          background: rgba(255, 215, 0, 0.15);
          color: #ffd700;
          border: 1px solid #ffd700;
        }
        .role-badge.participant {
          background: rgba(108, 99, 255, 0.1);
          color: #6c63ff;
          border: 1px solid #6c63ff;
        }
        .sync-status {
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 12px;
          background: #25252b;
          font-weight: 500;
        }
        .sync-status.synced {
          color: #4caf50;
        }
        .sync-status.unsynced {
          color: #ff6b6b;
          animation: blink 1s ease-in-out infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .btn-leave {
          padding: 8px 20px;
          border: 1px solid #f44336;
          background: transparent;
          color: #f44336;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-leave:hover {
          background: #f44336;
          color: white;
        }

        /* CONTENT */
        .room-content {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 16px;
          flex: 1;
          min-height: 0;
        }
        .video-section {
          background: #1a1a1f;
          border-radius: 12px;
          border: 1px solid #33333b;
          padding: 16px;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .participants-section {
          background: #1a1a1f;
          border-radius: 12px;
          border: 1px solid #33333b;
          padding: 16px;
          overflow-y: auto;
        }

        /* TOASTS */
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 360px;
          width: 100%;
        }
        .toast {
          padding: 12px 20px;
          border-radius: 8px;
          background: #1a1a1f;
          border: 1px solid #33333b;
          color: #e8e8e8;
          font-size: 14px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
          animation: slideIn 0.3s ease;
        }
        .toast.success {
          border-left: 3px solid #4caf50;
        }
        .toast.error {
          border-left: 3px solid #f44336;
        }
        .toast.info {
          border-left: 3px solid #6c63ff;
        }
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .room-container {
            padding: 12px;
          }
          .room-content {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .room-info {
            gap: 8px;
          }
          .room-info h2 {
            font-size: 16px;
          }
          .participants-section {
            max-height: 200px;
          }
          .room-code {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}

export default Room;