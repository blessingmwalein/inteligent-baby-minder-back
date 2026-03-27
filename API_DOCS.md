# Intelligent Baby Minder Backend - API Examples

## 1. NLP Intent Detection

**Endpoint**: `POST /api/nlp/intent`  
**Description**: Analyzes raw text using rule-based algorithms to detect the core infant issue (CRY, FACE, SKIN, UNKNOWN).

**Request Body:**
```json
{
  "message": "The baby is making a high pitched wail and pulling legs up."
}
```

**Response:**
```json
{
  "intent": "CRY"
}
```

## 2. Start Chat Session

**Endpoint**: `POST /api/chat/start`  
**Description**: Initializes a new decision tree flow for a specific intent type.

**Request Body:**
```json
{
  "flowType": "CRY"
}
```

**Response:**
```json
{
  "sessionId": "a1b2c3d4-e5f6-...",
  "question": "Is the baby crying continuously for more than 3 hours a day?",
  "isFinal": false,
  "nodeId": "1111-2222-3333"
}
```

## 3. Answer Chat Session

**Endpoint**: `POST /api/chat/answer`  
**Description**: Continues the chat flow based on user input, returning the next question or final triage advice.

**Request Body:**
```json
{
  "sessionId": "a1b2c3d4-e5f6-...",
  "answer": "yes"
}
```

**Response (Continuing flow):**
```json
{
  "isFinal": false,
  "question": "Does the baby pull their legs to their stomach or clench their fists?",
  "nodeId": "5555-6666-7777"
}
```

**Response (Final state reached):**
```json
{
  "isFinal": true,
  "advice": "This might be colic. Try gentle rocking, a pacifier, or consult your pediatrician if worried.",
  "triageLevel": "CONSULT_DOCTOR"
}
```
