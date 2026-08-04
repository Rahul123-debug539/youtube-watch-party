import React, { useEffect, useRef, useState } from 'react';

function VideoPlayer({
  videoId,
  isPlaying,
  currentTime,
  onPlay,
  onPause,
  onSeek,
  isHost,
  isConnected,
  onVideoChange,
  onSyncRequest,
  isSynced,
  onTimeUpdate,
  onPlayerReady
}) {
  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [showChangeVideo, setShowChangeVideo] = useState(false);
  const [volume, setVolume] = useState(100);
  const [playerTime, setPlayerTime] = useState(0);
  
  const isHostRef = useRef(isHost);
  const isPlayingRef = useRef(isPlaying);
  const currentTimeRef = useRef(currentTime);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Load YouTube API
  useEffect(() => {
    if (!window.YT) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onload = () => {
        window.onYouTubeIframeAPIReady = initPlayer;
      };
      document.body.appendChild(script);
    } else {
      initPlayer();
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
        playerReadyRef.current = false;
      }
    };
  }, []);

  const initPlayer = () => {
    if (playerRef.current || !document.getElementById('youtube-player')) return;

    try {
      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,        // ❌ NO CONTROLS - HOST AUR GUEST DONO KE LIYE
          disablekb: 1,       // ❌ NO KEYBOARD
          fs: 0,              // ❌ NO FULLSCREEN
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            playerReadyRef.current = true;
            setIsPlayerReady(true);
            if (currentTimeRef.current > 0) {
              event.target.seekTo(currentTimeRef.current, true);
            }
            event.target.setVolume(volume);
            console.log('🎬 Player ready');
            if (onPlayerReady) {
              onPlayerReady();
            }
          },
          onStateChange: (event) => {
            const state = event.data;
            console.log('🎬 Player state changed:', state);
            
            // Update player time
            if (playerRef.current) {
              try {
                const time = playerRef.current.getCurrentTime();
                setPlayerTime(time);
                if (onTimeUpdate) {
                  onTimeUpdate(time);
                }
              } catch (e) {}
            }
            
            // 🔒 YOUTUBE CONTROLS DISABLED FOR EVERYONE
            // Agar koi bhi (host ya guest) YouTube player se play/pause kare toh revert
            if (state === window.YT.PlayerState.PLAYING && !isPlayingRef.current) {
              console.log('⛔ YouTube controls detected - pausing');
              event.target.pauseVideo();
              return;
            } else if (state === window.YT.PlayerState.PAUSED && isPlayingRef.current) {
              console.log('⛔ YouTube controls detected - playing');
              event.target.playVideo();
              return;
            }
            
            // Kisi ko bhi YouTube player se control nahi karne denge
            // Sirf manual buttons se control hoga
          },
          onError: (event) => {
            console.error('🎬 YouTube Player error:', event);
          }
        }
      });
    } catch (error) {
      console.error('Error initializing YouTube player:', error);
    }
  };

  // ===== SYNC: Video Change =====
  useEffect(() => {
    if (playerReadyRef.current && playerRef.current) {
      try {
        const currentVideoId = playerRef.current.getVideoData?.()?.video_id;
        if (currentVideoId !== videoId) {
          console.log('🎬 Loading new video:', videoId);
          playerRef.current.loadVideoById(videoId, 0);
        }
      } catch (error) {
        console.error('Error loading video:', error);
      }
    }
  }, [videoId]);

  // ===== SYNC: Play/Pause =====
  useEffect(() => {
    if (!playerReadyRef.current || !playerRef.current) {
      return;
    }

    try {
      const playerState = playerRef.current.getPlayerState();
      console.log('🔄 Sync - isPlaying:', isPlaying, 'playerState:', playerState);
      
      if (isPlaying && playerState !== window.YT.PlayerState.PLAYING) {
        console.log('▶️ Syncing play');
        playerRef.current.playVideo();
      } else if (!isPlaying && playerState === window.YT.PlayerState.PLAYING) {
        console.log('⏸️ Syncing pause');
        playerRef.current.pauseVideo();
      }
    } catch (error) {
      console.error('Play/pause sync error:', error);
    }
  }, [isPlaying]);

  // ===== SYNC: Seek =====
  useEffect(() => {
    if (!playerReadyRef.current || !playerRef.current) return;

    try {
      const currentTimeInPlayer = playerRef.current.getCurrentTime();
      const diff = Math.abs(currentTimeInPlayer - currentTime);
      
      if (diff > 0.5) {
        console.log('⏩ Syncing seek to:', currentTime);
        playerRef.current.seekTo(currentTime, true);
      }
    } catch (error) {
      console.error('Seek sync error:', error);
    }
  }, [currentTime]);

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (playerRef.current) {
      playerRef.current.setVolume(newVolume);
    }
  };

  const handleChangeVideoSubmit = (e) => {
    e.preventDefault();
    const url = newVideoUrl.trim();
    if (!url) return;

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
      setShowChangeVideo(false);
    } else {
      alert('Invalid YouTube URL or video ID');
    }
  };

  const handleGoLive = () => {
    console.log('🎯 Go Live clicked');
    if (onSyncRequest) {
      onSyncRequest();
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-player-container">
      <div className="player-wrapper">
        <div id="youtube-player" className="youtube-player"></div>
        
        {!isConnected && (
          <div className="overlay">
            <div className="spinner"></div>
            <p>Reconnecting...</p>
          </div>
        )}
        
        {!isPlayerReady && isConnected && (
          <div className="overlay">
            <div className="spinner"></div>
            <p>Loading player...</p>
          </div>
        )}
        
        {/* 🔒 Guest Overlay */}
        {!isHost && isPlayerReady && (
          <div className="guest-overlay">
            <div className="guest-lock">🔒</div>
            <span>View Only Mode</span>
          </div>
        )}
        
        {/* 🚫 Host Overlay - YouTube Controls Disabled */}
        {isHost && isPlayerReady && (
          <div className="host-overlay">
            <div className="host-info">🎮 Use Controls Below</div>
          </div>
        )}
        
        {/* Sync Badge */}
        {isConnected && isPlayerReady && (
          <div className="sync-badge">
            <span>{isSynced ? '✅ Synced' : '🔄 Out of Sync'}</span>
            <span className="sync-time">{formatTime(playerTime)}</span>
            {!isSynced && (
              <button onClick={handleGoLive} className="sync-go-live-btn">
                Go Live
              </button>
            )}
          </div>
        )}
      </div>

      <div className="video-controls">
        <div className="control-group">
          <button
            onClick={onPlay}
            disabled={!isHost || !isConnected}
            className={`control-btn play-btn ${!isHost ? 'disabled' : ''}`}
            title={!isHost ? '🔒 Only Host can play' : '▶️ Play'}
          >
            ▶ Play
          </button>
          <button
            onClick={onPause}
            disabled={!isHost || !isConnected}
            className={`control-btn pause-btn ${!isHost ? 'disabled' : ''}`}
            title={!isHost ? '🔒 Only Host can pause' : '⏸️ Pause'}
          >
            ⏸ Pause
          </button>
        </div>

        <div className="control-group">
          <button
            onClick={() => setShowChangeVideo(!showChangeVideo)}
            disabled={!isHost || !isConnected}
            className={`control-btn ${!isHost ? 'disabled' : ''}`}
            title={!isHost ? '🔒 Only Host can change video' : '📺 Change Video'}
          >
            📺 Change Video
          </button>
        </div>

        <div className="control-group">
          <button
            onClick={handleGoLive}
            disabled={!isConnected || !isPlayerReady}
            className={`control-btn go-live-btn ${!isSynced ? 'out-of-sync' : ''}`}
            title="Sync to current position"
          >
            🔄 {isSynced ? 'Synced' : 'Go Live'}
          </button>
        </div>

        <div className="control-group volume-control">
          <span>🔊</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        </div>

        <div className={`host-badge ${isHost ? 'host' : 'guest'}`}>
          {isHost ? '👑 Host (Controls Enabled)' : '👤 Participant (View Only)'}
        </div>
      </div>

      {showChangeVideo && isHost && (
        <form onSubmit={handleChangeVideoSubmit} className="change-video-form">
          <input
            type="text"
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            placeholder="Enter YouTube URL or video ID"
            className="video-input"
          />
          <button type="submit" className="btn-submit">Change</button>
          <button
            type="button"
            onClick={() => setShowChangeVideo(false)}
            className="btn-cancel"
          >
            Cancel
          </button>
        </form>
      )}

      <style>{`
        .video-player-container {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .player-wrapper {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
        }
        .youtube-player {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          gap: 12px;
          z-index: 10;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #33333b;
          border-top-color: #6c63ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .guest-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.4);
          color: white;
          gap: 8px;
          z-index: 5;
          cursor: not-allowed;
          backdrop-filter: blur(2px);
          border-radius: 8px;
        }
        .guest-overlay .guest-lock {
          font-size: 48px;
          opacity: 0.7;
        }
        .guest-overlay span {
          font-size: 14px;
          font-weight: 500;
          opacity: 0.8;
          background: rgba(0, 0, 0, 0.6);
          padding: 4px 16px;
          border-radius: 20px;
        }
        .host-overlay {
          position: absolute;
          bottom: 60px;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 16px;
          border-radius: 20px;
          background: rgba(0, 0, 0, 0.75);
          border: 1px solid rgba(255, 215, 0, 0.3);
          color: #ffd700;
          font-size: 12px;
          font-weight: 500;
          z-index: 5;
          backdrop-filter: blur(5px);
          pointer-events: none;
        }
        .host-overlay .host-info {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sync-badge {
          position: absolute;
          bottom: 20px;
          right: 20px;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          background: rgba(0, 0, 0, 0.85);
          border: 1px solid #333;
          color: #e8e8e8;
          display: flex;
          align-items: center;
          gap: 10px;
          backdrop-filter: blur(10px);
          z-index: 15;
        }
        .sync-badge .sync-time {
          color: #6c63ff;
          font-family: monospace;
        }
        .sync-go-live-btn {
          background: #6c63ff;
          border: none;
          color: white;
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sync-go-live-btn:hover {
          background: #7b73ff;
        }
        .video-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          flex-wrap: wrap;
        }
        .control-group {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .control-btn {
          padding: 8px 16px;
          background: #25252b;
          border: 1px solid #33333b;
          border-radius: 6px;
          color: #e8e8e8;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          cursor: pointer;
        }
        .control-btn:hover:not(:disabled) {
          background: #6c63ff;
          border-color: #6c63ff;
          color: white;
        }
        .control-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: #1a1a1f;
        }
        .control-btn.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .play-btn:hover:not(:disabled) {
          background: #4caf50 !important;
          border-color: #4caf50 !important;
        }
        .pause-btn:hover:not(:disabled) {
          background: #ff6b6b !important;
          border-color: #ff6b6b !important;
        }
        .go-live-btn {
          background: #2a2a3a;
          border-color: #6c63ff;
          color: #6c63ff;
        }
        .go-live-btn:hover:not(:disabled) {
          background: #6c63ff;
          color: white;
        }
        .go-live-btn.out-of-sync {
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { border-color: #6c63ff; }
          50% { border-color: #ff6b6b; }
        }
        .volume-control {
          gap: 6px;
        }
        .volume-slider {
          width: 80px;
          height: 4px;
          background: #25252b;
          border-radius: 2px;
          outline: none;
          -webkit-appearance: none;
        }
        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #6c63ff;
          cursor: pointer;
        }
        .host-badge {
          margin-left: auto;
          padding: 6px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          background: #25252b;
          border: 1px solid #33333b;
        }
        .host-badge.host {
          border-color: #ffd700;
          color: #ffd700;
        }
        .host-badge.guest {
          border-color: #6c63ff;
          color: #6c63ff;
        }
        .change-video-form {
          display: flex;
          gap: 8px;
          padding: 12px 0;
          flex-wrap: wrap;
        }
        .video-input {
          flex: 1;
          min-width: 200px;
          padding: 8px 12px;
          background: #25252b;
          border: 1px solid #33333b;
          border-radius: 6px;
          color: #e8e8e8;
          font-size: 14px;
        }
        .video-input:focus {
          outline: none;
          border-color: #6c63ff;
        }
        .btn-submit, .btn-cancel {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-submit {
          background: #6c63ff;
          color: white;
        }
        .btn-submit:hover {
          background: #7b73ff;
        }
        .btn-cancel {
          background: transparent;
          color: #a0a0aa;
          border: 1px solid #33333b;
        }
        .btn-cancel:hover {
          background: #25252b;
        }
        @media (max-width: 768px) {
          .video-controls {
            gap: 8px;
          }
          .control-btn {
            padding: 6px 12px;
            font-size: 13px;
          }
          .volume-slider {
            width: 60px;
          }
          .host-badge {
            font-size: 12px;
            padding: 4px 10px;
          }
          .sync-badge {
            font-size: 11px;
            padding: 4px 10px;
            bottom: 10px;
            right: 10px;
          }
          .guest-overlay .guest-lock {
            font-size: 32px;
          }
          .guest-overlay span {
            font-size: 12px;
          }
          .host-overlay {
            bottom: 50px;
            font-size: 10px;
            padding: 4px 12px;
          }
        }
      `}</style>
    </div>
  );
}

export default VideoPlayer;