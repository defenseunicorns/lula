/**
 * Timestamp-based Short ID Generator for Git-friendly filenames
 * 
 * Generates short, human-readable IDs using Base32 encoding of timestamps
 * that remain stable for the same control across versions for Git history tracking.
 */

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a number to Base32 string
 */
function toBase32(num: number): string {
  if (num === 0) return 'A';
  
  let result = '';
  while (num > 0) {
    result = BASE32_CHARS[num % 32] + result;
    num = Math.floor(num / 32);
  }
  return result;
}

/**
 * Decodes a Base32 string to number
 */
function fromBase32(str: string): number {
  let result = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const value = BASE32_CHARS.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    result = result * 32 + value;
  }
  return result;
}

/**
 * Generates a timestamp-based short ID
 * 
 * Uses seconds since epoch (2024-01-01) encoded in Base32 for shorter IDs.
 * This provides ~8-9 character IDs that are chronologically sortable.
 * 
 * @param controlId - The control ID to ensure uniqueness
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns Short ID suitable for filenames
 */
export function generateShortId(controlId: string, timestamp?: Date): string {
  const baseTimestamp = new Date('2024-01-01T00:00:00Z').getTime();
  const currentTimestamp = (timestamp || new Date()).getTime();
  
  // Use seconds since base timestamp for shorter IDs
  const secondsSinceBase = Math.floor((currentTimestamp - baseTimestamp) / 1000);
  
  // Create a simple hash of the control ID for additional uniqueness
  let hash = 0;
  for (let i = 0; i < controlId.length; i++) {
    const char = controlId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use only the last 3 digits of the hash to keep it short
  const hashSuffix = Math.abs(hash) % 1000;
  
  // Combine timestamp and hash for uniqueness
  const combinedValue = secondsSinceBase * 1000 + hashSuffix;
  
  return toBase32(combinedValue);
}

/**
 * Extracts timestamp from short ID
 * 
 * @param shortId - The short ID to decode
 * @returns Date object representing when the ID was created
 */
export function extractTimestamp(shortId: string): Date {
  try {
    const baseTimestamp = new Date('2024-01-01T00:00:00Z').getTime();
    const combinedValue = fromBase32(shortId);
    
    // Extract the seconds portion (remove hash suffix)
    const secondsSinceBase = Math.floor(combinedValue / 1000);
    const timestamp = baseTimestamp + (secondsSinceBase * 1000);
    
    return new Date(timestamp);
  } catch (error) {
    throw new Error(`Invalid short ID format: ${shortId}`);
  }
}

/**
 * Validates that a string is a valid short ID
 */
export function isValidShortId(shortId: string): boolean {
  try {
    if (typeof shortId !== 'string' || shortId.length === 0) {
      return false;
    }
    
    // Check if all characters are valid Base32
    for (const char of shortId) {
      if (!BASE32_CHARS.includes(char)) {
        return false;
      }
    }
    
    // Try to extract timestamp to verify it's decodeable
    extractTimestamp(shortId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a filename for a control using its control ID and short ID
 */
export function getControlFilename(controlId: string, shortId: string): string {
  if (!isValidShortId(shortId)) {
    throw new Error(`Invalid short ID: ${shortId}`);
  }
  return `${controlId}_${shortId}.yaml`;
}

/**
 * Generates the family name from a control ID
 */
export function getControlFamily(controlId: string): string {
  return controlId.split('-')[0];
}

/**
 * Extracts control ID and short ID from a control filename
 */
export function extractIdsFromFilename(filename: string): { controlId: string; shortId: string } {
  const match = filename.match(/^([^_]+)_([A-Z0-9]+)\.yaml$/);
  if (!match) {
    throw new Error(`Invalid control filename format: ${filename}. Expected: CONTROL-ID_SHORTID.yaml`);
  }
  
  const [, controlId, shortId] = match;
  if (!isValidShortId(shortId)) {
    throw new Error(`Invalid short ID in filename: ${shortId}`);
  }
  
  return { controlId, shortId };
}

/**
 * Legacy function for backward compatibility - extracts short ID from old format
 */
export function extractShortIdFromFilename(filename: string): string {
  // Try new format first
  try {
    const { shortId } = extractIdsFromFilename(filename);
    return shortId;
  } catch {
    // Fall back to old format
    const match = filename.match(/^([A-Z0-9]+)\.yaml$/);
    if (!match) {
      throw new Error(`Invalid control filename format: ${filename}`);
    }
    
    const shortId = match[1];
    if (!isValidShortId(shortId)) {
      throw new Error(`Invalid short ID in filename: ${shortId}`);
    }
    
    return shortId;
  }
}