/**
 * Auto Code Generator Utility
 * Generates unique codes for different entity types
 */

// Counter storage for sequential codes (in production, this should be in database)
const codeCounters: Record<string, number> = {};

/**
 * Generate auto code based on entity type and prefix
 * FORMAT: PREFIX-TIMESTAMP-RANDOM (guaranteed unique)
 */
export function generateAutoCode(
  entityType: string,
  existingCodes: string[] = []
): string {
  const prefixes: Record<string, string> = {
    'product': 'PROD',
    'raw_material': 'RAW',
    'warehouse': 'WH',
    'customer': 'CUST',
    'supplier': 'SUP',
    'sales_order': 'SO',
    'sales_invoice': 'SI',
    'purchase_order': 'PO',
    'purchase_invoice': 'PI',
  };

  const prefix = prefixes[entityType] || 'CODE';
  
  // Generate unique code: PREFIX-TIMESTAMP-RANDOM
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const code = `${prefix}-${timestamp}-${random}`;
  
  // Ensure uniqueness (very unlikely to collide, but check anyway)
  if (existingCodes.includes(code)) {
    // Recursively generate new code if collision (extremely rare)
    return generateAutoCode(entityType, existingCodes);
  }
  
  return code;
}

/**
 * Generate random code (fallback method)
 */
export function generateRandomCode(prefix: string): string {
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Check if code exists in list
 */
export function isCodeExists(code: string, existingCodes: string[]): boolean {
  return existingCodes.includes(code);
}

/**
 * Get next sequential code
 */
export function getNextSequentialCode(
  prefix: string,
  existingCodes: string[]
): string {
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Extract numbers from existing codes with same prefix and year
  const samePrefixCodes = existingCodes.filter(c => 
    c.startsWith(`${prefix}-${year}`)
  );
  
  if (samePrefixCodes.length === 0) {
    return `${prefix}-${year}-0001`;
  }
  
  // Find max number
  const numbers = samePrefixCodes.map(code => {
    const match = code.match(/-(\d{4})$/);
    return match ? parseInt(match[1], 10) : 0;
  });
  
  const maxNumber = Math.max(...numbers);
  const nextNumber = (maxNumber + 1).toString().padStart(4, '0');
  
  return `${prefix}-${year}-${nextNumber}`;
}
