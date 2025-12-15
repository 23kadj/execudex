import { logDiag, logDiagError } from '../lib/diag/logger';
import { getSupabaseClient } from '../utils/supabase';
import { ProfileLockService } from './profileLockService';

interface PPLIndex {
  id: number;
  name: string | null;
  sub_name: string | null;
  tier: string | null;
  indexed: boolean | null;
}

interface PPLProfile {
  index_id: number;
  synopsis: string | null;
  updated_at: string | null;
}

interface ProfileCheckResult {
  shouldProceed: boolean;
  needsIndexing: boolean;
  needsSynopsis: boolean;
  needsMetrics: boolean;
  indexData?: PPLIndex;
  profileData?: PPLProfile;
}

interface ProgressEvent {
  script: string;
  progress?: number;
  completed?: boolean;
}

type ProgressCallback = (event: ProgressEvent) => void;

export class PoliticianProfileService {
  /**
   * Main function to process politician profile (NEW SIMPLIFIED FLOW)
   */
  static async handleProfileOpen(politicianId: number, onProgress?: ProgressCallback, trace?: string): Promise<void> {
    try {
      console.log(`Starting profile processing for politician ID: ${politicianId}`);
      logDiag('svc:handleProfileOpen:start', { politicianId }, trace);
      
      // STEP 1: Check ppl_profiles table and indexed status
      const step1Result = await this.executeStep1_CheckProfileAndMetrics(politicianId, onProgress, trace);
      
      if (step1Result.shouldStop) {
        console.log('Profile is already indexed - skipping processing');
        logDiag('svc:already-indexed:stop-step1', { politicianId }, trace);
        return; // Stop - profile is already indexed and can be opened
      }
      
      if (step1Result.skipToStep3) {
        console.log('No profile row found - already ran metrics + profile_index, skipping to synopsis');
        logDiag('svc:no-profile-row:skip-to-step3', { politicianId }, trace);
        // Skip Step 2, go directly to Step 3
        await this.executeStep3_CheckSynopsis(politicianId, onProgress, trace);
        await this.executeStep4_MarkIndexed(politicianId, trace);
        return;
      }
      
      // STEP 2: Check indexed status and run profile_index if needed
      const shouldContinue = await this.executeStep2_CheckIndexed(politicianId, onProgress, trace);
      
      if (!shouldContinue) {
        console.log('Profile already indexed - opening profile');
        logDiag('svc:already-indexed:stop', { politicianId }, trace);
        return; // Profile already processed
      }
      
      // STEP 3: Check synopsis and run ppl_synopsis if needed
      await this.executeStep3_CheckSynopsis(politicianId, onProgress, trace);
      
      // STEP 4: Mark as indexed
      await this.executeStep4_MarkIndexed(politicianId, trace);
      
      console.log('Profile processing completed successfully for politician ID:', politicianId);
      logDiag('svc:handleProfileOpen:complete', { politicianId }, trace);
      
    } catch (error) {
      console.error('Error in handleProfileOpen:', error);
      logDiagError('svc:handleProfileOpen:error', error, trace);
      throw error;
    }
  }

  /**
   * STEP 1: Check ppl_profiles table, indexed status, and ensure data exists
   * Logic: Only skip if indexed=true. If indexed=false/null, ensure ppl_profiles data exists.
   * Weak flag alone does not stop processing - only weak AND indexed together can skip.
   */
  private static async executeStep1_CheckProfileAndMetrics(
    politicianId: number, 
    onProgress?: ProgressCallback,
    trace?: string
  ): Promise<{ shouldStop: boolean; skipToStep3: boolean }> {
    try {
      console.log('STEP 1: Checking ppl_profiles and indexed status');
      logDiag('svc:step1:start', { politicianId }, trace);
      
      // Check indexed and weak flags (from ppl_index)
      const supabase = getSupabaseClient();
      const { data: indexData, error: indexError } = await supabase
        .from('ppl_index')
        .select('indexed, weak')
        .eq('id', politicianId)
        .maybeSingle();
      
      if (indexError) {
        console.error('Error checking indexed status:', indexError);
        logDiagError('svc:step1:index-error', indexError, trace);
        // Continue processing on error
      }
      
      // If indexed = true, we can skip processing (regardless of weak status)
      // This allows weak profiles with indexed=true to be opened without processing
      if (indexData?.indexed === true) {
        console.log('Profile is already indexed - can skip processing');
        logDiag('svc:step1:already-indexed', { politicianId, weak: indexData.weak }, trace);
        return { shouldStop: true, skipToStep3: false };
      }
      
      // indexed is false/null - must ensure data exists in ppl_profiles
      // Check if profile row exists in ppl_profiles
      const { data: profileData, error: profileError } = await supabase
        .from('ppl_profiles')
        .select('index_id, updated_at')
        .eq('index_id', politicianId)
        .maybeSingle();
      
      // Scenario: Row exists - continue processing
      if (profileData) {
        console.log('Profile row found in ppl_profiles - continuing processing');
        logDiag('svc:step1:profile-exists', { politicianId, updated_at: profileData.updated_at, weak: indexData?.weak }, trace);
        
        // Metrics are now only generated manually via UI button
        // No automatic metrics refresh during profile processing
        
        return { shouldStop: false, skipToStep3: false };
      }
      
      // Scenario: Row doesn't exist - must ensure it exists before proceeding
      // Even if weak=true, we need to ensure ppl_profiles data exists (unless indexed=true)
      console.log('No profile row found in ppl_profiles - running profile_index to ensure data exists');
      logDiag('svc:step1:no-profile-row', { politicianId, weak: indexData?.weak }, trace);
      
      // Run profile_index to create the profile row
      await this.executeProfileIndex(politicianId, onProgress, trace);
      
      // After profile_index, skip to Step 3 (skip indexed check since we just ran profile_index)
      return { shouldStop: false, skipToStep3: true };
      
    } catch (error) {
      console.error('Error in Step 1:', error);
      logDiagError('svc:step1:error', error, trace);
      return { shouldStop: false, skipToStep3: false };
    }
  }

  /**
   * STEP 2: Check indexed status and run profile_index if needed
   * Returns: true to continue processing, false to stop
   */
  private static async executeStep2_CheckIndexed(
    politicianId: number,
    onProgress?: ProgressCallback,
    trace?: string
  ): Promise<boolean> {
    try {
      console.log('STEP 2: Checking indexed status');
      logDiag('svc:step2:start', { politicianId }, trace);
      
      const supabase = getSupabaseClient();
      const { data: indexData, error: indexError } = await supabase
        .from('ppl_index')
        .select('indexed')
        .eq('id', politicianId)
        .maybeSingle();
      
      if (indexError) {
        console.error('Error checking indexed status:', indexError);
        logDiagError('svc:step2:error', indexError, trace);
        // Continue processing on error
        return true;
      }
      
      // If indexed = true, stop processing
      if (indexData?.indexed === true) {
        console.log('Profile already indexed - stopping');
        logDiag('svc:step2:already-indexed', { politicianId }, trace);
        return false;
      }
      
      // indexed is false or NULL - run profile_index
      console.log('Profile not indexed - running profile_index');
      logDiag('svc:step2:running-profile-index', { politicianId, currentIndexed: indexData?.indexed }, trace);
      
      await this.executeProfileIndex(politicianId, onProgress, trace);
      
      return true; // Continue to Step 3
      
    } catch (error) {
      console.error('Error in Step 2:', error);
      logDiagError('svc:step2:exception', error, trace);
      return true; // Continue on error
    }
  }

  /**
   * STEP 3: Check synopsis and run ppl_synopsis if needed
   */
  private static async executeStep3_CheckSynopsis(
    politicianId: number,
    onProgress?: ProgressCallback,
    trace?: string
  ): Promise<void> {
    try {
      console.log('STEP 3: Checking synopsis');
      logDiag('svc:step3:start', { politicianId }, trace);
      
      // Check indexed status first - if true, don't run profile_index even if synopsis fails
      const supabase = getSupabaseClient();
      const { data: indexData, error: indexError } = await supabase
        .from('ppl_index')
        .select('indexed')
        .eq('id', politicianId)
        .maybeSingle();
      
      const isIndexed = indexData?.indexed === true;
      
      const { data: profileData, error: profileError } = await supabase
        .from('ppl_profiles')
        .select('synopsis')
        .eq('index_id', politicianId)
        .maybeSingle();
      
      const synopsis = profileData?.synopsis;
      const needsSynopsis = !synopsis || synopsis.trim() === '' || synopsis.toLowerCase().includes('no data');
      
      if (!needsSynopsis) {
        console.log('Synopsis already exists - skipping');
        logDiag('svc:step3:synopsis-exists', { politicianId }, trace);
        return;
      }
      
      console.log('Synopsis missing or invalid - running ppl_synopsis');
      logDiag('svc:step3:running-synopsis', { politicianId }, trace);
      
      // Run ppl_synopsis
      const synopsisResult = await this.executeSynopsis(politicianId, onProgress, trace);
      
      // Check response body for "no source data available"
      if (synopsisResult && synopsisResult.includes('no source data')) {
        // Only run profile_index if indexed is false or NULL
        // If indexed=true, just grant access (don't risk marking profile as weak)
        if (isIndexed) {
          console.log('Synopsis returned "no source data" but profile is already indexed - granting access without re-running profile_index');
          logDiag('svc:step3:no-source-data-but-indexed', { politicianId }, trace);
          return; // Grant access, don't risk marking as weak
        }
        
        console.log('Synopsis returned "no source data" - re-running profile_index then synopsis');
        logDiag('svc:step3:no-source-data', { politicianId }, trace);
        
        // Run profile_index again (only if not already indexed)
        await this.executeProfileIndex(politicianId, onProgress, trace);
        
        // Run synopsis again (second attempt)
        console.log('Re-running synopsis after profile_index');
        logDiag('svc:step3:retry-synopsis', { politicianId }, trace);
        await this.executeSynopsis(politicianId, onProgress, trace);
      }
      
    } catch (error) {
      console.error('Error in Step 3:', error);
      logDiagError('svc:step3:exception', error, trace);
      // Don't throw - allow process to continue
    }
  }

  /**
   * STEP 4: Mark profile as indexed
   */
  private static async executeStep4_MarkIndexed(
    politicianId: number,
    trace?: string
  ): Promise<void> {
    try {
      console.log('STEP 4: Marking profile as indexed');
      logDiag('svc:step4:start', { politicianId }, trace);
      
      // Mark as indexed
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('ppl_index')
        .update({ indexed: true })
        .eq('id', politicianId);
      
      if (error) {
        console.error('Error marking profile as indexed:', error);
        logDiagError('svc:step4:error', error, trace);
      } else {
        console.log('Profile marked as indexed successfully');
        logDiag('svc:step4:success', { politicianId }, trace);
      }
      
    } catch (error) {
      console.error('Error in Step 4:', error);
      logDiagError('svc:step4:exception', error, trace);
    }
  }

  /**
   * Check for storage files in ppl/{id}/ folder containing "profile"
   * NOTE: This is now DEPRECATED - kept for backward compatibility only
   */
  private static async checkStorageFiles(politicianId: number): Promise<boolean> {
    try {
      const { data, error } = await getSupabaseClient().storage
        .from('web')
        .list(`ppl/${politicianId}`, { limit: 100 });

      if (error) {
        console.warn('Error checking storage files:', error);
        return false;
      }

      if (!data || data.length === 0) {
        console.log(`No files found in ppl/${politicianId}/ folder`);
        return false;
      }

      // Check if any file contains "profile" in the name
      const hasProfileFile = data.some(file => 
        file.name.toLowerCase().includes('profile')
      );

      console.log(`Storage check for politician ${politicianId}: ${hasProfileFile ? 'found profile files' : 'no profile files'}`);
      return hasProfileFile;
    } catch (error) {
      console.error('Error in checkStorageFiles:', error);
      return false;
    }
  }

  /**
   * Check if content is "No Data" or similar placeholder text
   */
  private static isNoDataContent(content: string | null | undefined): boolean {
    if (!content) return true;
    
    const normalizedContent = content.trim().toLowerCase();
    const noDataPatterns = [
      'no data',
      'no information',
      'not available',
      'n/a',
      'tbd',
      'to be determined',
      'pending',
      'coming soon'
    ];
    
    return noDataPatterns.some(pattern => normalizedContent.includes(pattern));
  }

  /**
   * Handle profile checks and execute necessary scripts
   */
  private static async handleProfileChecks(politicianId: number, checkResult: ProfileCheckResult, onProgress?: ProgressCallback): Promise<void> {
    try {
      // Check ppl_profiles table
      const supabase = getSupabaseClient();
      const { data: profileData, error: profileError } = await supabase
        .from('ppl_profiles')
        .select('index_id, synopsis, updated_at')
        .eq('index_id', politicianId)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile data:', profileError);
        return;
      }

      const hasProfile = !!profileData;
      const hasSynopsis = !!(profileData?.synopsis);
      const synopsisIsValid = hasSynopsis && !this.isNoDataContent(profileData?.synopsis);

      console.log('Profile check result:', {
        hasProfile,
        hasSynopsis,
        synopsisIsValid,
        profileData
      });

      // Check if profile has cards in card_index table
      const hasCards = await this.checkForCards(politicianId);
      
      console.log('Profile check result:', {
        hasProfile,
        hasSynopsis,
        hasCards,
        profileData
      });
      
      // Quick check: if profile has synopsis, recent metrics, and cards, skip processing
      if (hasProfile && synopsisIsValid && hasCards && !this.needsMetricsUpdate(profileData)) {
        console.log('Profile is complete and up-to-date, skipping processing');
        return;
      }

      // Determine which steps to execute
      const needsStep2 = !hasProfile || !synopsisIsValid;

      // Execute steps in parallel where possible
      const promises: Promise<void>[] = [];

      // Step 2: ppl_synopsis (if needed)
      if (needsStep2) {
        console.log('Executing Step 2: ppl_synopsis');
        promises.push(this.executeStep2(politicianId, onProgress));
      } else {
        console.log('Step 2 skipped: synopsis already exists');
      }

      // Step 3: ppl_metrics - REMOVED (now manual only via UI button)
      console.log('Step 3 skipped: metrics are now generated manually only');

      // Wait for Step 2 to complete
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      // Mark as indexed after Step 3 completion
      await this.markProfileAsIndexed(politicianId);

      // Final step: Check if profile should be locked and mark as weak if needed
      await this.checkAndApplyProfileLock(politicianId);

      console.log('Profile processing completed successfully - Steps 4 and 5 skipped');
    } catch (error) {
      console.error('Error in handleProfileChecks:', error);
      throw error;
    }
  }

  /**
   * Final step: Check if profile should be locked and mark as weak if needed
   */
  private static async checkAndApplyProfileLock(politicianId: number): Promise<void> {
    try {
      // Check if profile should be locked
      const lockStatus = await ProfileLockService.checkProfileLockStatus(politicianId, true);
      
      if (lockStatus.isLocked && lockStatus.lockReason === 'no_cards') {
        // Mark profile as weak if it has no cards
        const supabase = getSupabaseClient();
        const { error } = await supabase
          .from('ppl_index')
          .update({ weak: true })
          .eq('id', politicianId);

        if (error) {
          console.warn(`Failed to mark politician ${politicianId} as weak:`, error);
        } else {
          console.log(`Politician ${politicianId} marked as weak due to no cards`);
        }
      }
    } catch (error) {
      console.error(`Error checking profile lock for politician ${politicianId}:`, error);
    }
  }

  /**
   * Mark profile as indexed after Step 3 completion
   */
  private static async markProfileAsIndexed(politicianId: number): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('ppl_index')
        .update({ indexed: true })
        .eq('id', politicianId);

      if (error) {
        console.warn(`Failed to mark profile as indexed for politician ID ${politicianId}:`, error);
      } else {
        console.log(`Profile marked as indexed for politician ID ${politicianId}`);
      }
    } catch (error) {
      console.error(`Error marking profile as indexed for politician ID ${politicianId}:`, error);
    }
  }

  /**
   * Check if metrics need update based on updated_at date
   */
  private static needsMetricsUpdate(profileData: PPLProfile | null): boolean {
    if (!profileData?.updated_at) {
      return true;
    }

    const lastUpdate = new Date(profileData.updated_at);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return lastUpdate < sevenDaysAgo;
  }

  /**
   * Check if politician has cards in card_index table
   */
  private static async checkForCards(politicianId: number): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('card_index')
        .select('id')
        .eq('owner_id', politicianId)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('Error checking for cards:', error);
        return false;
      }

      const hasCards = data && data.length > 0;
      console.log(`Card check for politician ${politicianId}: ${hasCards ? 'has cards' : 'no cards'}`);
      return hasCards;
    } catch (error) {
      console.error('Error in checkForCards:', error);
      return false;
    }
  }

  /**
   * Step 1: Execute profile_index script only if tier is missing
   */
  private static async executeStep1IfNeeded(politicianId: number, onProgress?: ProgressCallback): Promise<void> {
    try {
      // Check if tier is already present
      const supabase = getSupabaseClient();
      const { data: indexData, error: indexError } = await supabase
        .from('ppl_index')
        .select('tier')
        .eq('id', politicianId)
        .maybeSingle();

      if (indexError) {
        console.error('Error checking tier for politician ID:', politicianId, indexError);
        throw indexError;
      }

      if (indexData?.tier) {
        console.log(`Tier already exists for politician ID ${politicianId}: ${indexData.tier}, skipping profile_index`);
        return;
      }

      console.log(`Tier missing for politician ID ${politicianId}, executing profile_index`);
      await this.executeStep1(politicianId, onProgress);
    } catch (error) {
      console.error('Error in executeStep1IfNeeded:', error);
      throw error;
    }
  }

  /**
   * Step 1: Execute profile_index script
   */
  private static async executeStep1(politicianId: number, onProgress?: ProgressCallback): Promise<void> {
    try {
      console.log(`Executing Step 1: profile_index for ID ${politicianId}`);
      onProgress?.({ script: 'Indexing profile...' });
      
      const { data, error } = await getSupabaseClient().functions.invoke('profile_index', {
        body: {
          id: politicianId,
          is_ppl: true
        }
      });

      if (error) {
        console.error('Error in Step 1 (profile_index):', error);
        throw error;
      }

      console.log('Step 1 completed successfully:', data);
      onProgress?.({ script: 'Indexing profile...', completed: true });
    } catch (error) {
      console.error('Error executing Step 1:', error);
      throw error;
    }
  }

  /**
   * Step 2: Execute ppl_synopsis script
   */
  private static async executeStep2(politicianId: number, onProgress?: ProgressCallback): Promise<void> {
    try {
      console.log(`Executing Step 2: ppl_synopsis for ID ${politicianId}`);
      onProgress?.({ script: 'Gathering sources...' });
      
      const { data, error } = await getSupabaseClient().functions.invoke('ppl_synopsis', {
        body: {
          id: politicianId
        }
      });

      if (error) {
        console.error('Error in Step 2 (ppl_synopsis):', error);
        throw error;
      }

      console.log('Step 2 completed successfully:', data);
      onProgress?.({ script: 'Gathering sources...', completed: true });
    } catch (error) {
      console.error('Error executing Step 2:', error);
      throw error;
    }
  }

  /**
   * Step 3: Execute ppl_metrics script
   */
  private static async executeStep3(politicianId: number, onProgress?: ProgressCallback): Promise<void> {
    try {
      console.log(`Executing Step 3: ppl_metrics for ID ${politicianId}`);
      onProgress?.({ script: 'Searching for polling information...' });
      
      const { data, error } = await getSupabaseClient().functions.invoke('ppl_metrics', {
        body: {
          id: politicianId
        }
      });

      if (error) {
        console.error('Error in Step 3 (ppl_metrics):', error);
        throw error;
      }

      console.log('Step 3 completed successfully:', data);
      onProgress?.({ script: 'Searching for polling information...', completed: true });
    } catch (error) {
      console.error('Error executing Step 3:', error);
      throw error;
    }
  }


  /**
   * Execute profile_index Edge function
   */
  private static async executeProfileIndex(
    politicianId: number,
    onProgress?: ProgressCallback,
    trace?: string
  ): Promise<void> {
    try {
      console.log(`Executing profile_index for ID ${politicianId}`);
      logDiag('svc:profile-index:start', { politicianId }, trace);
      onProgress?.({ script: 'Indexing profile...' });
      
      const { data, error } = await getSupabaseClient().functions.invoke('profile_index', {
        body: {
          id: politicianId,
          is_ppl: true
        }
      });

      // DETAILED LOGGING: Log full response for debugging
      console.log('===== PROFILE_INDEX FULL RESPONSE =====');
      console.log('Politician ID:', politicianId);
      console.log('Error:', error ? JSON.stringify(error, null, 2) : 'None');
      console.log('Data:', data ? JSON.stringify(data, null, 2) : 'None');
      console.log('=======================================');

      if (error) {
        console.error('Error in profile_index:', error);
        logDiagError('svc:profile-index:error', error, trace);
        throw error;
      }

      console.log('profile_index completed successfully');
      logDiag('svc:profile-index:success', { politicianId, responseData: data }, trace);
      onProgress?.({ script: 'Indexing profile...', completed: true });
    } catch (error) {
      console.error('Error executing profile_index:', error);
      logDiagError('svc:profile-index:exception', error, trace);
      throw error;
    }
  }

  /**
   * Execute ppl_synopsis Edge function and return response text
   */
  private static async executeSynopsis(
    politicianId: number,
    onProgress?: ProgressCallback,
    trace?: string
  ): Promise<string | null> {
    try {
      console.log(`Executing ppl_synopsis for ID ${politicianId}`);
      logDiag('svc:synopsis:start', { politicianId }, trace);
      onProgress?.({ script: 'Gathering sources...' });
      
      const { data, error } = await getSupabaseClient().functions.invoke('ppl_synopsis', {
        body: {
          id: politicianId
        }
      });

      // DETAILED LOGGING: Log full response for debugging
      console.log('===== PPL_SYNOPSIS FULL RESPONSE =====');
      console.log('Politician ID:', politicianId);
      console.log('Error:', error ? JSON.stringify(error, null, 2) : 'None');
      console.log('Data:', data ? JSON.stringify(data, null, 2) : 'None');
      console.log('======================================');

      if (error) {
        console.error('Error in ppl_synopsis:', error);
        logDiagError('svc:synopsis:error', error, trace);
        throw error;
      }

      console.log('ppl_synopsis completed successfully');
      logDiag('svc:synopsis:success', { politicianId, responseData: data }, trace);
      onProgress?.({ script: 'Gathering sources...', completed: true });
      
      // Return response as string to check for "no source data"
      return JSON.stringify(data);
    } catch (error) {
      console.error('Error executing ppl_synopsis:', error);
      logDiagError('svc:synopsis:exception', error, trace);
      throw error;
    }
  }

  /**
   * Execute ppl_metrics Edge function
   */
  private static async executeMetrics(
    politicianId: number,
    onProgress?: ProgressCallback,
    trace?: string
  ): Promise<void> {
    try {
      console.log(`Executing ppl_metrics for ID ${politicianId}`);
      logDiag('svc:metrics:start', { politicianId }, trace);
      onProgress?.({ script: 'Searching for polling information...' });
      
      const { data, error } = await getSupabaseClient().functions.invoke('ppl_metrics', {
        body: {
          id: politicianId
        }
      });

      if (error) {
        console.error('Error in ppl_metrics:', error);
        logDiagError('svc:metrics:error', error, trace);
        // Don't throw - metrics failure shouldn't stop processing
        return;
      }

      console.log('ppl_metrics completed successfully:', data);
      logDiag('svc:metrics:success', { politicianId }, trace);
      onProgress?.({ script: 'Searching for polling information...', completed: true });
    } catch (error) {
      console.error('Error executing ppl_metrics:', error);
      logDiagError('svc:metrics:exception', error, trace);
      // Don't throw - allow process to continue
    }
  }

  /**
   * Generate metrics manually (called from UI button)
   * Only runs if:
   * 1. First-time generation (no existing metrics), OR
   * 2. updated_at is older than 21 days AND at least one of approval/disapproval/votes has a value
   */
  static async generateMetricsManually(
    politicianId: number,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      // Fetch current profile data
      const supabase = getSupabaseClient();
      const { data: profileData, error: profileError } = await supabase
        .from('ppl_profiles')
        .select('index_id, approval, disapproval, votes, updated_at')
        .eq('index_id', politicianId)
        .maybeSingle();

      if (profileError) {
        return { success: false, message: 'Profile not found' };
      }

      // Check if profile has any existing metric values
      const hasExistingMetrics = 
        profileData.approval != null || 
        profileData.disapproval != null || 
        profileData.votes != null;

      // If no existing metrics, always allow (first-time generation)
      if (!hasExistingMetrics) {
        console.log('First-time metrics generation - proceeding');
      } else {
        // Has existing metrics - check if updated_at is older than 21 days
        if (!profileData.updated_at) {
          return { 
            success: false, 
            message: 'Metrics exist but no update timestamp found' 
          };
        }

        const lastUpdate = new Date(profileData.updated_at);
        const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
        
        if (lastUpdate >= twentyOneDaysAgo) {
          // Updated within last 21 days - don't allow
          return { 
            success: false, 
            message: 'Metrics were recently updated. Please wait 21 days between updates.' 
          };
        }

        console.log('Metrics older than 21 days - proceeding with refresh');
      }

      // Call ppl_metrics Edge Function
      console.log(`Generating metrics manually for politician ${politicianId}`);
      onProgress?.({ script: 'Searching for polling information...' });
      
      const { data, error } = await getSupabaseClient().functions.invoke('ppl_metrics', {
        body: { id: politicianId }
      });

      if (error) {
        console.error('Error calling ppl_metrics:', error);
        return { success: false, message: 'Failed to generate metrics', data: error };
      }

      onProgress?.({ script: 'Searching for polling information...', completed: true });

      // Check if response indicates success or "No Data"
      const outcome = data?.outcome;
      const foundAny = outcome?.found_any;

      if (foundAny) {
        console.log('Metrics generated successfully');
        return { success: true, data };
      } else {
        console.log('No polling data found');
        return { success: false, message: 'No polling data found for this politician', data };
      }

    } catch (error) {
      console.error('Error generating metrics manually:', error);
      return { success: false, message: 'An error occurred while generating metrics' };
    }
  }

  /**
   * Get profile status for debugging
   */
  static async getProfileStatus(politicianId: number): Promise<{
    indexData: PPLIndex | null;
    profileData: PPLProfile | null;
  }> {
    const supabase = getSupabaseClient();
    const { data: indexData } = await supabase
      .from('ppl_index')
      .select('id, name, sub_name, tier, indexed')
      .eq('id', politicianId)
      .maybeSingle();
    
    const { data: profileData } = await supabase
      .from('ppl_profiles')
      .select('index_id, synopsis, updated_at')
      .eq('index_id', politicianId)
      .single();

    return {
      indexData: indexData || null,
      profileData: profileData || null
    };
  }
}
