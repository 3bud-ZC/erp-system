import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
})

// Cache Prisma client globally in ALL environments to prevent connection pool exhaustion
globalForPrisma.prisma = prisma

// Verify database connection on startup
prisma.$connect().catch((error) => {
  console.error('❌ Database connection failed:', error);
});
