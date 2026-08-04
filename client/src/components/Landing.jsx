import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Use environment variable or fallback to localhost
const API_URL = import.meta.env.VITE_API_URL || 'https://youtube-watch-party-s7p4.onrender.com/api';

function Landing({ onJoin }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('create');
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please enter your display name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Creating room with:', { displayName, videoUrl });
      
      const response = await axios.post(`${API_URL}/rooms/create`, {
        displayName: displayName.trim(),
        videoUrl: videoUrl.trim() || undefined
      });

      console.log('Room created:', response.data);

      const { roomCode, hostId, currentVideo, isPlaying, currentTime } = response.data;
      
      onJoin({
        roomCode,
        currentVideo,
        isPlaying,
        currentTime,
        participants: [],
        hostId,
        userRole: 'host'
      }, displayName.trim(), hostId);

      navigate(`/room/${roomCode}`);
    } catch (err) {
      console.error('Create room error:', err);
      setError(err.response?.data?.error || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please enter your display name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const code = roomCode.trim().toUpperCase();
      console.log('Joining room:', code);
      
      const response = await axios.get(`${API_URL}/rooms/${code}`);
      const room = response.data;

      console.log('Room found:', room);

      const existingUser = room.participants.find(p => p.displayName === displayName.trim());
      const userId = existingUser?.id || `temp-${Date.now()}`;
      const userRole = existingUser?.role || 'participant';

      onJoin({
        ...room,
        userRole,
        participants: room.participants || []
      }, displayName.trim(), userId);

      navigate(`/room/${code}`);
    } catch (err) {
      console.error('Join room error:', err);
      setError(err.response?.data?.error || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing">
      <div className="landing-box">
        <h1>🎬 Watch Party</h1>
        <p className="sub">Watch YouTube together in real-time</p>

        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'create' ? 'active' : ''}`}
            onClick={() => { setMode('create'); setError(''); }}
          >
            Create Room
          </button>
          <button
            className={`mode-btn ${mode === 'join' ? 'active' : ''}`}
            onClick={() => { setMode('join'); setError(''); }}
          >
            Join Room
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {mode === 'create' ? (
          <form onSubmit={handleCreateRoom}>
            <div className="form-group">
              <label>Your Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>YouTube URL (optional)</label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Paste YouTube URL or leave empty for default"
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinRoom}>
            <div className="form-group">
              <label>Your Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                maxLength="6"
                disabled={loading}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Joining...' : 'Join Room'}
            </button>
          </form>
        )}
      </div>

      <style>{`
        .landing {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
          background: radial-gradient(ellipse at 30% 20%, #18181f 0%, #0d0d0f 70%);
        }
        .landing-box {
          background: #1a1a1f;
          border: 1px solid #33333b;
          border-radius: 12px;
          padding: 40px;
          max-width: 440px;
          width: 100%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        }
        .landing-box h1 {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #fff 30%, #6c63ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 4px;
        }
        .landing-box .sub {
          color: #a0a0aa;
          font-size: 14px;
          margin-bottom: 32px;
        }
        .mode-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          background: #25252b;
          padding: 4px;
          border-radius: 8px;
        }
        .mode-btn {
          flex: 1;
          padding: 10px;
          border: none;
          background: transparent;
          color: #a0a0aa;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          cursor: pointer;
        }
        .mode-btn.active {
          background: #6c63ff;
          color: white;
        }
        .mode-btn:hover:not(.active) {
          color: #e8e8e8;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #a0a0aa;
          margin-bottom: 4px;
        }
        .form-group input {
          width: 100%;
          padding: 12px;
          background: #25252b;
          border: 1px solid #33333b;
          border-radius: 8px;
          color: #e8e8e8;
          font-size: 15px;
          transition: border-color 0.2s;
          outline: none;
        }
        .form-group input:focus {
          border-color: #6c63ff;
        }
        .form-group input::placeholder {
          color: #a0a0aa;
        }
        .btn-primary {
          width: 100%;
          padding: 14px;
          border: none;
          background: #6c63ff;
          color: white;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          transition: background 0.2s;
          cursor: pointer;
        }
        .btn-primary:hover:not(:disabled) {
          background: #7b73ff;
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .error-message {
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid #f44336;
          color: #f44336;
          padding: 10px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
}

export default Landing;