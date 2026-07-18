# English Conversation Tutor Bot — Bot specification

**Archetype:** education

**Voice:** professional and encouraging — write every user-facing message, button label, error, and empty state in this voice.

A free Telegram bot that helps school students and adults improve conversational English through open chat practice and optional guided exercises. Provides immediate corrective feedback with explanations, vocabulary/grammar tips, example rewrites, and simple progress tracking.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- school students
- adult English learners

## Success criteria

- 10,000+ active weekly users practicing English through chat sessions
- Average 3 corrections per session in free chat mode
- 80% user retention after completing onboarding

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu for first-time users or return to dashboard
- **Start Guided Exercise** (button, actor: user, callback: guided:start) — Begin structured language exercise with targeted feedback
- **Start Free Conversation** (button, actor: user, callback: free_chat:start) — Begin open conversation practice with contextual prompts
- **Daily Reminder: On/Off** (button, actor: user, callback: reminder:toggle) — Enable/disable daily practice notifications
- **View Progress** (button, actor: user, callback: progress:view) — Show session history, learning streaks, and saved corrections

## Flows

### onboarding_flow
_Trigger:_ /start

1. Greet user
2. Collect learning level and topics
3. Store profile data
4. Show quick-start options

_Data touched:_ user_profile

### free_chat_flow
_Trigger:_ free_chat:start

1. Generate contextual prompt
2. Receive user response
3. Analyze for errors
4. Provide correction with explanation
5. Offer help buttons

_Data touched:_ conversation_session, correction_item

### guided_exercise_flow
_Trigger:_ guided:start

1. Select appropriate exercise
2. Present prompt with hints
3. Evaluate response
4. Provide structured feedback
5. Save session data

_Data touched:_ guided_exercise, conversation_session

### correction_flow
_Trigger:_ user message with errors

1. Identify errors
2. Generate corrected version
3. Create explanation and example
4. Display inline with save option

_Data touched:_ correction_item, conversation_session

### progress_flow
_Trigger:_ progress:view

1. Retrieve session history
2. Calculate streaks
3. Display saved corrections
4. Offer export options

_Data touched:_ user_profile, conversation_session

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **user_profile** _(retention: persistent)_ — User learning preferences and history
  - fields: user_id, name, learning_level, preferred_topics, correction_mode, reminder_setting, session_count, current_streak
- **conversation_session** _(retention: persistent)_ — Record of practice interactions
  - fields: session_id, user_id, mode, topic, messages, corrections, timestamp
- **correction_item** _(retention: persistent)_ — Individual correction with explanation
  - fields: correction_id, session_id, original_text, corrected_text, explanation, example
- **guided_exercise** _(retention: persistent)_ — Predefined structured practice scenarios
  - fields: exercise_id, topic, prompt, target_structures, feedback_templates

## Integrations

- **Telegram** (required) — Bot API messaging and notifications
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Manage user profiles
- Edit guided exercise content
- View aggregate usage statistics
- Configure notification timing
- Export user data for analysis

## Notifications

- Daily practice reminder at 09:00 local time (configurable)

## Permissions & privacy

- User data visible only to the user
- No third-party data sharing
- Local storage of conversation history
- Optional name sharing with the bot

## Edge cases

- Users requesting corrections for non-English input
- Handling ambiguous grammar errors
- Managing time zones for notifications
- Users disabling notifications mid-session

## Required tests

- End-to-end onboarding flow with profile creation
- Correction accuracy in free chat mode
- Guided exercise feedback consistency
- Progress tracking dashboard functionality
- Notification toggle behavior across time zones

## Assumptions

- Users will self-assess learning levels accurately
- Common error patterns can be addressed with single-sentence corrections
- Daily reminders at 09:00 is optimal for habit formation
- Saved corrections will be sufficient for personal review
