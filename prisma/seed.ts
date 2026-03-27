import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing old data...');
  await prisma.chatSession.deleteMany();
  await prisma.conditionResponse.deleteMany();
  await prisma.decisionTreeNode.deleteMany();

  console.log('Seeding CRY flow...');
  const cryRoot = await prisma.decisionTreeNode.create({
    data: {
      type: 'CRY',
      question: 'Is the baby crying continuously for more than 3 hours a day?',
      depth: 0,
      isLeaf: false,
    },
  });

  const cryColicNode = await prisma.decisionTreeNode.create({
    data: {
      type: 'CRY',
      question: 'Does the baby pull their legs to their stomach or clench their fists?',
      depth: 1,
      isLeaf: false,
      parentId: cryRoot.id,
      triggerKeyword: 'yes',
    },
  });

  await prisma.decisionTreeNode.create({
    data: {
      type: 'CRY',
      question: 'Does the cry stop after feeding or changing?',
      depth: 1,
      isLeaf: true,
      parentId: cryRoot.id,
      triggerKeyword: 'no',
      ConditionResponse: {
        create: {
          advice: 'This sounds like normal newborn behavior. Ensure needs are met and try soothing techniques.',
          triageLevel: 'NORMAL',
        }
      }
    },
  });

  await prisma.decisionTreeNode.create({
    data: {
      type: 'CRY',
      question: 'Diagnosis Node',
      depth: 2,
      isLeaf: true,
      parentId: cryColicNode.id,
      triggerKeyword: 'yes',
      ConditionResponse: {
        create: {
          advice: 'This might be colic. Try gentle rocking, a pacifier, or consult your pediatrician if worried.',
          triageLevel: 'CONSULT_DOCTOR',
        }
      }
    }
  });

  console.log('Seeding FACE flow...');
  const faceRoot = await prisma.decisionTreeNode.create({
    data: {
      type: 'FACE',
      question: 'Is the baby making a grimacing face and seems uncomfortable?',
      depth: 0,
      isLeaf: false,
    }
  });

  await prisma.decisionTreeNode.create({
    data: {
      type: 'FACE',
      question: 'Gas Diagnosis',
      depth: 1,
      isLeaf: true,
      parentId: faceRoot.id,
      triggerKeyword: 'yes',
      ConditionResponse: {
        create: {
          advice: 'The baby might have gas. Try bicycle legs or gently massaging their tummy.',
          triageLevel: 'NORMAL',
        }
      }
    }
  });

  console.log('Seeding SKIN flow...');
  const skinRoot = await prisma.decisionTreeNode.create({
    data: {
      type: 'SKIN',
      question: 'Does the baby have a red rash or spots?',
      depth: 0,
      isLeaf: false,
    }
  });

  await prisma.decisionTreeNode.create({
    data: {
      type: 'SKIN',
      question: 'Rash Diagnosis',
      depth: 1,
      isLeaf: true,
      parentId: skinRoot.id,
      triggerKeyword: 'yes',
      ConditionResponse: {
        create: {
          advice: 'Keep the area dry and use a diaper cream. If it spreads or is accompanied by a fever, see a doctor.',
          triageLevel: 'CONSULT_DOCTOR',
        }
      }
    }
  });

  console.log('Seeding successful.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
