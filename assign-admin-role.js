const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignAdminRole() {
  try {
    const role = await prisma.role.findUnique({ where: { code: 'admin' } });
    const user = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
    
    if (!role) {
      console.log('Admin role not found');
      return;
    }
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    // Check if user already has this role
    const existing = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id }
    });
    
    if (existing) {
      console.log('User already has admin role');
      return;
    }
    
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id }
    });
    
    console.log('Admin role assigned to user successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignAdminRole();
