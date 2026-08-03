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
  onVideoChange
}) {
  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [showChangeVideo, setShowChangeVideo] = useState(false);
  const [volume, setVolume] = useState(100);
  const isHostRef = useRef(isHost);
  const isPlayingRef = useRef(isPlaying);
  const currentTimeRef = useRef(currentTime);

  // Update refs
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    // Load YouTube IFrame API
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
          controls: 0,
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
          },
          onStateChange: (event) => {
            const state = event.data;
            console.log('🎬 Player state changed:', state);
            
            // Only send events if host
            if (!isHostRef.current) return;
            
            if (state === window.YT.PlayerState.PLAYING && !isPlayingRef.current) {
              console.log('▶️ Player started playing (host)');
              onPlay();
            } else if (state === window.YT.PlayerState.PAUSED && isPlayingRef.current) {
              console.log('⏸️ Player paused (host)');
              onPause();
            }
          }
        }
      });
    } catch (error) {
      console.error('Error initializing YouTube player:', error);
    }
  };

  // Handle video changes
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

  // Handle play/pause sync
  useEffect(() => {
    if (!playerReadyRef.current || !playerRef.current) return;

    try {
      const playerState = playerRef.current.getPlayerState();
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

  // Handle seek sync
  useEffect(() => {
    if (!playerReadyRef.current || !playerRef.current) return;

    try {
      const currentTimeInPlayer = playerRef.current.getCurrentTime();
      if (Math.abs(currentTimeInPlayer - currentTime) > 0.5) {
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

  return (
    <div className="video-player-container">
      <div className="player-wrapper">
        <div id="youtube-player" className="youtube-player"></div>
        {!isConnected && (
          <div className="connection-overlay">
            <div className="spinner"></div>
            <p>Reconnecting...</p>
          </div>
        )}
        {!isPlayerReady && isConnected && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Loading player...</p>
          </div>
        )}
      </div>

      <div className="video-controls">
        <div className="control-group">
          <button
            onClick={onPlay}
            disabled={!isHost || !isConnected}
            className={`control-btn ${!isHost ? 'disabled' : ''}`}
            title={!isHost ? 'Only host can control playback' : 'Play'}
          >
            ▶ Play
          </button>
          <button
            onClick={onPause}
            disabled={!isHost || !isConnected}
            className={`control-btn ${!isHost ? 'disabled' : ''}`}
            title={!isHost ? 'Only host can control playback' : 'Pause'}
          >
            ⏸ Pause
          </button>
        </div>

        <div className="control-group">
          <button
            onClick={() => setShowChangeVideo(!showChangeVideo)}
            disabled={!isHost || !isConnected}
            className={`control-btn ${!isHost ? 'disabled' : ''}`}
            title="Change video"
          >
            📺 Change Video
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

        <div className="host-badge">
          {isHost ? '👑 Host' : '👤 Participant'}
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
        .loading-overlay,
        .connection-overlay {
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
          padding: 8px 14px;
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
        }
        .control-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .control-btn.disabled {
          opacity: 0.4;
          cursor: not-allowed;
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
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          background: #25252b;
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
        .btn-submit,
        .btn-cancel {
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
            padding: 6px 10px;
            font-size: 13px;
          }
          .volume-slider {
            width: 60px;
          }
          .host-badge {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}

export default VideoPlayer;