import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create default settings
  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {
      dealershipName: 'Direct Auto Wholesale',
      contactEmail: 'contact@directauto.info',
    },
    create: {
      id: 'singleton',
      dealershipName: 'Direct Auto Wholesale',
      primaryColor: '#1e40af',
      contactEmail: 'contact@directauto.info',
      notifyOnSubmit: true,
      notifyOnPPSR: true,
    },
  })

  // Create admin user
  const adminHash = await bcrypt.hash('$RichardJohnson', 12)
  await prisma.user.upsert({
    where: { email: 'contact@directauto.info' },
    update: {
      passwordHash: adminHash,
      name: 'Direct Auto Admin',
      role: 'ADMIN',
    },
    create: {
      email: 'contact@directauto.info',
      passwordHash: adminHash,
      name: 'Direct Auto Admin',
      role: 'ADMIN',
    },
  })

  // Clean up old seed users if they exist
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['admin@dealer.com.au', 'staff@dealer.com.au'],
      },
    },
  })

  console.log('Seed completed successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
