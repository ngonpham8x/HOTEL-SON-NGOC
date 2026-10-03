import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => console.error('Không đăng ký được ứng dụng offline:', error));
  });
}

createRoot(document.getElementById('root')!).render(<App />);
