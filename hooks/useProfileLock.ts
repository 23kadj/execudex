import { useEffect, useRef, useState } from 'react';
import { logDiag, newTraceId } from '../lib/diag/logger';
import { ProfileLockService, ProfileLockStatus } from '../services/profileLockService';

export function useProfileLock(
  profileId?: number | string,
  isPpl?: boolean
): {
  lockStatus: ProfileLockStatus | null;
  isLoading: boolean;
  hideTabBar: boolean;
  refetch: () => Promise<void>;
} {
  const [lockStatus, setLockStatus] = useState<ProfileLockStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hideTabBar, setHideTabBar] = useState(false);
  
  // Generate trace ID for this hook instance
  const traceIdRef = useRef<string>(newTraceId('use-profile-lock'));
  const trace = traceIdRef.current;

  const idNum = typeof profileId === 'string' ? parseInt(profileId, 10) : profileId;
  
  logDiag('hook:useProfileLock:init', { profileId, idNum, isPpl }, trace);

  const loadLockStatus = async () => {
    if (idNum == null || isPpl == null) {
      logDiag('hook:loadLockStatus:skip', { idNum, isPpl }, trace);
      setLockStatus(null);
      setHideTabBar(false);
      setIsLoading(false);
      return;
    }

    logDiag('hook:loadLockStatus:start', { idNum, isPpl }, trace);
    setIsLoading(true);
    try {
      const [status, shouldHide] = await Promise.all([
        ProfileLockService.checkProfileLockStatus(idNum, isPpl, trace),
        ProfileLockService.shouldHideTabBar(idNum, isPpl)
      ]);
      
      logDiag('hook:loadLockStatus:success', {
        idNum,
        isPpl,
        isLocked: status.isLocked,
        lockReason: status.lockReason,
        shouldHide
      }, trace);
      
      setLockStatus(status);
      setHideTabBar(shouldHide);
    } catch (error) {
      console.error('Error loading profile lock status:', error);
      logDiag('hook:loadLockStatus:error', { idNum, isPpl, error }, trace);
      setLockStatus(null);
      setHideTabBar(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLockStatus();
  }, [idNum, isPpl]);

  return {
    lockStatus,
    isLoading,
    hideTabBar,
    refetch: loadLockStatus
  };
}
