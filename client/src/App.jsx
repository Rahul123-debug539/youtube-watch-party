import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useRoom } from './context/RoomContext';
import Landing from './components/Landing';
import Room from './components/Room';

function App() {
  const { roomState, displayName, userId, joinRoom, leaveRoom } = useRoom();

  return (
    <Routes>
      <Route 
        path="/" 
        element={<Landing onJoin={joinRoom} />} 
      />
      <Route 
        path="/room/:roomCode" 
        element={
          roomState ? (
            <Room
              roomState={roomState}
              displayName={displayName}
              userId={userId}
              onLeave={leaveRoom}
            />
          ) : (
            <Navigate to="/" replace />
          )
        } 
      />
    </Routes>
  );
}

export default App;