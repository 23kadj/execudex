import { getSupabaseClient } from '../utils/supabase';
import { ProfileLockService } from './profileLockService';

interface LegiIndex {
  id: number;
  name: string | null;
  sub_name: string | null;
  indexed: boolean | null;
  weak?: boolean | null;
}

interface LegiProfile {
  owner_id: number;
  overview: string | null;
}

interface ProfileCheckResult {
  shouldProceed: boolean;
  needsIndexing: boolean;
  needsOverview: boolean;
  needsCards: boolean;
  isLowMateriality?: boolean;
  suggestUI?: any;
  indexData?: LegiIndex;
  profileData?: LegiProfile;
}

interface ProgressEvent {
  script: string;
  progress?: number;
  completed?: boolean;
}

type ProgressCallback = (event: ProgressEvent) => void;

export class LegislationProfileService {
  /**
   * Main function to check legislation profile and execute necessary scripts
   */
  static async handleProfileOpen(legislationId: number, onProgress?: ProgressCallback): Promise<{isLowMateriality?: boolean, suggestUI?: any}> {
    try {
      console.log(`Starting profile check for legislation ID: ${legislationId}`);
      
      // Step 1: Check index validation
      const checkResult = await this.checkProfileValidation(legislationId);
      
      // If indexed=true and has required fields, can skip processing
      if (checkResult.shouldProceed) {
        console.log('Profile is already indexed - skipping processing');
        return { isLowMateriality: false }; // End processing entirely - profile is ready
      }
      
      // indexed is false/null - must ensure data exists
      console.log('Profile validation: indexed is false/null, ensuring data exists in legi_profiles');
      
      // Step 2: Check if profile_index is needed (for storage files and required fields)
      if (checkResult.needsIndexing) {
        console.log('Profile index needed, executing profile_index');
        await this.executeStep1IfNeeded(legislationId, onProgress);
      }
      
      // Step 3: Always check and ensure profile data exists in legi_profiles
      // This ensures weak profiles without profile data get processed
      await this.handleProfileChecks(legislationId, checkResult, onProgress);
      
      // Return low materiality result if detected
      if (checkResult.isLowMateriality) {
        return {
          isLowMateriality: true,
          suggestUI: checkResult.suggestUI
        };
      }
      
      return { isLowMateriality: false };
    } catch (error) {
      console.error('Error in handleProfileOpen:', error);
      throw error;
    }
  }

  /**
   * Check if profile meets validation criteria
   * Logic: Only skip if indexed=true. If indexed=false/null, ensure legi_profiles data exists.
   * Weak flag alone does not stop processing - only weak AND indexed together can skip.
   */
  private static async checkProfileValidation(legislationId: number): Promise<ProfileCheckResult> {
    try {
      // Step 1: Fetch index data (including indexed and weak flags)
      const supabase = getSupabaseClient();
      const { data: indexData, error: indexError } = await supabase
        .from('legi_index')
        .select('id, name, sub_name, bill_lvl, indexed, weak')
        .eq('id', legislationId)
        .single();

      if (indexError) {
        console.error('Error fetching index data:', indexError);
        return {
          shouldProceed: false,
          needsIndexing: true,
          needsOverview: false,
          needsCards: false
        };
      }

      if (!indexData) {
        console.log('No index data found for legislation ID:', legislationId);
        return {
          shouldProceed: false,
          needsIndexing: true,
          needsOverview: false,
          needsCards: false
        };
      }

      // Step 2: If indexed = true, we can skip processing (regardless of weak status)
      // This allows weak profiles with indexed=true to be opened without processing
      const isIndexed = indexData.indexed === true;
      if (isIndexed) {
        console.log('Profile is already indexed - can skip processing');
        const hasRequiredFields = !!(
          indexData.name && 
          indexData.sub_name &&
          indexData.bill_lvl
        );
        return {
          shouldProceed: hasRequiredFields, // Only proceed if has required fields too
          needsIndexing: false,
          needsOverview: false,
          needsCards: false,
          indexData
        };
      }

      // Step 3: indexed is false/null - must ensure data exists in legi_profiles
      // Check if profile row exists in legi_profiles
      const { data: profileData, error: profileError } = await supabase
        .from('legi_profiles')
        .select('owner_id, overview')
        .eq('owner_id', legislationId)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile data:', profileError);
        // Continue processing on error (will be handled in handleProfileChecks)
      }

      const hasProfile = !!profileData;
      
      // Step 4: Check for storage files (required for profile_index if needed)
      const hasStorageFiles = await this.checkStorageFiles(legislationId);

      // Step 5: Check validation conditions
      const hasRequiredFields = !!(
        indexData.name && 
        indexData.sub_name &&
        indexData.bill_lvl
      );

      // If indexed is false/null, we need profile data to exist or ensure it gets created
      // shouldProceed only if indexed=true (already handled above)
      // Otherwise, we need to process to ensure data exists
      const shouldProceed = false; // Always false when indexed is false/null

      console.log('Profile validation result:', {
        hasStorageFiles,
        hasRequiredFields,
        isIndexed,
        hasProfile,
        weak: indexData.weak,
        shouldProceed,
        indexData
      });

      return {
        shouldProceed,
        needsIndexing: !hasRequiredFields || !hasStorageFiles,
        needsOverview: !hasProfile, // Will be determined in handleProfileChecks
        needsCards: false,    // Will be determined in handleProfileChecks
        indexData
      };
    } catch (error) {
      console.error('Error in checkProfileValidation:', error);
      return {
        shouldProceed: false,
        needsIndexing: true,
        needsOverview: false,
        needsCards: false
      };
    }
  }

  /**
   * Check for storage files in legi/{id}/ folder containing "synopsis"
   */
  private static async checkStorageFiles(legislationId: number): Promise<boolean> {
    try {
      const { data, error } = await getSupabaseClient().storage
        .from('web')
        .list(`legi/${legislationId}`, { limit: 100 });

      if (error) {
        console.warn('Error checking storage files:', error);
        return false;
      }

      if (!data || data.length === 0) {
        console.log(`No files found in legi/${legislationId}/ folder`);
        return false;
      }

      // Check if any file contains "synopsis" in the name
      const hasSynopsisFile = data.some(file => 
        file.name.toLowerCase().includes('synopsis')
      );

      console.log(`Storage check for legislation ${legislationId}: ${hasSynopsisFile ? 'found synopsis files' : 'no synopsis files'}`);
      return hasSynopsisFile;
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
  private static async handleProfileChecks(legislationId: number, checkResult: ProfileCheckResult, onProgress?: ProgressCallback): Promise<void> {
    try {
      // Check legi_profiles table
      const supabase = getSupabaseClient();
      const { data: profileData, error: profileError } = await supabase
        .from('legi_profiles')
        .select('owner_id, overview')
        .eq('owner_id', legislationId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile data:', profileError);
        return;
      }

      const hasProfile = !!profileData;
      const hasOverview = !!(profileData?.overview);
      const overviewIsValid = hasOverview && !this.isNoDataContent(profileData?.overview);

      console.log('Profile check result:', {
        hasProfile,
        hasOverview,
        overviewIsValid,
        profileData
      });
      
      // Quick check: if profile has valid overview, skip processing
      if (hasProfile && overviewIsValid) {
        console.log('Profile has valid overview, skipping processing');
        return;
      }

      // Determine which steps to execute
      const needsStep2 = !hasProfile || !overviewIsValid;
      
      console.log('Processing decision:', {
        hasProfile,
        hasOverview, 
        overviewIsValid,
        needsStep2
      });

      // Step 2: bill_overview (if needed)
      if (needsStep2) {
        console.log('Executing Step 2: bill_overview');
        await this.executeStep2(legislationId, onProgress);
      } else {
        console.log('Step 2 skipped: profile and overview already exist');
      }

      // Mark as indexed after Step 2 completion
      await this.markProfileAsIndexed(legislationId);

      // Final step: Check if profile should be locked and mark as weak if needed
      await this.checkAndApplyProfileLock(legislationId);

      console.log('Legislation profile processing completed successfully');
    } catch (error) {
      console.error('Error in handleProfileChecks:', error);
      throw error;
    }
  }

  /**
   * Final step: Check if profile should be locked and mark as weak if needed
   */
  private static async checkAndApplyProfileLock(legislationId: number): Promise<void> {
    try {
      // Check if profile should be locked
      const lockStatus = await ProfileLockService.checkProfileLockStatus(legislationId, false);
      
      if (lockStatus.isLocked && lockStatus.lockReason === 'no_cards') {
        // Mark profile as weak if it has no cards
        const supabase = getSupabaseClient();
        const { error } = await supabase
          .from('legi_index')
          .update({ weak: true })
          .eq('id', legislationId);

        if (error) {
          console.warn(`Failed to mark legislation ${legislationId} as weak:`, error);
        } else {
          console.log(`Legislation ${legislationId} marked as weak due to no cards`);
        }
      }
    } catch (error) {
      console.error(`Error checking profile lock for legislation ${legislationId}:`, error);
    }
  }

  /**
   * Mark profile as indexed after Step 2 completion
   */
  private static async markProfileAsIndexed(legislationId: number): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('legi_index')
        .update({ indexed: true })
        .eq('id', legislationId);

      if (error) {
        console.warn(`Failed to mark profile as indexed for legislation ID ${legislationId}:`, error);
      } else {
        console.log(`Profile marked as indexed for legislation ID ${legislationId}`);
      }
    } catch (error) {
      console.error(`Error marking profile as indexed for legislation ID ${legislationId}:`, error);
    }
  }

  /**
   * Step 1: Execute profile_index script only if bill_lvl is missing
   */
  private static async executeStep1IfNeeded(legislationId: number, onProgress?: ProgressCallback): Promise<void> {
    try {
      // Check if bill_lvl is already present
      const supabase = getSupabaseClient();
      const { data: indexData, error: indexError } = await supabase
        .from('legi_index')
        .select('bill_lvl')
        .eq('id', legislationId)
        .single();

      if (indexError) {
        console.error('Error checking bill_lvl for legislation ID:', legislationId, indexError);
        throw indexError;
      }

      if (indexData?.bill_lvl) {
        console.log(`Bill level already exists for legislation ID ${legislationId}: ${indexData.bill_lvl}, skipping profile_index`);
        return;
      }

      console.log(`Bill level missing for legislation ID ${legislationId}, executing profile_index`);
      await this.executeStep1(legislationId, onProgress);
    } catch (error) {
      console.error('Error in executeStep1IfNeeded:', error);
      throw error;
    }
  }

  /**
   * Step 1: Execute profile_index script for legislation
   */
  private static async executeStep1(legislationId: number, onProgress?: ProgressCallback): Promise<void> {
    try {
      console.log(`Executing Step 1: profile_index for legislation ID ${legislationId}`);
      onProgress?.({ script: 'Indexing legislation profile...' });
      
      const { data, error } = await getSupabaseClient().functions.invoke('profile_index', {
        body: {
          id: legislationId,
          is_ppl: false
        }
      });

      if (error) {
        console.error('Error in Step 1 (profile_index):', error);
        throw error;
      }

      console.log('Step 1 completed successfully:', data);
      onProgress?.({ script: 'Indexing legislation profile...', completed: true });
    } catch (error) {
      console.error('Error executing Step 1:', error);
      throw error;
    }
  }

  /**
   * Step 2: Execute bill_overview script
   */
  private static async executeStep2(legislationId: number, onProgress?: ProgressCallback): Promise<void> {
    try {
      console.log(`Executing Step 2: bill_overview for legislation ID ${legislationId}`);
      onProgress?.({ script: 'Creating bill overview...' });
      
      const { data, error } = await getSupabaseClient().functions.invoke('bill_overview', {
        body: {
          id: legislationId
        }
      });

      if (error) {
        console.error('Error in Step 2 (bill_overview):', error);
        throw error;
      }

      console.log('Step 2 completed successfully:', data);
      onProgress?.({ script: 'Creating bill overview...', completed: true });
    } catch (error) {
      console.error('Error executing Step 2:', error);
      throw error;
    }
  }


  /**
   * Get profile status for debugging
   */
  static async getProfileStatus(legislationId: number): Promise<{
    indexData: LegiIndex | null;
    profileData: LegiProfile | null;
    validation: ProfileCheckResult;
  }> {
    const validation = await this.checkProfileValidation(legislationId);
    
    const supabase = getSupabaseClient();
    const { data: profileData } = await supabase
      .from('legi_profiles')
      .select('owner_id, overview')
      .eq('owner_id', legislationId)
      .single();

    return {
      indexData: validation.indexData || null,
      profileData: profileData || null,
      validation
    };
  }
}
