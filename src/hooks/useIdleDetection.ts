import { useState, useEffect } from 'react';

export const useIdleDetection = (timeout: number = 60000) => {
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    let idleTimer: NodeJS.Timeout;

    const resetTimer = () => {
      setIsIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setIsIdle(true), timeout);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(name => window.addEventListener(name, resetTimer));

    resetTimer();

    return () => {
      events.forEach(name => window.removeEventListener(name, resetTimer));
      clearTimeout(idleTimer);
    };
  }, [timeout]);

  return isIdle;
};
