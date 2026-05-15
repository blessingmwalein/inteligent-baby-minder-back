import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const adviceCorpus: Array<{
  topic: string;
  description: string;
  advice: string;
  triageLevel: 'NORMAL' | 'CONSULT_DOCTOR' | 'URGENT' | 'EMERGENCY';
}> = [
  // --- Crying ---
  {
    topic: 'crying',
    description: 'Brief fussing that stops after feeding, changing, or rocking.',
    advice:
      'This is typical newborn behavior. Try the 5 S\'s: swaddle, side/stomach hold, shush, swing, suck. Ensure the baby is fed, clean, and burped.',
    triageLevel: 'NORMAL',
  },
  {
    topic: 'crying',
    description:
      'Crying for 3+ hours on most days, often in the evening, with legs pulled up and clenched fists. Signs of colic.',
    advice:
      'These signs are consistent with colic, which is common and usually resolves by 3–4 months. Try gentle tummy massage, warm baths, holding upright after feeds, and a pacifier. If you notice fever, vomiting, or weight-loss, consult your pediatrician.',
    triageLevel: 'CONSULT_DOCTOR',
  },
  {
    topic: 'crying',
    description: 'High-pitched, weak, or unusually inconsolable cry that does not respond to soothing.',
    advice:
      'An unusual cry that cannot be soothed warrants medical evaluation, especially if combined with fever, lethargy, or refusal to feed. Contact your pediatrician promptly.',
    triageLevel: 'URGENT',
  },

  // --- Face / Expressions ---
  {
    topic: 'face',
    description: 'Grimacing, red face, or straining — often related to passing gas or a bowel movement.',
    advice:
      'This is usually gas or normal effort. Try bicycle legs, gentle tummy massage, and burping more frequently during feeds. Symptoms typically improve with time.',
    triageLevel: 'NORMAL',
  },
  {
    topic: 'face',
    description: 'Persistent flushing, sweating, or grimacing combined with poor feeding or fever.',
    advice:
      'A baby who looks unwell beyond brief fussing — especially with fever, sweating, or feeding refusal — should be assessed by a clinician.',
    triageLevel: 'CONSULT_DOCTOR',
  },
  {
    topic: 'face',
    description: 'Blue, grey, or pale lips, tongue, or skin around the mouth.',
    advice:
      'Bluish or grey color around the lips/mouth can indicate a breathing or circulation problem. Seek emergency care immediately — call your local emergency number.',
    triageLevel: 'EMERGENCY',
  },

  // --- Skin ---
  {
    topic: 'skin',
    description: 'Small red bumps or rash in the diaper area, no fever, baby otherwise comfortable.',
    advice:
      'This is likely diaper rash. Change diapers frequently, clean gently with water, let the skin air dry, and apply a zinc-oxide diaper cream. If it spreads, blisters, or persists beyond a few days, consult your pediatrician.',
    triageLevel: 'NORMAL',
  },
  {
    topic: 'skin',
    description: 'Dry, itchy patches on cheeks, elbows, or behind knees — common signs of eczema.',
    advice:
      'These can be eczema. Use fragrance-free moisturizer twice daily, lukewarm short baths, and soft cotton clothing. If it spreads, weeps, or the baby is uncomfortable, see your pediatrician.',
    triageLevel: 'CONSULT_DOCTOR',
  },
  {
    topic: 'skin',
    description: 'Rash with fever, lethargy, or rapidly spreading red/purple spots that do not blanch under pressure.',
    advice:
      'A non-blanching rash combined with fever can be a sign of serious infection. Seek urgent medical care without delay.',
    triageLevel: 'URGENT',
  },

  // --- Feeding ---
  {
    topic: 'feeding',
    description: 'Occasional spit-up of small amounts after feeds, baby still gaining weight.',
    advice:
      'Mild reflux is very common. Keep the baby upright for 20–30 minutes after feeds, burp frequently, and avoid overfeeding. If spit-up is frequent and forceful, or weight gain is poor, see your pediatrician.',
    triageLevel: 'NORMAL',
  },
  {
    topic: 'feeding',
    description: 'Persistent refusal to feed, fewer than 6 wet diapers per day, or signs of dehydration.',
    advice:
      'Reduced feeding plus signs of dehydration (dry mouth, sunken fontanelle, fewer wet diapers) needs prompt evaluation. Contact your pediatrician today.',
    triageLevel: 'URGENT',
  },

  // --- Fever ---
  {
    topic: 'fever',
    description: 'Rectal temperature ≥ 38°C (100.4°F) in an infant under 3 months.',
    advice:
      'Any fever in an infant under 3 months should be evaluated by a clinician immediately, regardless of how the baby looks otherwise.',
    triageLevel: 'URGENT',
  },
  {
    topic: 'fever',
    description: 'Low-grade fever in an older infant (3–24 months) who is alert, feeding, and active.',
    advice:
      'Comfort measures (extra fluids, light clothing) are usually enough. Acetaminophen may help if your pediatrician has previously approved its use for your child. Recheck temperature and behavior every few hours; call your pediatrician if fever persists beyond 24 hours or the baby looks unwell.',
    triageLevel: 'CONSULT_DOCTOR',
  },

  // --- Breathing ---
  {
    topic: 'breathing',
    description: 'Fast breathing, grunting, ribs sucking in, blue lips, or pauses in breathing.',
    advice:
      'Signs of respiratory distress in an infant are an emergency. Call your local emergency number immediately. Keep the baby upright while you wait.',
    triageLevel: 'EMERGENCY',
  },

  // --- General safety / red flags ---
  {
    topic: 'safety',
    description: 'Seizure, unresponsiveness, head injury, or ingestion of a harmful substance.',
    advice:
      'These are emergencies. Call your local emergency number immediately. Do not give food, water, or medicine while waiting for help.',
    triageLevel: 'EMERGENCY',
  },
];

async function main() {
  console.log('Clearing existing AdviceReference rows...');
  await prisma.adviceReference.deleteMany();

  console.log(`Seeding ${adviceCorpus.length} AdviceReference rows...`);
  for (const entry of adviceCorpus) {
    await prisma.adviceReference.create({ data: entry });
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
