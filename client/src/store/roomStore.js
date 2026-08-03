import { create } from 'zustand';

export const useRoomStore = create((set) => ({
  roomState: null,
  displayName: '',
  userId: '',
  setRoomState: (roomState, displayName, userId) => 
    set({ roomState, displayName, userId }),
  clearRoom: () => 
    set({ roomState: null, displayName: '', userId: '' })
}));