import { Injectable, Logger } from '@nestjs/common';
import * as natural from 'natural';

export enum IntentOutput {
  CRY = 'CRY',
  FACE = 'FACE',
  SKIN = 'SKIN',
  GREETING = 'GREETING',
  UNKNOWN = 'UNKNOWN',
}

@Injectable()
export class NlpService {
  private readonly logger = new Logger(NlpService.name);
  private classifier: natural.BayesClassifier;

  constructor() {
    this.classifier = new natural.BayesClassifier();
    this.trainModel();
  }

  private trainModel() {
    this.classifier.addDocument('hello', IntentOutput.GREETING);
    this.classifier.addDocument('hi', IntentOutput.GREETING);
    this.classifier.addDocument('hey', IntentOutput.GREETING);
    this.classifier.addDocument('good morning', IntentOutput.GREETING);
    this.classifier.addDocument('good afternoon', IntentOutput.GREETING);
    this.classifier.addDocument('good evening', IntentOutput.GREETING);
    this.classifier.addDocument('greetings', IntentOutput.GREETING);

    this.classifier.addDocument('baby is crying loudly', IntentOutput.CRY);
    this.classifier.addDocument('crying', IntentOutput.CRY);
    this.classifier.addDocument('baby crying', IntentOutput.CRY);
    this.classifier.addDocument('cry', IntentOutput.CRY);
    this.classifier.addDocument('high pitched wail', IntentOutput.CRY);
    this.classifier.addDocument('colic cry', IntentOutput.CRY);
    this.classifier.addDocument('wailing and screaming', IntentOutput.CRY);
    this.classifier.addDocument('fussing and whimpering', IntentOutput.CRY);
    this.classifier.addDocument('screaming', IntentOutput.CRY);
    this.classifier.addDocument('wailing', IntentOutput.CRY);

    this.classifier.addDocument('red face', IntentOutput.FACE);
    this.classifier.addDocument('frowning and grimacing', IntentOutput.FACE);
    this.classifier.addDocument('eyes tightly shut', IntentOutput.FACE);
    this.classifier.addDocument('flushed cheeks', IntentOutput.FACE);

    this.classifier.addDocument('red spots on skin', IntentOutput.SKIN);
    this.classifier.addDocument('rash on back', IntentOutput.SKIN);
    this.classifier.addDocument('dry patches', IntentOutput.SKIN);
    this.classifier.addDocument('hives and bumps', IntentOutput.SKIN);

    this.classifier.train();
    this.logger.log('Local NLP Naive Bayes model trained successfully.');
  }

  async detectIntent(message: string): Promise<IntentOutput> {
    const classification = this.classifier.getClassifications(message);
    const topResult = classification[0];

    // Threshold ensures we don't return random guessing as confident
    if (topResult && topResult.value > 0.3) {
      return topResult.label as IntentOutput;
    }

    return await this.huggingFaceFallback(message);
  }

  private async huggingFaceFallback(message: string): Promise<IntentOutput> {
    const apiKey = process.env.HUGGING_FACE_API_KEY;
    if (!apiKey) {
      this.logger.warn('No Hugging Face config found. Returning UNKNOWN by default.');
      return IntentOutput.UNKNOWN;
    }

    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/facebook/bart-large-mnli',
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            inputs: message,
            parameters: {
              candidate_labels: ['infant cry', 'facial expression', 'skin condition', 'greeting', 'other'],
            },
          }),
        },
      );
      
      const result = await response.json();
      
      if (result.labels && result.scores) {
        const topLabel = result.labels[0];
        const topScore = result.scores[0];

        if (topScore > 0.5) {
          switch(topLabel) {
            case 'infant cry': return IntentOutput.CRY;
            case 'facial expression': return IntentOutput.FACE;
            case 'skin condition': return IntentOutput.SKIN;
            case 'greeting': return IntentOutput.GREETING;
          }
        }
      }
      return IntentOutput.UNKNOWN;
    } catch (error) {
      this.logger.error('HuggingFace fallback failed', error);
      return IntentOutput.UNKNOWN;
    }
  }
}
