import { logDiag, logDiagError } from '../lib/diag/logger';
import { supabase } from '../utils/supabase';

export interface ProfileLockStatus {
  isLocked: boolean;
  lockReason: 'no_cards' | 'weak_profile' | 'none';
  lockedPage: 'synopsis' | 'overview' | null;
  profileType: 'politician' | 'legislation';
}

export class ProfileLockService {
  /**
   * Check if a profile should be locked and determine the appropriate page
   */
  static async checkProfileLockStatus(
    profileId: number, 
    isPpl: boolean,
    trace?: string
  ): Promise<ProfileLockStatus> {
    try {
      logDiag('lock:check:start', { profileId, isPpl }, trace);
      
      let result: ProfileLockStatus;
      if (isPpl) {
        result = await this.checkPoliticianLockStatus(profileId, trace);
      } else {
        result = await this.checkLegislationLockStatus(profileId, trace);
      }
      
      logDiag('lock:check:result', { 
        profileId, 
        isPpl,
        isLocked: result.isLocked,
        lockReason: result.lockReason,
        lockedPage: result.lockedPage
      }, trace);
      
      return result;
    } catch (error) {
      console.error('Error checking profile lock status:', error);
      logDiagError('lock:check:error', error, trace);
      return {
        isLocked: false,
        lockReason: 'none',
        lockedPage: null,
        profileType: isPpl ? 'politician' : 'legislation'
      };
    }
  }

  /**
   * Check if a politician profile should be locked
   */
  private static async checkPoliticianLockStatus(profileId: number, trace?: string): Promise<ProfileLockStatus> {
    try {
      logDiag('lock:ppl:check', { profileId }, trace);
      
      // Step 1: Check if profile is marked as weak
      const { data: indexData, error: indexError } = await supabase
        .from('ppl_index')
        .select('id, name, weak')
        .eq('id', profileId)
        .single();

      if (indexError || !indexData) {
        console.error('Error fetching politician index data:', indexError);
        return {
          isLocked: false,
          lockReason: 'none',
          lockedPage: null,
          profileType: 'politician'
        };
      }

      // Step 2: Check if profile is marked as weak
      if (indexData.weak === true) {
        return {
          isLocked: true,
          lockReason: 'weak_profile',
          lockedPage: 'synopsis', // Politicians lock to synopsis page
          profileType: 'politician'
        };
      }

      // Step 3: Check card count for new logic
      const cardCount = await this.checkPoliticianCardCount(profileId, trace);
      
      logDiag('lock:ppl:card-count', { profileId, cardCount }, trace);
      
      if (cardCount === 0) {
        // 0 cards = full lock (weak profile)
        logDiag('lock:ppl:locked-no-cards', { profileId }, trace);
        return {
          isLocked: true,
          lockReason: 'no_cards',
          lockedPage: 'synopsis', // Politicians lock to synopsis page
          profileType: 'politician'
        };
      }
      // Note: 1-8 cards = no lock, just hide tab bar (handled in UI)

      logDiag('lock:ppl:unlocked', { profileId, cardCount }, trace);
      return {
        isLocked: false,
        lockReason: 'none',
        lockedPage: null,
        profileType: 'politician'
      };
    } catch (error) {
      console.error('Error checking politician lock status:', error);
      logDiagError('lock:ppl:error', error, trace);
      return {
        isLocked: false,
        lockReason: 'none',
        lockedPage: null,
        profileType: 'politician'
      };
    }
  }

  /**
   * Check if a legislation profile should be locked
   */
  private static async checkLegislationLockStatus(profileId: number, trace?: string): Promise<ProfileLockStatus> {
    try {
      // Step 1: Check if profile is marked as weak
      const { data: indexData, error: indexError } = await supabase
        .from('legi_index')
        .select('id, name, weak')
        .eq('id', profileId)
        .single();

      if (indexError || !indexData) {
        console.error('Error fetching legislation index data:', indexError);
        return {
          isLocked: false,
          lockReason: 'none',
          lockedPage: null,
          profileType: 'legislation'
        };
      }

      // Step 2: Check if profile is marked as weak
      if (indexData.weak === true) {
        return {
          isLocked: true,
          lockReason: 'weak_profile',
          lockedPage: 'overview', // Legislation locks to overview page
          profileType: 'legislation'
        };
      }

      // Step 3: Check card count for new logic
      const cardCount = await this.checkLegislationCardCount(profileId);
      
      if (cardCount === 0) {
        // 0 cards = full lock (weak profile)
        return {
          isLocked: true,
          lockReason: 'no_cards',
          lockedPage: 'overview', // Legislation locks to overview page
          profileType: 'legislation'
        };
      }
      // Note: 1-8 cards = no lock, just hide tab bar (handled in UI)

      return {
        isLocked: false,
        lockReason: 'none',
        lockedPage: null,
        profileType: 'legislation'
      };
    } catch (error) {
      console.error('Error checking legislation lock status:', error);
      return {
        isLocked: false,
        lockReason: 'none',
        lockedPage: null,
        profileType: 'legislation'
      };
    }
  }

  /**
   * Check if a politician profile has any cards
   */
  private static async checkPoliticianHasCards(profileId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('card_index')
        .select('id')
        .eq('owner_id', profileId)
        .eq('is_ppl', true)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('Error checking politician cards:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking politician cards:', error);
      return false;
    }
  }

  /**
   * Check if legislation has fewer than 10 cards (partial lock - only agenda accessible)
   */
  private static async checkLegislationCardCount(profileId: number, trace?: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('card_index')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', profileId)
        .eq('is_ppl', false)
        .eq('is_active', true);

      if (error) {
        console.error('Error checking legislation card count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in checkLegislationCardCount:', error);
      return 0;
    }
  }

  /**
   * Check if politician has fewer than 10 cards (partial lock - only agenda accessible)
   */
  private static async checkPoliticianCardCount(profileId: number, trace?: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('card_index')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', profileId)
        .eq('is_ppl', true)
        .eq('is_active', true);

      if (error) {
        console.error('Error checking politician card count:', error);
        logDiagError('lock:card-count:error', error, trace);
        return 0;
      }

      logDiag('lock:card-count:result', { profileId, count: count || 0 }, trace);
      return count || 0;
    } catch (error) {
      console.error('Error in checkPoliticianCardCount:', error);
      logDiagError('lock:card-count:exception', error, trace);
      return 0;
    }
  }

  /**
   * Check if a legislation profile has any cards
   */
  private static async checkLegislationHasCards(profileId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('card_index')
        .select('id')
        .eq('owner_id', profileId)
        .eq('is_ppl', false)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('Error checking legislation cards:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking legislation cards:', error);
      return false;
    }
  }

  /**
   * Check if profile has limited cards (1-9) and should hide tab bar
   */
  static async shouldHideTabBar(
    profileId: number,
    isPpl: boolean
  ): Promise<boolean> {
    try {
      // Check if profile is locked (0 cards or weak)
      const lockStatus = await this.checkProfileLockStatus(profileId, isPpl);
      if (lockStatus.isLocked) {
        return true; // Hide tab bar for locked profiles
      }

      // Check card count for limited cards (1-8)
      let cardCount = 0;
      if (isPpl) {
        cardCount = await this.checkPoliticianCardCount(profileId);
      } else {
        cardCount = await this.checkLegislationCardCount(profileId);
      }

      // Hide tab bar if 8 or fewer cards (show tab bar when > 8)
      return cardCount <= 8;
    } catch (error) {
      console.error('Error checking shouldHideTabBar:', error);
      return false;
    }
  }

  /**
   * Get the appropriate locked page for a profile type
   */
  static getLockedPageForProfileType(profileType: 'politician' | 'legislation'): 'synopsis' | 'overview' {
    return profileType === 'politician' ? 'synopsis' : 'overview';
  }

  /**
   * Check if a profile should be locked based on weak flag only
   */
  static async checkWeakProfileLock(
    profileId: number, 
    isPpl: boolean
  ): Promise<{ isWeak: boolean; lockedPage: 'synopsis' | 'overview' | null }> {
    try {
      const tableName = isPpl ? 'ppl_index' : 'legi_index';
      const { data, error } = await supabase
        .from(tableName)
        .select('weak')
        .eq('id', profileId)
        .single();

      if (error || !data) {
        return { isWeak: false, lockedPage: null };
      }

      const isWeak = data.weak === true;
      const lockedPage = isWeak ? this.getLockedPageForProfileType(isPpl ? 'politician' : 'legislation') : null;

      return { isWeak, lockedPage };
    } catch (error) {
      console.error('Error checking weak profile lock:', error);
      return { isWeak: false, lockedPage: null };
    }
  }
}
