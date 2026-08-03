import React, { createContext, useContext, useState } from 'react';

const RoomContext = createContext();

export function RoomProvider({ children }) {
  const [roomState, setRoomState] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [userId, setUserId] = useState('');

  const joinRoom = (roomData, name, id) => {
    setRoomState(roomData);
    setDisplayName(name);
    setUserId(id);
  };

  const leaveRoom = () => {
    setRoomState(null);
    setDisplayName('');
    setUserId('');
  };

  return (
    <RoomContext.Provider value={{ roomState, displayName, userId, joinRoom, leaveRoom }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within RoomProvider');
  }
  return context;
}