import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { RoomProvider } from './context/RoomContext';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <RoomProvider>
      <App />
    </RoomProvider>
  </BrowserRouter>
);