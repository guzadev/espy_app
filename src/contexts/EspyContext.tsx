import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTodo } from './TodoContext';

const ESPY_HOSTNAME = "espy.local";
const RECONNECT_INTERVAL = 5000; // Try to reconnect every 5 seconds when disconnected
const STATUS_UPDATE_INTERVAL = 5000; // Update status every 5 seconds
const CONNECTION_TIMEOUT = 3000; // 3 second timeout for faster feedback

interface EspyStatus {
  status: string;
  animation: string;
  task: string;
  uptime: number;
  connectedDevices: number;
  ip: string;
}

type EspyActivityState = 'idle' | 'pomodoro' | 'break' | 'complete' | 'focus' | 'paused';

interface EspyContextType {
  isConnected: boolean;
  isConnecting: boolean;
  espyStatus: EspyStatus | null;
  connectionError: string;
  customIP: string;
  activityState: EspyActivityState;

  // Methods
  checkConnection: () => Promise<void>;
  setCustomIP: (ip: string) => void;
  sendAnimation: (animation: string, task?: string, duration?: number) => Promise<boolean>;
  triggerTaskCompletion: (taskTitle: string) => void;
  triggerDebug: () => Promise<void>;
  disconnect: () => void;
}

const EspyContext = createContext<EspyContextType | undefined>(undefined);

export const useEspySync = () => {
  const context = useContext(EspyContext);
  if (context === undefined) {
    throw new Error('useEspySync must be used within a EspyProvider');
  }
  return context;
};

export const EspyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData, pomodoroTimer, currentTaskId } = useTodo();

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [espyStatus, setEspyStatus] = useState<EspyStatus | null>(null);
  const [connectionError, setConnectionError] = useState<string>('');
  const [customIP, setCustomIP] = useState(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem('espy_ip');
    return saved || ESPY_HOSTNAME;
  });
  const [activityState, setActivityState] = useState<EspyActivityState>('idle');
  const [isPlayingCompletionAnimation, setIsPlayingCompletionAnimation] = useState(false);
  const [lastSyncedAnimation, setLastSyncedAnimation] = useState<string | null>(null);

  // Save IP to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('espy_ip', customIP);
  }, [customIP]);

  // Try to connect to a specific address
  const tryConnect = useCallback(async (address: string): Promise<boolean> => {
    try {
      const response = await fetch(`http://${address}/api/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (response.ok) {
        const status = await response.json();
        setEspyStatus(status);
        setIsConnected(true);
        setConnectionError('');

        // Save the working IP for next time (extract from status if available)
        if (status.ip && status.ip !== address) {
          localStorage.setItem('espy_last_working_ip', status.ip);
        } else if (address !== ESPY_HOSTNAME) {
          localStorage.setItem('espy_last_working_ip', address);
        }

        console.log('✅ Connected to Espy at', address, ':', status);
        return true;
      }
    } catch (error) {
      console.log(`⏳ Could not reach ${address}`);
    }
    return false;
  }, []);

  const checkConnection = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError('');

    // Build list of addresses to try (smart fallback)
    const addressesToTry: string[] = [];

    // 1. First try the user-specified address (if not default)
    if (customIP && customIP !== ESPY_HOSTNAME) {
      addressesToTry.push(customIP);
    }

    // 2. Try espy.local (mDNS)
    addressesToTry.push(ESPY_HOSTNAME);

    // 3. Try last known working IP (if different from above)
    const lastWorkingIP = localStorage.getItem('espy_last_working_ip');
    if (lastWorkingIP && !addressesToTry.includes(lastWorkingIP)) {
      addressesToTry.push(lastWorkingIP);
    }

    console.log('🔍 Trying to connect to Espy at:', addressesToTry);

    // Try each address
    for (const address of addressesToTry) {
      if (await tryConnect(address)) {
        // Update customIP to the working address
        if (address !== customIP) {
          setCustomIP(address);
        }
        setIsConnecting(false);
        return;
      }
    }

    // All addresses failed
    setIsConnected(false);
    setEspyStatus(null);
    setConnectionError('🔍 Cannot find Espy. Make sure it\'s powered on and connected to the same WiFi network. Press "Show Debug Info" on Espy to see its IP address.');
    setIsConnecting(false);
  }, [customIP, tryConnect, setCustomIP]);

  const updateStatus = useCallback(async () => {
    if (!isConnected) return;

    try {
      const response = await fetch(`http://${customIP}/api/status`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const status = await response.json();
        setEspyStatus(status);
      }
    } catch (error) {
      // Connection lost - only log, don't update UI state here
      // The periodic check will handle reconnection
      console.log('⚠️ Status update failed:', error);
    }
  }, [isConnected, customIP]);

  const sendAnimation = useCallback(async (animation: string, task?: string, duration?: number): Promise<boolean> => {
    // Attempt to send even if we think we're disconnected - this acts as a connection check too

    try {
      const payload: { animation: string; task: string; duration?: number } = {
        animation: animation,
        task: task || ''
      };

      // Include duration for timer-based animations (focus, break)
      if (duration && duration > 0) {
        payload.duration = duration;
      }

      console.log('🎨 Sending animation to Espy:', animation, task, duration ? `(${duration}s)` : '');
      const response = await fetch(`http://${customIP}/api/animation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (response.ok) {
        console.log('✅ Animation sent successfully:', animation);
        setLastSyncedAnimation(animation);
        // If we succeeded, we are definitely connected
        if (!isConnected) {
          setIsConnected(true);
          setConnectionError('');
        }
        // Update status to reflect the change
        setTimeout(updateStatus, 500);
        return true;
      } else {
        console.log('❌ Failed to send animation:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to send animation:', error);
      // Only mark as disconnected if it was previously connected
      if (isConnected) {
        setIsConnected(false);
      }
      return false;
    }
  }, [isConnected, customIP, updateStatus]);

  const triggerDebug = useCallback(async () => {
    if (!isConnected) {
      console.log('⚠️ Not connected to Espy, cannot trigger debug mode');
      return;
    }

    try {
      console.log('🔧 Triggering debug mode on Espy...');
      const response = await fetch(`http://${customIP}/api/debug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Debug mode activated:', data);
      } else {
        console.log('❌ Failed to trigger debug mode:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Failed to trigger debug mode:', error);
    }
  }, [isConnected, customIP]);

  const triggerTaskCompletion = useCallback((taskTitle: string) => {
    if (!isConnected) {
      console.log('⚠️ Not connected to Espy, skipping task completion animation');
      return;
    }

    console.log('🎉 Task completed - triggering love animation:', taskTitle);
    setIsPlayingCompletionAnimation(true);
    setActivityState('complete');
    sendAnimation('love', taskTitle);

    // Return to idle after 9 seconds (LOVE animation is ~8 seconds at 8fps)
    setTimeout(() => {
      console.log('💤 Returning to idle state after task completion');
      setIsPlayingCompletionAnimation(false);
      setActivityState('idle');
      sendAnimation('idle');
    }, 9000);
  }, [isConnected, sendAnimation]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setEspyStatus(null);
    setConnectionError('');
  }, []);

  // Auto-connect on component mount (with delay so user can enter IP first)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkConnection();
    }, 2000); // 2 second delay before first auto-connect attempt

    return () => clearTimeout(timer);
  }, [checkConnection]);

  // Periodic reconnection attempts when disconnected (every 5 seconds)
  useEffect(() => {
    if (isConnected) return; // Don't retry when already connected

    const interval = setInterval(() => {
      if (!isConnecting) {
        console.log('🔄 Auto-retrying connection to Espy...');
        checkConnection();
      }
    }, RECONNECT_INTERVAL);

    return () => clearInterval(interval);
  }, [isConnected, isConnecting, checkConnection]);

  // Periodic status updates when connected
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      updateStatus();
    }, STATUS_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [isConnected, updateStatus]);

  // Reset sync state when connection is lost so animations get resent on reconnect
  useEffect(() => {
    if (!isConnected) {
      setLastSyncedAnimation(null);
    }
  }, [isConnected]);

  // Main synchronization logic - monitor pomodoro state and sync with Espy
  useEffect(() => {
    // We removed the isConnected check here to allow optimistic updates
    // sendAnimation will handle the connection logic internally

    // Don't override the animation if we're playing the completion animation
    if (isPlayingCompletionAnimation) return;

    const currentTask = currentTaskId
      ? userData.tasks.find(t => t.id === currentTaskId)
      : null;

    // Helper to check if we need to resync (animation not yet sent or device state mismatch)
    // This now checks both local sync state and device state
    const needsSync = (targetAnim: string) => {
      // If we haven't successfully synced this animation yet, we need to sync
      if (lastSyncedAnimation !== targetAnim) return true;
      // If connected and device reports different animation, resync
      if (isConnected && espyStatus && espyStatus.animation !== targetAnim) return true;
      return false;
    };

    // Determine the current activity state and send appropriate animation
    if (pomodoroTimer.isRunning) {
      // Active session running
      if (pomodoroTimer.sessionType === 'work') {
        // Focus session active - send REMAINING time for progress bar
        setActivityState('focus');
        if (needsSync('focus')) {
          // Use timeLeft (remaining seconds) so progress bar is correct after pause/resume
          const remainingSeconds = Math.max(0, Math.floor(pomodoroTimer.timeLeft));
          sendAnimation('focus', currentTask?.title || 'Focus Session', remainingSeconds);
          console.log('🍅 Pomodoro running - sending focus animation with remaining:', remainingSeconds, 'seconds');
        }
      } else if (pomodoroTimer.sessionType === 'shortBreak') {
        // Break session active - send remaining duration
        setActivityState('break');
        if (needsSync('break')) {
          const remainingSeconds = Math.max(0, Math.floor(pomodoroTimer.timeLeft));
          sendAnimation('break', 'Break Time', remainingSeconds);
          console.log('☕ Break running - sending break animation with remaining:', remainingSeconds, 'seconds');
        }
      }
    } else if (pomodoroTimer.justCompleted) {
      // Session just completed
      setActivityState('complete');
      if (needsSync('complete')) {
        const completionMessage = pomodoroTimer.sessionType === 'work'
          ? currentTask?.title || 'Task Complete!'
          : 'Break Complete!';
        sendAnimation('complete', completionMessage);
        console.log('✅ Session completed - sending complete animation');
      }
    } else if (pomodoroTimer.currentSession && !pomodoroTimer.isRunning) {
      // Paused session
      setActivityState('paused');
      if (needsSync('paused')) {
        sendAnimation('paused', 'Paused');
        console.log('⏸️ Session paused - sending paused animation');
      }
    } else {
      // No active session - idle
      setActivityState('idle');
      if (needsSync('idle')) {
        sendAnimation('idle');
        console.log('💤 Idle state - sending idle animation');
      }
    }
  }, [
    isConnected,
    espyStatus, // Add espyStatus dependency to trigger resync checks
    isPlayingCompletionAnimation,
    pomodoroTimer.isRunning,
    pomodoroTimer.justCompleted,
    pomodoroTimer.sessionType,
    pomodoroTimer.currentSession,
    currentTaskId,
    userData.tasks,
    lastSyncedAnimation,
    sendAnimation
  ]);

  const value: EspyContextType = {
    isConnected,
    isConnecting,
    espyStatus,
    connectionError,
    customIP,
    activityState,
    checkConnection,
    setCustomIP,
    sendAnimation,
    triggerTaskCompletion,
    triggerDebug,
    disconnect,
  };

  return <EspyContext.Provider value={value}>{children}</EspyContext.Provider>;
};
