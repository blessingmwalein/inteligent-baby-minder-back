# Intelligent Baby Minder - Backend System Architecture

## 1. System Overview
The Intelligent Baby Minder backend is an API-driven service designed to assist parents by analyzing infant cues (crying, facial expressions, skin conditions) and providing triaged advice. It is built using a modern, scalable Node.js stack and handles user authentication, session tracking, NLP (Natural Language Processing) prediction, and conversational decision trees.

### Core Technology Stack
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod (via `nestjs-zod`)
- **Documentation**: Swagger UI
- **Authentication**: JWT (JSON Web Tokens) with Passport & bcryptjs

---

## 2. Architectural Modules
The backend is structured into domain-driven modules to ensure separation of concerns:

### A. Auth & Users Module (`src/auth`, `src/users`)
- Manages secure user registration and login (`POST /api/auth/signup`, `POST /api/auth/login`).
- Implements stateless JWT authentication strategies.
- Allows retrieval of user profiles (`GET /api/users/profile`).

### B. NLP Module (`src/nlp`)
- Responsible for interpreting raw text input from parents (e.g., "The baby is screaming loudly and pulling its legs").
- Outputs a standardized **Intent**: `CRY`, `FACE`, `SKIN`, or `UNKNOWN`.
- Operates primarily entirely offline to ensure maximum privacy and speed (see *AI Models* section below).

### C. Chatbot Decision Module (`src/chat`)
- A stateless conversational engine driven by PostgreSQL relationships (`DecisionTreeNode`).
- Manages "Chat Sessions" so users can progress through a dynamic Q&A flow.
- Sessions can be run **anonymously** or **linked securely to a User Profile** via the Authorization token.

---

## 3. AI Models & Prediction Process

The backend employs a **curated, two-tier prediction architecture** designed to prioritize zero-cost, localized inference, scaling out to cloud AI only when completely necessary.

### Tier 1: Local Rule-Based NLP (Primary)
To ensure the system remains free, exceptionally fast, and highly private, the primary prediction layer utilizes the `natural` JS library.
- **Model Type**: Naive Bayes Classifier.
- **Mechanism**: The backend pre-trains an extensive in-memory document map containing medical keywords correlated to specific behaviors (e.g., "colic", "wailing" $\rightarrow$ `CRY`; "red spots", "rash" $\rightarrow$ `SKIN`).
- **Execution**: When a user submits text, the local classifier tokenizes and categorizes the sentiment. If the statistical confidence threshold exceeds a safe limit (e.g., > 60%), it instantly returns the determined intent. This step requires *zero internet connectivity*.

### Tier 2: Hugging Face Transformer Inference (Fallback)
If the local rule-based system receives highly ambiguous text and cannot confidently classify the intent, the system dynamically routes the request to a Cloud API.
- **Model Used**: `facebook/bart-large-mnli` (Hosted via Hugging Face's free Inference API).
- **Mechanism (Zero-Shot Classification)**: Unlike models that require exact pre-training, BART-MNLI is a transformer model capable of generalizing prompts. The backend sends the parent's ambiguous text and asks the model to classify it against specific candidate labels (`infant cry`, `facial expression`, `skin condition`, `other`).
- **Execution**: The cloud model returns probability scores. If a candidate label scores high enough, the text is successfully classified into a system intent (`CRY`, `FACE`, `SKIN`). If it still fails, the system outputs `UNKNOWN`.

---

## 4. End-to-End Application Flow

1. **Input Reception**: The mobile app captures parent text and sends it to `POST /api/nlp/intent`.
2. **Intent Classification**: The NLP module uses Tier 1 (or Tier 2) AI to classify the text into an initial root cause, returning e.g. `CRY`.
3. **Session Initiation**: The app then starts a Q&A diagnosis session by requesting `POST /api/chat/start` with the `CRY` flow.
4. **Database Tree Traversal**: The backend fetches the root `DecisionTreeNode` for `CRY` from PostgreSQL and stores the state in a `ChatSession`. If the user provided a JWT token, the session is forever linked to their account history.
5. **Interactive Triage**: The user continuously calls `POST /api/chat/answer` with their responses. The backend dynamically traverses the relational Database tree until it hits a terminal `ConditionResponse` node.
6. **Final Advice**: The backend returns the final medical advice (e.g., "This might be colic. Try gentle rocking..."), and a `triageLevel` (e.g. `NORMAL`, `CONSULT_DOCTOR`), which the mobile app uses to alert the parent.

---

## 5. API Documentation
Detailed API schema and interactive testing is available through the automatically generated Swagger portal.
**URL**: `http://localhost:3000/api/docs` (when the server is running).
# inteligent-baby-minder-back
