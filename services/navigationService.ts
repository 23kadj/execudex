import { router } from 'expo-router';
import { Alert } from 'react-native';
import { addToHistory } from '../utils/historyUtils';
import { getSupabaseClient } from '../utils/supabase';
import { LegislationProfileService } from './legislationProfileService';
import { PoliticianProfileService } from './politicianProfileService';
import { checkProfileAccess } from './profileAccessService';

type NavigationParams = {
  pathname: string;
  params: Record<string, any>;
};

export class NavigationService {
  private static isProcessing = false;
  private static currentAbortController: AbortController | null = null;
  private static loadingCallback: ((loading: boolean) => void) | null = null;
  private static errorCallback: ((error: string | null) => void) | null = null;
  private static lowMaterialityCallback: ((isLowMateriality: boolean, suggestUI?: any) => void) | null = null;

  /**
   * Set loading callback for showing/hiding loading indicator
   */
  static setLoadingCallback(callback: (loading: boolean) => void): void {
    this.loadingCallback = callback;
  }

  /**
   * Set error callback for showing error messages
   */
  static setErrorCallback(callback: (error: string | null) => void): void {
    this.errorCallback = callback;
  }

  /**
   * Set low materiality callback for handling low materiality detection
   */
  static setLowMaterialityCallback(callback: (isLowMateriality: boolean, suggestUI?: any) => void): void {
    this.lowMaterialityCallback = callback;
  }

  /**
   * Cancel current profile processing
   */
  static cancelProcessing(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
      this.isProcessing = false;
      this.loadingCallback?.(false);
      this.errorCallback?.(null);
      console.log('Profile processing cancelled by user');
    }
  }

  /**
   * Navigate to politician profile with pre-processing
   */
  static async navigateToPoliticianProfile(params: NavigationParams, userId?: string): Promise<void> {
    if (this.isProcessing) {
      console.log('Already processing a profile, ignoring navigation request');
      return;
    }

    // Create abort controller for this operation
    this.currentAbortController = new AbortController();

    try {
      this.isProcessing = true;
      
      // Extract politician ID from params with validation
      const indexParam = params.params?.index;
      if (!indexParam || (typeof indexParam !== 'string' && typeof indexParam !== 'number')) {
        console.error('Invalid or missing politician ID:', indexParam);
        // Navigate anyway with invalid ID
        router.push(params);
        this.isProcessing = false;
        return;
      }
      
      const politicianId = typeof indexParam === 'string' ? parseInt(indexParam, 10) : Math.floor(Number(indexParam));
      if (isNaN(politicianId) || politicianId <= 0) {
        console.error('Invalid politician ID (not a valid number):', indexParam);
        // Navigate anyway with invalid ID
        router.push(params);
        this.isProcessing = false;
        return;
      }

      // Check if cancelled
      if (this.currentAbortController?.signal.aborted) {
        throw new Error('CANCELLED');
      }

      // ✅ STEP 1: Get userId if not provided, then check access FIRST (before any processing)
      let finalUserId = userId;
      
      // If userId not provided, try to get it from Supabase session
      if (!finalUserId) {
        console.log('[NavigationService] userId not provided, attempting to get from session...');
        try {
          const { data: { session } } = await getSupabaseClient().auth.getSession();
          finalUserId = session?.user?.id;
          if (finalUserId) {
            console.log('[NavigationService] Successfully retrieved userId from session:', finalUserId);
          } else {
            console.warn('[NavigationService] No userId found in session - profile tracking will be skipped');
          }
        } catch (error) {
          console.error('[NavigationService] Error getting userId from session:', error);
        }
      } else {
        console.log('[NavigationService] userId provided:', finalUserId);
      }

      // Only check access if we have a userId
      if (finalUserId) {
        console.log('[NavigationService] Checking profile access before processing:', { politicianId, userId: finalUserId });
        this.loadingCallback?.(true);
        
        try {
          const accessCheck = await checkProfileAccess(finalUserId, `${politicianId}ppl`);
          
          // Check if cancelled after async operation
          if (this.currentAbortController?.signal.aborted) {
            throw new Error('CANCELLED');
          }
          
          console.log('[NavigationService] Access check result:', {
            allowed: accessCheck.allowed,
            profilesUsed: accessCheck.profilesUsed,
            reason: accessCheck.reason,
            error: accessCheck.error
          });
          
          this.loadingCallback?.(false);
          
          if (!accessCheck.allowed) {
            console.log('[NavigationService] Profile access denied, preventing processing and navigation');
            
            // Show access denied alert with upgrade option
            Alert.alert(
              'Weekly Profile Limit Reached',
              `You've reached your weekly limit for new profiles, come back Sunday.\n\nCheck your history to revisit authorized profiles or upgrade to Execudex Plus for unlimited access.`,
              [
                {
                  text: 'Upgrade Now',
                  onPress: () => {
                    router.push('/subscription');
                  },
                },
                {
                  text: 'OK',
                },
              ],
              { cancelable: false }
            );
            
            this.isProcessing = false;
            return; // Stop completely - no processing, no navigation
          }
          
          // Show warning if user is running low on profiles (2 or 1 remaining)
          if (accessCheck.showWarning && accessCheck.remainingProfiles !== undefined) {
            const remaining = accessCheck.remainingProfiles;
            Alert.alert(
              'Profile Limit Warning',
              `You have ${remaining} profile${remaining === 1 ? '' : 's'} remaining this week. Your limit resets on Sunday.`,
              [{ text: 'OK' }]
            );
          }
          
          console.log('[NavigationService] Profile access granted, proceeding with processing');
        } catch (error) {
          console.error('[NavigationService] Error during access check:', error);
          this.loadingCallback?.(false);
          // Continue with processing even if access check fails (graceful degradation)
          console.warn('[NavigationService] Continuing despite access check error');
        }
      } else {
        console.warn('[NavigationService] No userId available - skipping profile access check and tracking');
      }

      // ✅ STEP 2: Execute profile processing (only if access granted)
      console.log('Starting profile processing for politician:', politicianId);
      
      // Always show loading indicator (even for already-indexed profiles)
      // This ensures users see feedback even when profiles should load instantly
      this.loadingCallback?.(true);
      
      // Execute politician profile checks and scripts BEFORE navigation
      await PoliticianProfileService.handleProfileOpen(politicianId);
      
      // Check if cancelled after processing
      if (this.currentAbortController?.signal.aborted) {
        throw new Error('CANCELLED');
      }
      
      console.log('Profile processing completed, prefetching profile data');
      
      // ✅ STEP 3: Prefetch profile data to avoid "No Data Available" flash
      try {
        const supabase = getSupabaseClient();
        const { data: profileData } = await supabase
          .from('ppl_profiles')
          .select('approval, disapproval, synopsis, agenda, identity, affiliates, poll_summary, poll_link, score')
          .eq('index_id', politicianId)
          .maybeSingle();
        
        // Add prefetched data to params if available
        if (profileData) {
          console.log('Successfully prefetched profile data');
          params.params.prefetchedProfileData = JSON.stringify(profileData);
        }
      } catch (error) {
        console.warn('Failed to prefetch profile data, will load on page:', error);
        // Continue without prefetched data - page will fetch it
      }
      
      // Navigate after processing is complete
      router.push(params);
      
      // Hide loading indicator after navigation (small delay to ensure smooth transition)
      setTimeout(() => {
        this.loadingCallback?.(false);
      }, 100);
      
      // Add to history after successful navigation
      await addToHistory({
        id: politicianId.toString(),
        name: params.params.title || 'Unknown Politician',
        sub_name: params.params.subtitle || 'Unknown',
        is_ppl: true,
      }, userId);
      
      this.isProcessing = false;
      
    } catch (error: any) {
      console.error('Error in profile pre-processing:', error);
      
      // Check if error is due to cancellation
      if (error?.message === 'CANCELLED' || this.currentAbortController?.signal.aborted) {
        console.log('Profile processing was cancelled');
        this.loadingCallback?.(false);
        this.errorCallback?.(null);
        this.isProcessing = false;
        this.currentAbortController = null;
        return; // Don't navigate
      }
      
      // Check if it's a non-2xx status code error
      const isNon2xxError = error instanceof Error && 
        (error.message.includes('non-2xx status code') || 
         error.message.includes('FunctionsHttpError'));
      
      if (isNon2xxError) {
        // Show error message for 2 seconds
        this.errorCallback?.('Sorry, try again later');
        
        // Wait 2 seconds before hiding error and staying on current page
        setTimeout(() => {
          this.errorCallback?.(null);
          this.loadingCallback?.(false);
          this.isProcessing = false;
          this.currentAbortController = null;
          // Don't navigate - stay on current page
        }, 2000);
      } else {
        // For other errors, just navigate normally
        this.loadingCallback?.(false);
        router.push(params);
        this.isProcessing = false;
        this.currentAbortController = null;
      }
    } finally {
      this.currentAbortController = null;
    }
  }

  /**
   * Navigate to legislation profile with pre-processing
   */
  static async navigateToLegislationProfile(params: NavigationParams, userId?: string): Promise<void> {
    if (this.isProcessing) {
      console.log('Already processing a profile, ignoring navigation request');
      return;
    }

    // Create abort controller for this operation
    this.currentAbortController = new AbortController();

    try {
      this.isProcessing = true;
      
      // Extract legislation ID from params with validation
      const indexParam = params.params?.index;
      if (!indexParam || (typeof indexParam !== 'string' && typeof indexParam !== 'number')) {
        console.error('Invalid or missing legislation ID:', indexParam);
        // Navigate anyway with invalid ID
        router.push(params);
        this.isProcessing = false;
        return;
      }
      
      const legislationId = typeof indexParam === 'string' ? parseInt(indexParam, 10) : Math.floor(Number(indexParam));
      if (isNaN(legislationId) || legislationId <= 0) {
        console.error('Invalid legislation ID (not a valid number):', indexParam);
        // Navigate anyway with invalid ID
        router.push(params);
        this.isProcessing = false;
        return;
      }

      // Check if cancelled
      if (this.currentAbortController?.signal.aborted) {
        throw new Error('CANCELLED');
      }

      // ✅ STEP 1: Get userId if not provided, then check access FIRST (before any processing)
      let finalUserId = userId;
      
      // If userId not provided, try to get it from Supabase session
      if (!finalUserId) {
        console.log('[NavigationService] userId not provided, attempting to get from session...');
        try {
          const { data: { session } } = await getSupabaseClient().auth.getSession();
          finalUserId = session?.user?.id;
          if (finalUserId) {
            console.log('[NavigationService] Successfully retrieved userId from session:', finalUserId);
          } else {
            console.warn('[NavigationService] No userId found in session - profile tracking will be skipped');
          }
        } catch (error) {
          console.error('[NavigationService] Error getting userId from session:', error);
        }
      } else {
        console.log('[NavigationService] userId provided:', finalUserId);
      }

      // Only check access if we have a userId
      if (finalUserId) {
        console.log('[NavigationService] Checking profile access before processing:', { legislationId, userId: finalUserId });
        this.loadingCallback?.(true);
        
        try {
          const accessCheck = await checkProfileAccess(finalUserId, `${legislationId}legi`);
          
          // Check if cancelled after async operation
          if (this.currentAbortController?.signal.aborted) {
            throw new Error('CANCELLED');
          }
          
          console.log('[NavigationService] Access check result:', {
            allowed: accessCheck.allowed,
            profilesUsed: accessCheck.profilesUsed,
            reason: accessCheck.reason,
            error: accessCheck.error
          });
          
          this.loadingCallback?.(false);
          
          if (!accessCheck.allowed) {
            console.log('[NavigationService] Profile access denied, preventing processing and navigation');
            
            // Show access denied alert with upgrade option
            Alert.alert(
              'Weekly Profile Limit Reached',
              `You've reached your weekly limit for new profiles, come back Sunday.\n\nCheck your history to revisit authorized profiles or upgrade to Execudex Plus for unlimited access.`,
              [
                {
                  text: 'Upgrade Now',
                  onPress: () => {
                    router.push('/subscription');
                  },
                },
                {
                  text: 'OK',
                },
              ],
              { cancelable: false }
            );
            
            this.isProcessing = false;
            return; // Stop completely - no processing, no navigation
          }
          
          // Show warning if user is running low on profiles (2 or 1 remaining)
          if (accessCheck.showWarning && accessCheck.remainingProfiles !== undefined) {
            const remaining = accessCheck.remainingProfiles;
            Alert.alert(
              'Profile Limit Warning',
              `You have ${remaining} profile${remaining === 1 ? '' : 's'} remaining this week. Your limit resets on Sunday.`,
              [{ text: 'OK' }]
            );
          }
          
          console.log('[NavigationService] Profile access granted, proceeding with processing');
        } catch (error) {
          console.error('[NavigationService] Error during access check:', error);
          this.loadingCallback?.(false);
          // Continue with processing even if access check fails (graceful degradation)
          console.warn('[NavigationService] Continuing despite access check error');
        }
      } else {
        console.warn('[NavigationService] No userId available - skipping profile access check and tracking');
      }

      // ✅ STEP 2: Execute profile processing (only if access granted)
      console.log('Starting profile processing for legislation:', legislationId);
      
      // Always show loading indicator (even for already-indexed profiles)
      // This ensures users see feedback even when profiles should load instantly
      this.loadingCallback?.(true);
      
      // Execute legislation profile checks and scripts BEFORE navigation
      const result = await LegislationProfileService.handleProfileOpen(legislationId);
      
      // Check if cancelled after processing
      if (this.currentAbortController?.signal.aborted) {
        throw new Error('CANCELLED');
      }
      
      console.log('Legislation profile processing completed, prefetching profile data');
      
      // ✅ STEP 3: Prefetch profile data to avoid "No Data Available" flash
      try {
        const supabase = getSupabaseClient();
        const { data: profileData } = await supabase
          .from('legi_profiles')
          .select('overview, agenda, impact')
          .eq('owner_id', legislationId)
          .maybeSingle();
        
        // Add prefetched data to params if available
        if (profileData) {
          console.log('Successfully prefetched legislation profile data');
          params.params.prefetchedProfileData = JSON.stringify(profileData);
        }
      } catch (error) {
        console.warn('Failed to prefetch legislation profile data, will load on page:', error);
        // Continue without prefetched data - page will fetch it
      }
      
      // Check for low materiality result
      if (result?.isLowMateriality) {
        console.log('Low materiality detected, informing UI');
        this.lowMaterialityCallback?.(true, result.suggestUI);
      } else {
        this.lowMaterialityCallback?.(false);
      }
      
      // Navigate after processing is complete
      router.push(params);
      
      // Hide loading indicator after navigation (small delay to ensure smooth transition)
      setTimeout(() => {
        this.loadingCallback?.(false);
      }, 100);
      
      // Add to history after successful navigation
      await addToHistory({
        id: legislationId.toString(),
        name: params.params.title || 'Unknown Legislation',
        sub_name: params.params.subtitle || 'Unknown',
        is_ppl: false,
      }, userId);
      
      this.isProcessing = false;
      
    } catch (error: any) {
      console.error('Error in legislation profile pre-processing:', error);
      
      // Check if error is due to cancellation
      if (error?.message === 'CANCELLED' || this.currentAbortController?.signal.aborted) {
        console.log('Legislation profile processing was cancelled');
        this.loadingCallback?.(false);
        this.errorCallback?.(null);
        this.isProcessing = false;
        this.currentAbortController = null;
        return; // Don't navigate
      }
      
      // Check if it's a non-2xx status code error
      const isNon2xxError = error instanceof Error && 
        (error.message.includes('non-2xx status code') || 
         error.message.includes('FunctionsHttpError'));
      
      if (isNon2xxError) {
        // Show error message for 2 seconds
        this.errorCallback?.('Sorry, try again later');
        
        // Wait 2 seconds before hiding error and staying on current page
        setTimeout(() => {
          this.errorCallback?.(null);
          this.loadingCallback?.(false);
          this.isProcessing = false;
          this.currentAbortController = null;
          // Don't navigate - stay on current page
        }, 2000);
      } else {
        // For other errors, just navigate normally
        this.loadingCallback?.(false);
        router.push(params);
        this.isProcessing = false;
        this.currentAbortController = null;
      }
    } finally {
      this.currentAbortController = null;
    }
  }

  /**
   * Navigate to any other page (no pre-processing)
   */
  static navigateToPage(params: NavigationParams): void {
    router.push(params);
  }

  /**
   * Check if currently processing a profile
   */
  static isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}
