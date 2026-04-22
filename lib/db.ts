import { PrismaClient } from '@prisma/client'
import { tenantMiddleware } from './prisma-tenant-middleware'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
})

// Cache Prisma client globally in ALL environments to prevent connection pool exhaustion
globalForPrisma.prisma = prisma

// Register tenant isolation middleware
prisma.$use(tenantMiddleware)

// Verify database connection on startup
prisma.$connect().catch((error) => {
  console.error('❌ Database connection failed:', error);
});
