/**
 * Phrases that, if matched in a caregiver message, must bypass the LLM and
 * surface an EMERGENCY response immediately. All entries are lowercased and
 * matched as case-insensitive substrings against the normalized message.
 *
 * Audited by a clinician before each release. Add new phrases conservatively.
 */
export const EMERGENCY_PHRASES: readonly string[] = [
  // Breathing
  'not breathing',
  "isn't breathing",
  'stopped breathing',
  "can't breathe",
  'cannot breathe',
  'gasping',
  'no breath',

  // Color / circulation
  'blue lips',
  'blue around the mouth',
  'blue around mouth',
  'turning blue',
  'turning grey',
  'turning gray',
  'pale and limp',

  // Consciousness / responsiveness
  'unconscious',
  'unresponsive',
  "won't wake",
  "wont wake",
  "won't wake up",
  "doesn't respond",
  'limp and floppy',
  'going limp',

  // Seizure
  'seizure',
  'convulsion',
  'convulsing',
  'shaking uncontrollably',

  // Choking
  'choking',
  'choked on',

  // Poisoning / ingestion
  'swallowed bleach',
  'swallowed pills',
  'swallowed medicine',
  'drank chemical',
  'ate poison',
  'ingested poison',

  // Severe injury
  'fell from',
  'fell off',
  'head injury',
  'hit head hard',
  'bleeding heavily',
  "won't stop bleeding",
  'wont stop bleeding',
];

export const EMERGENCY_REPLY = `This sounds like a medical emergency. Call your local emergency number right now (e.g. 911 in the US, 999 in the UK, 112 in much of Europe, 994 in Zimbabwe).

While you wait for help:
- Keep your baby in a safe position — if they're unresponsive, lie them on their back on a firm surface.
- If they're not breathing and you've been trained, begin infant CPR.
- Do not give food, water, or any medicine.
- Stay on the line with the emergency operator and follow their instructions.

I'm a guidance tool, not a substitute for emergency care. Please call now.`;

export const URGENT_PREFIX =
  'This needs prompt medical attention — please contact your pediatrician today or, if symptoms worsen, go to the nearest urgent care or emergency department.\n\n';

export const EMERGENCY_PREFIX =
  'This is an emergency. Call your local emergency number now.\n\n';
