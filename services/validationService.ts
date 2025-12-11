import {
    CardContent,
    CardIndex,
    isValidCategory,
    isValidScreen,
    isValidTier,
    PPLProfiles,
    validateApprovalRating,
    validateScore,
    validateWordCount,
    VALIDATION_RULES
} from '../types/pplDataTypes';

export class ValidationService {
  /**
   * Validate PPL profile data
   */
  static validateProfileData(profile: Partial<PPLProfiles>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate synopsis
    if (profile.synopsis) {
      if (!validateWordCount(profile.synopsis, VALIDATION_RULES.synopsis.minWords, VALIDATION_RULES.synopsis.maxWords)) {
        errors.push(`Synopsis must be between ${VALIDATION_RULES.synopsis.minWords}-${VALIDATION_RULES.synopsis.maxWords} words`);
      }
    }

    // Validate agenda
    if (profile.agenda) {
      if (!validateWordCount(profile.agenda, VALIDATION_RULES.agenda.minWords, VALIDATION_RULES.agenda.maxWords)) {
        errors.push(`Agenda must be between ${VALIDATION_RULES.agenda.minWords}-${VALIDATION_RULES.agenda.maxWords} words`);
      }
    }

    // Validate identity
    if (profile.identity) {
      if (!validateWordCount(profile.identity, VALIDATION_RULES.identity.minWords, VALIDATION_RULES.identity.maxWords)) {
        errors.push(`Identity must be between ${VALIDATION_RULES.identity.minWords}-${VALIDATION_RULES.identity.maxWords} words`);
      }
    }

    // Validate affiliates
    if (profile.affiliates) {
      if (!validateWordCount(profile.affiliates, VALIDATION_RULES.affiliates.minWords, VALIDATION_RULES.affiliates.maxWords)) {
        errors.push(`Affiliates must be between ${VALIDATION_RULES.affiliates.minWords}-${VALIDATION_RULES.affiliates.maxWords} words`);
      }
    }

    // Validate approval rating
    if (profile.approval !== undefined) {
      if (!validateApprovalRating(profile.approval)) {
        errors.push('Approval rating must be between 0-100');
      }
    }

    // Validate disapproval rating
    if (profile.disapproval !== undefined) {
      if (!validateApprovalRating(profile.disapproval)) {
        errors.push('Disapproval rating must be between 0-100');
      }
    }

    // Note: Removed combined approval + disapproval rule as requested

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate card data
   */
  static validateCardData(card: Partial<CardIndex>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate title
    if (card.title) {
      if (card.title.length < VALIDATION_RULES.title.minLength) {
        errors.push(`Title must be at least ${VALIDATION_RULES.title.minLength} characters`);
      }
      if (card.title.length > VALIDATION_RULES.title.maxLength) {
        errors.push(`Title must be no more than ${VALIDATION_RULES.title.maxLength} characters`);
      }
    } else if (VALIDATION_RULES.title.required) {
      errors.push('Title is required');
    }

    // Validate screen
    if (card.screen && !isValidScreen(card.screen)) {
      errors.push(`Invalid screen: ${card.screen}. Must be one of: agenda_ppl, identity, affiliates`);
    }

    // Validate score
    if (card.score !== undefined) {
      if (!validateScore(card.score)) {
        errors.push('Score must be between 0-100');
      }
    } else if (VALIDATION_RULES.score.required) {
      errors.push('Score is required');
    }

    // Validate owner_id
    if (card.owner_id === undefined || card.owner_id <= 0) {
      errors.push('Valid owner_id is required');
    }

    // Validate is_ppl
    if (card.is_ppl !== undefined && !card.is_ppl) {
      errors.push('Politician cards must have is_ppl=true');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate card content data
   */
  static validateCardContent(content: Partial<CardContent>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate card_id
    if (content.card_id === undefined || content.card_id <= 0) {
      errors.push('Valid card_id is required');
    }

    // Validate title
    if (content.title) {
      if (content.title.length < VALIDATION_RULES.title.minLength) {
        errors.push(`Content title must be at least ${VALIDATION_RULES.title.minLength} characters`);
      }
      if (content.title.length > VALIDATION_RULES.title.maxLength) {
        errors.push(`Content title must be no more than ${VALIDATION_RULES.title.maxLength} characters`);
      }
    }

    // Validate web_content
    if (content.web_content && content.web_content.length < 100) {
      errors.push('Web content must be at least 100 characters');
    }

    // Validate links
    if (content.link1) {
      try {
        new URL(content.link1);
      } catch {
        errors.push('link1 must be a valid URL');
      }
    }

    if (content.link2) {
      try {
        new URL(content.link2);
      } catch {
        errors.push('link2 must be a valid URL');
      }
    }

    if (content.link3) {
      try {
        new URL(content.link3);
      } catch {
        errors.push('link3 must be a valid URL');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate tier and category combination
   */
  static validateTierCategory(tier: string, category?: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!isValidTier(tier)) {
      errors.push(`Invalid tier: ${tier}. Must be one of: hard, soft, base`);
    }

    if (category && !isValidCategory(category, tier)) {
      errors.push(`Invalid category '${category}' for tier '${tier}'`);
    }

    if ((tier === 'hard' || tier === 'soft') && !category) {
      errors.push(`${tier} tier requires a category`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize and clean text content
   */
  static sanitizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ');           // Normalize whitespace only
  }

  /**
   * Validate URL format
   */
  static validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Normalize URL for deduplication
   */
  static normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL is from official source
   */
  static isOfficialSource(url: string): boolean {
    const officialDomains = ['.gov', '.edu', 'ballotpedia.org', 'britannica.com'];
    return officialDomains.some(domain => url.includes(domain));
  }
}
