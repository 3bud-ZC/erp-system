/**
 * Auto Code Generator Utility
 * Generates unique codes for different entity types
 */

// Counter storage for sequential codes (in production, this should be in database)
const codeCounters: Record<string, number> = {};

/**
 * Generate auto code based on entity type and prefix
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
    'sales_invoice': 'INV',
    'purchase_order': 'PO',
    'purchase_invoice': 'PI',
  };

  const prefix = prefixes[entityType] || 'CODE';
  
  // Get current year for the code
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Find the next available number
  let counter = 1;
  let code = '';
  
  do {
    // Generate code format: PREFIX-YY-XXXX (e.g., PROD-24-0001)
    const paddedNumber = counter.toString().padStart(4, '0');
    code = `${prefix}-${year}-${paddedNumber}`;
    counter++;
  } while (existingCodes.includes(code));
  
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
