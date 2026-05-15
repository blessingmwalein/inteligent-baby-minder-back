import { SafetyService } from './safety.service';

describe('SafetyService', () => {
  const svc = new SafetyService();

  describe('preFilter — emergency phrases', () => {
    const emergencies: string[] = [
      'My baby is not breathing',
      "She isn't breathing properly",
      'baby stopped breathing for a few seconds',
      'his lips are turning blue',
      'I see blue around the mouth',
      'she went unconscious',
      "won't wake up since this morning",
      'he is unresponsive and limp',
      'baby had a seizure',
      'shaking uncontrollably',
      'he is choking on something',
      'she swallowed bleach',
      'fell from the changing table',
      'wont stop bleeding from the cut',
    ];

    test.each(emergencies)('triggers EMERGENCY for: %s', (msg) => {
      const result = svc.preFilter(msg);
      expect(result).not.toBeNull();
      expect(result?.reply.triageLevel).toBe('EMERGENCY');
    });
  });

  describe('preFilter — benign messages', () => {
    const benign: string[] = [
      'My baby is crying a lot in the evenings',
      'She has a red rash on her cheek',
      'He spit up after the last feed',
      'How often should a 4 month old eat?',
      'My baby has been fussy all day',
      'She has dry patches behind her knees',
      'When can I start solids?',
      'He woke up with a runny nose',
    ];

    test.each(benign)('returns null for: %s', (msg) => {
      expect(svc.preFilter(msg)).toBeNull();
    });
  });

  describe('postFilter', () => {
    it('prepends emergency prefix when LLM returns EMERGENCY without it', () => {
      const result = svc.postFilter({
        reply: 'Take them to the hospital.',
        triageLevel: 'EMERGENCY',
      });
      expect(result.reply.startsWith('This is an emergency.')).toBe(true);
    });

    it('prepends urgent prefix when LLM returns URGENT without prompt-medical language', () => {
      const result = svc.postFilter({
        reply: 'You should have this checked.',
        triageLevel: 'URGENT',
      });
      expect(result.reply.toLowerCase()).toContain('prompt medical');
    });

    it('leaves NORMAL replies unchanged', () => {
      const original = { reply: 'This is normal.', triageLevel: 'NORMAL' as const };
      expect(svc.postFilter(original)).toEqual(original);
    });
  });
});
