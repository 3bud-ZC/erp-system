/**
 * Pagination Service - Production-Grade
 * Cursor-based pagination for efficient data retrieval
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PaginationParams {
  limit?: number;
  cursor?: string;
  direction?: 'forward' | 'backward';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    previousCursor?: string;
    limit: number;
    total: number;
  };
}

// ============================================================================
// CURSOR-BASED PAGINATION
// ============================================================================

export class PaginationService {
  /**
   * Generate cursor from entity
   * Uses the entity's id and createdAt timestamp
   */
  generateCursor(entity: { id: string; createdAt: Date }): string {
    const cursorData = {
      id: entity.id,
      createdAt: entity.createdAt.toISOString(),
    };
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  /**
   * Decode cursor
   */
  decodeCursor(cursor: string): { id: string; createdAt: Date } | null {
    try {
      const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString());
      return {
        id: cursorData.id,
        createdAt: new Date(cursorData.createdAt),
      };
    } catch {
      return null;
    }
  }

  /**
   * Apply pagination to Prisma query
   */
  applyPagination(params: PaginationParams = {}) {
    const limit = Math.min(params.limit || 50, 100); // Max 100 per page
    const cursor = params.cursor ? this.decodeCursor(params.cursor) : null;
    const direction = params.direction || 'forward';

    const prismaPagination: any = {
      take: limit + 1, // Fetch one extra to check if there's more
    };

    if (cursor) {
      if (direction === 'forward') {
        prismaPagination.cursor = {
          id: cursor.id,
          createdAt: cursor.createdAt,
        };
        prismaPagination.skip = 1; // Skip the cursor itself
      } else {
        prismaPagination.cursor = {
          id: cursor.id,
          createdAt: cursor.createdAt,
        };
      }
    }

    return prismaPagination;
  }

  /**
   * Build pagination result
   */
  buildPaginationResult<T extends { id: string; createdAt: Date }>(
    data: T[],
    limit: number,
    direction: 'forward' | 'backward' = 'forward'
  ): PaginatedResult<T> {
    const hasMore = data.length > limit;
    const paginatedData = hasMore ? data.slice(0, limit) : data;

    let nextCursor: string | undefined;
    let previousCursor: string | undefined;

    if (direction === 'forward') {
      if (hasMore && paginatedData.length > 0) {
        const lastItem = paginatedData[paginatedData.length - 1];
        nextCursor = this.generateCursor(lastItem);
      }
    } else {
      if (hasMore && paginatedData.length > 0) {
        const firstItem = paginatedData[0];
        previousCursor = this.generateCursor(firstItem);
      }
    }

    return {
      data: paginatedData,
      pagination: {
        hasMore,
        nextCursor,
        previousCursor,
        limit,
        total: paginatedData.length,
      },
    };
  }
}

export const paginationService = new PaginationService();

// ============================================================================
// OFFSET-BASED PAGINATION (for backward compatibility)
// ============================================================================

export interface OffsetPaginationParams {
  page?: number;
  limit?: number;
}

export interface OffsetPaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export class OffsetPaginationService {
  /**
   * Apply offset-based pagination to Prisma query
   */
  applyOffsetPagination(params: OffsetPaginationParams = {}) {
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(params.limit || 50, 100);
    const skip = (page - 1) * limit;

    return {
      take: limit,
      skip,
    };
  }

  /**
   * Build offset-based pagination result
   */
  buildOffsetPaginationResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): OffsetPaginatedResult<T> {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrevious,
      },
    };
  }
}

export const offsetPaginationService = new OffsetPaginationService();
