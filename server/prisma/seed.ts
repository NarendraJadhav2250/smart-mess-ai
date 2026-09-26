import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const weeklyMenu = [
  { day: 'Monday', lunch: 'Vatana', dinner: 'Palkha' },
  { day: 'Tuesday', lunch: 'Muga', dinner: 'Kobi' },
  { day: 'Wednesday', lunch: 'Harbhara', dinner: 'Mataki' },
  { day: 'Thursday', lunch: 'Chole', dinner: 'Sambhar Batata' },
  { day: 'Friday', lunch: 'Masur', dinner: 'Shevaga' },
  { day: 'Saturday', lunch: 'Sambar', dinner: 'Rice' },
  { day: 'Sunday', lunch: 'Mataki', dinner: 'Soyabin' },
]

async function main() {
  for (const menu of weeklyMenu) {
    await prisma.menuMaster.upsert({
      where: { day: menu.day },
      create: menu,
      update: { lunch: menu.lunch, dinner: menu.dinner },
    })
  }
  console.log('Weekly menu seeded.')
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
