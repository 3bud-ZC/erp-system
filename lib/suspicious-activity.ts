/**
 * Suspicious activity detection and logging
 * Detects and logs potentially malicious activities
 */

import { prisma } from './db';
import { logAuditAction } from './auth';

export type SuspiciousActivityType =
  | 'MULTIPLE_FAILED_LOGINS'
  | 'UNUSUAL_LOGIN_LOCATION'
  | 'UNUSUAL_LOGIN_TIME'
  | 'RAPID_API_REQUESTS'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'DATA_EXPORT_ATTEMPT'
  | 'PRIVILEGE_ESCALATION_ATTEMPT'
  | 'BULK_DELETE_ATTEMPT';

export interface SuspiciousActivity {
  type: SuspiciousActivityType;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(activity: SuspiciousActivity): Promise<void> {
  try {
    // Log to audit trail
    await logAuditAction(
      activity.userId || 'system',
      'SUSPICIOUS_ACTIVITY',
      'security',
      activity.type,
      activity.userId,
      activity.details,
      activity.ipAddress,
      activity.userAgent
    );

    // Create security alert notification for admins
    if (activity.severity === 'high' || activity.severity === 'critical') {
      // Get admin users to notify
      const adminUsers = await prisma.user.findMany({
        where: {
          roles: {
            some: {
              role: {
                code: 'admin',
              },
            },
          },
        },
      });

      for (const admin of adminUsers) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'SECURITY_ALERT',
            title: `Suspicious Activity: ${activity.type}`,
            message: `Suspicious activity detected: ${activity.type}. Severity: ${activity.severity}`,
            relatedModule: 'security',
            relatedId: activity.userId,
          },
        });
      }
    }
  } catch (error) {
    console.error('Error logging suspicious activity:', error);
  }
}

/**
 * Check for multiple failed login attempts
 */
export async function checkMultipleFailedLogins(
  email: string,
  ipAddress: string
): Promise<void> {
  // This is handled by brute-force protection
  // Additional logging can be added here if needed
}

/**
 * Check for unusual login location (geographically distant from previous logins)
 */
export async function checkUnusualLoginLocation(
  userId: string,
  currentIpAddress: string
): Promise<void> {
  try {
    // Get recent successful logins for this user
    const recentSessions = await prisma.session.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (recentSessions.length === 0) {
      return; // First login, no baseline
    }

    // Simple IP change detection (can be enhanced with geolocation)
    const previousIps = recentSessions.map(s => s.ipAddress).filter(Boolean);
    const hasDifferentIp = previousIps.every(ip => ip !== currentIpAddress);

    if (hasDifferentIp && previousIps.length > 0) {
      await logSuspiciousActivity({
        type: 'UNUSUAL_LOGIN_LOCATION',
        userId,
        ipAddress: currentIpAddress,
        details: {
          previousIps,
          currentIp: currentIpAddress,
        },
        severity: 'medium',
      });
    }
  } catch (error) {
    console.error('Error checking unusual login location:', error);
  }
}

/**
 * Check for unusual login time (e.g., 2 AM for office workers)
 */
export async function checkUnusualLoginTime(
  userId: string,
  loginTime: Date
): Promise<void> {
  const hour = loginTime.getHours();
  
  // Flag logins between midnight and 6 AM
  if (hour >= 0 && hour < 6) {
    await logSuspiciousActivity({
      type: 'UNUSUAL_LOGIN_TIME',
      userId,
      details: {
        loginHour: hour,
        loginTime: loginTime.toISOString(),
      },
      severity: 'low',
    });
  }
}

/**
 * Check for rapid API requests (potential DoS or scraping)
 */
export function checkRapidApiRequests(
  identifier: string,
  requestCount: number,
  timeWindowMs: number
): void {
  if (requestCount > 100) { // More than 100 requests in time window
    logSuspiciousActivity({
      type: 'RAPID_API_REQUESTS',
      details: {
        identifier,
        requestCount,
        timeWindowMs,
      },
      severity: 'high',
    });
  }
}

/**
 * Check for unauthorized access attempts
 */
export async function checkUnauthorizedAccessAttempt(
  userId: string,
  resource: string,
  ipAddress?: string
): Promise<void> {
  await logSuspiciousActivity({
    type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
    userId,
    ipAddress,
    details: {
      resource,
    },
    severity: 'high',
  });
}

/**
 * Check for data export attempts (potential data exfiltration)
 */
export async function checkDataExportAttempt(
  userId: string,
  resourceType: string,
  recordCount: number,
  ipAddress?: string
): Promise<void> {
  // Flag if exporting more than 100 records
  if (recordCount > 100) {
    await logSuspiciousActivity({
      type: 'DATA_EXPORT_ATTEMPT',
      userId,
      ipAddress,
      details: {
        resourceType,
        recordCount,
      },
      severity: 'medium',
    });
  }
}

/**
 * Check for privilege escalation attempts
 */
export async function checkPrivilegeEscalationAttempt(
  userId: string,
  attemptedRole: string,
  ipAddress?: string
): Promise<void> {
  await logSuspiciousActivity({
    type: 'PRIVILEGE_ESCALATION_ATTEMPT',
    userId,
    ipAddress,
    details: {
      attemptedRole,
    },
    severity: 'critical',
  });
}

/**
 * Check for bulk delete attempts
 */
export async function checkBulkDeleteAttempt(
  userId: string,
  resourceType: string,
  recordCount: number,
  ipAddress?: string
): Promise<void> {
  // Flag if deleting more than 10 records at once
  if (recordCount > 10) {
    await logSuspiciousActivity({
      type: 'BULK_DELETE_ATTEMPT',
      userId,
      ipAddress,
      details: {
        resourceType,
        recordCount,
      },
      severity: 'high',
    });
  }
}
