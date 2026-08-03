import React, { useState } from 'react';

function Controls({
  isHost,
  isConnected,
  onPlay,
  onPause,
  onSeek,
  onVideoChange,
  videoId,
  currentTime,
  isPlaying
}) {
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);

  const handleChangeVideo = (e) => {
    e.preventDefault();
    const url = newVideoUrl.trim();
    if (!url) return;

    // Extract video ID
    let extractedId = url;
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&]+)/,
      /(?:youtu\.be\/)([^?]+)/,
      /(?:youtube\.com\/embed\/)([^?]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        extractedId = match[1];
        break;
      }
    }

    if (extractedId && extractedId.length === 11) {
      onVideoChange(extractedId);
      setNewVideoUrl('');
      setShowVideoInput(false);
    } else {
      alert('Invalid YouTube URL or video ID');
    }
  };

  return (
    <div className="controls-container">
      <div className="controls-main">
        <button
          onClick={onPlay}
          disabled={!isHost || !isConnected}
          className={`control-btn ${isPlaying ? 'active' : ''}`}
        >
          ▶ Play
        </button>
        <button
          onClick={onPause}
          disabled={!isHost || !isConnected}
          className={`control-btn ${!isPlaying ? 'active' : ''}`}
        >
          ⏸ Pause
        </button>
        <button
          onClick={() => setShowVideoInput(!showVideoInput)}
          disabled={!isHost || !isConnected}
          className="control-btn"
        >
          📺 Change Video
        </button>
      </div>

      {showVideoInput && isHost && (
        <form onSubmit={handleChangeVideo} className="video-input-form">
          <input
            type="text"
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            placeholder="Paste YouTube URL or video ID"
            className="video-input"
          />
          <button type="submit" className="btn-submit">Apply</button>
          <button
            type="button"
            onClick={() => setShowVideoInput(false)}
            className="btn-cancel"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="controls-info">
        <span className="control-status">
          {isHost ? '👑 Host controls enabled' : '👤 Participant (view-only)'}
        </span>
        <span className="video-status">
          Video: {videoId}
        </span>
      </div>

      <style>{`
        .controls-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px 0;
        }
        .controls-main {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .control-btn {
          padding: 8px 16px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .control-btn:hover:not(:disabled) {
          background: var(--accent);
          border-color: var(--accent);
        }
        .control-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .control-btn.active {
          background: var(--accent);
          border-color: var(--accent);
        }
        .video-input-form {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .video-input {
          flex: 1;
          min-width: 200px;
          padding: 8px 12px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 14px;
        }
        .video-input:focus {
          outline: none;
          border-color: var(--accent);
        }
        .btn-submit {
          padding: 8px 16px;
          border: none;
          background: var(--accent);
          color: white;
          border-radius: 6px;
          font-weight: 500;
        }
        .btn-submit:hover {
          background: var(--accent-hover);
        }
        .btn-cancel {
          padding: 8px 16px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          border-radius: 6px;
          font-weight: 500;
        }
        .btn-cancel:hover {
          background: var(--bg-input);
        }
        .controls-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: var(--text-secondary);
          flex-wrap: wrap;
          gap: 8px;
        }
        .control-status {
          font-weight: 500;
        }
        .video-status {
          font-family: monospace;
          font-size: 12px;
        }
        @media (max-width: 768px) {
          .controls-main {
            gap: 6px;
          }
          .control-btn {
            padding: 6px 12px;
            font-size: 13px;
          }
          .video-input {
            min-width: 150px;
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}

export default Controls;