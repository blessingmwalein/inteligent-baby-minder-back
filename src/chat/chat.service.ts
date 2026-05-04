import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async startChat(flowType: string, userId?: string) {
    if (flowType === 'GREETING') {
      return {
        sessionId: null,
        isFinal: true,
        advice:
          'Hi there. Tell me about the baby\'s cry, facial expression, or skin issue, and I will guide you.',
        triageLevel: 'NORMAL',
      };
    }

    if (flowType === 'UNKNOWN') {
      return {
        sessionId: null,
        isFinal: true,
        advice:
          'I could not confidently identify the issue. Please describe the baby\'s cues in more detail or choose CRY, FACE, or SKIN when prompted.',
        triageLevel: 'NORMAL',
      };
    }

    const rootNode = await this.prisma.decisionTreeNode.findFirst({
      where: {
        type: flowType,
        parentId: null,
      },
    });

    if (!rootNode) {
      throw new NotFoundException(`Decision tree for flowType '${flowType}' not found.`);
    }

    const session = await this.prisma.chatSession.create({
      data: {
        flowType,
        currentStateNode: rootNode.id,
        ...(userId ? { userId } : {}),
      },
    });

    return {
      sessionId: session.id,
      question: rootNode.question,
      isFinal: rootNode.isLeaf,
      nodeId: rootNode.id,
    };
  }

  async answerChat(sessionId: string, answer: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || !session.currentStateNode) {
      throw new NotFoundException('Invalid or expired chat session.');
    }

    const currentNode = await this.prisma.decisionTreeNode.findUnique({
      where: { id: session.currentStateNode },
      include: {
        children: true,
        ConditionResponse: true,
      },
    });

    if (!currentNode) {
      throw new NotFoundException('Current state node not found in database.');
    }

    if (currentNode.isLeaf || currentNode.ConditionResponse) {
      return {
        isFinal: true,
        advice: currentNode.ConditionResponse?.advice || 'Monitor the baby closely.',
        triageLevel: currentNode.ConditionResponse?.triageLevel || 'NORMAL',
      };
    }

    const normalizedAnswer = answer.toLowerCase();
    let nextNode = currentNode.children.find(child => 
      child.triggerKeyword && normalizedAnswer.includes(child.triggerKeyword.toLowerCase())
    );

    if (!nextNode && currentNode.children.length > 0) {
      // Fallback: pick the first logical child if user input doesn't map perfectly
      nextNode = currentNode.children[0]; 
    } else if (!nextNode) {
      return {
        error: "Cannot determine the next step. End of known flow reached.",
        availableKeywords: currentNode.children.map(c => c.triggerKeyword)
      };
    }

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { currentStateNode: nextNode.id },
    });

    // Fetch the new node with full properties to see if it is a leaf
    const fullNextNode = await this.prisma.decisionTreeNode.findUnique({
      where: { id: nextNode.id },
      include: { ConditionResponse: true },
    });

    if (fullNextNode?.isLeaf) {
      return {
        isFinal: true,
        advice: fullNextNode.ConditionResponse?.advice,
        triageLevel: fullNextNode.ConditionResponse?.triageLevel,
      };
    }

    return {
      isFinal: false,
      question: fullNextNode?.question,
      nodeId: fullNextNode?.id,
    };
  }
}
