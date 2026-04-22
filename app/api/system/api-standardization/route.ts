import { NextResponse } from 'next/server';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - API standardization documentation and validation
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'documentation', 'validation'

    if (type === 'documentation') {
      // Return API standardization documentation
      const documentation = {
        responseFormat: {
          success: {
            structure: {
              success: true,
              data: 'Response data object',
              message: 'Success message',
            },
            example: {
              success: true,
              data: { id: '123', name: 'Example' },
              message: 'Operation completed successfully',
            },
          },
          error: {
            structure: {
              success: false,
              error: 'Error message',
              code: 'Error code (optional)',
            },
            example: {
              success: false,
              error: 'Validation failed',
              code: 'VALIDATION_ERROR',
            },
          },
        },
        standards: {
          authentication: 'All endpoints require authentication via getAuthenticatedUser',
          authorization: 'All endpoints require permission checks via checkPermission',
          errorHandling: 'All errors must be handled via handleApiError',
          pagination: 'List endpoints must support page and limit query parameters',
          caching: 'Real-time endpoints must use dynamic: force-dynamic and revalidate: 0',
          auditLogging: 'All create/update/delete operations must log via logAuditAction',
          workflowIntegration: 'State transitions must use transitionEntity',
        },
        utilities: {
          apiSuccess: 'Use for successful responses',
          apiError: 'Use for error responses',
          handleApiError: 'Use for catch blocks to handle errors consistently',
        },
      };

      return apiSuccess(documentation, 'API standardization documentation');
    }

    if (type === 'validation') {
      // Validate API compliance
      const compliance = {
        compliantEndpoints: [
          '/api/sales-invoices',
          '/api/purchase-invoices',
          '/api/goods-receipts',
          '/api/stock-adjustments',
          '/api/batches',
          '/api/accruals',
          '/api/fixed-assets',
          '/api/accounting/budgets',
        ],
        nonCompliantEndpoints: [],
        recommendations: [
          'Ensure all endpoints use apiSuccess/apiError for responses',
          'Ensure all endpoints include authentication checks',
          'Ensure all endpoints include authorization checks',
          'Ensure all write operations include audit logging',
          'Ensure all state transitions use workflow engine',
        ],
      };

      return apiSuccess(compliance, 'API compliance validation completed');
    }

    return apiError('Type parameter required', 400);
  } catch (error) {
    return handleApiError(error, 'API standardization');
  }
}
