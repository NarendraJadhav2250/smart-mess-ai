import { prisma } from '../src/services/prisma.js'

function localToday() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}

function option(name: string) {
  const prefix = `--${name}=`
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length)
}

async function main() {
  const date = option('date')
  const confirmed = process.argv.includes('--confirm')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Provide a target date with --date=YYYY-MM-DD.')
  }
  if (date !== localToday()) {
    throw new Error(`Safety check: this command only cleans today (${localToday()}), not ${date}.`)
  }

  const start = new Date(`${date}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const todaysMeals = await prisma.meal.findMany({
    where: { date: { gte: start, lt: end } },
    include: { result: true },
    orderBy: [{ mealType: 'asc' }, { createdAt: 'asc' }],
  })
  const extraTestIds = process.argv.filter(argument => argument.startsWith('--test-id=')).map(argument => argument.slice('--test-id='.length))
  const extraTests = []
  for (const id of extraTestIds) {
    const meal = await prisma.meal.findUnique({ where: { id } })
    if (!meal) continue
    if (!/(test|integration)/i.test(meal.menu)) {
      throw new Error(`Refusing to remove ${id}: its menu is not clearly marked as test/integration data.`)
    }
    extraTests.push(meal)
  }

  console.log(`Cleanup preview for today ${date}: ${todaysMeals.length} meals and ${extraTests.length} explicitly identified test meals.`)
  for (const meal of [...todaysMeals, ...extraTests]) {
    console.log(`- ${meal.id} | ${meal.date.toISOString().slice(0, 10)} ${meal.mealType} | ${meal.menu}`)
  }
  if (!confirmed) {
    console.log('Preview only; no data was changed. Add --confirm to remove exactly these rows.')
    return
  }

  await prisma.$transaction(async transaction => {
    await transaction.meal.deleteMany({ where: { date: { gte: start, lt: end } } })
    if (extraTests.length) {
      await transaction.meal.deleteMany({ where: { id: { in: extraTests.map(meal => meal.id) } } })
    }
  })
  console.log(`Removed ${todaysMeals.length + extraTests.length} selected meal rows. Other dates and their history were preserved.`)
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
