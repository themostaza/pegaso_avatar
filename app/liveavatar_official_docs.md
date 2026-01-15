Overview of LiveAvatar
LiveAvatars are programmable interfaces that give a human touch to your AI Agents!

Introduction
A LiveAvatar is an AI-powered digital human that can interact with users in real time with both audio and video. Developers can integrate LiveAvatars into their apps or websites to create natural, conversational experiences such as:

Real-time product demos or virtual sales assistants
AI-powered support or training agents
Interactive hosts, tutors, or characters
At the heart of the system is the LiveAvatar Session — a live, persistent connection that allows users to speak or chat with an avatar. The session handles:

Streaming in user input (voice or text)
Feeding it into a language model (LLM) and generating a response
Rendering the response as with synchronized speech and video
This means every conversation feels dynamic, personal, and fully real-time.

LiveAvatar Configuration
When you start a session, three main layers work together:

Avatar (Visual Layer) — Defines what the avatar looks like. Choose from a wide selection of avatars, each with unique styles, appearances, and expressions.
Voice (Audio Layer) — Defines what the avatar sounds like. Choose a voices that fit your needs — from calm and professional to energetic or youthful.
Context (Cognitive Layer) — Defines how the avatar thinks and responds. Control the personality traits, background knowledge, and behavior, which guide how the LLM generates responses.
Each of these layers can be configured when creating a session, giving developers precise control over the avatar’s look, sound, and intelligence.

LiveAvatar Session
The Session is a core piece of the LiveAvatar API — it represents a single, continuous stream of interactions between a user and an avatar. Developers can observe and control interactions through a set of events and callbacks.

Under the hood, the Session manages connectivity, user input, avatar output, and conversational state. Throughout the session’s lifetime, the API emits events that let developer applications stay in sync with what’s happening — whether that’s a user speaking, the avatar responding, or the connection closing.


Quickstart
Set up your first conversation with a LiveAvatar.

We recommend developing with both a backend server and a managed frontend client. However, while you're prototyping and testing, this is a quick guide to help you have your first conversation with a LiveAvatar.

1. Create a Session Token
Before starting a session, generate a session token on your backend server. This token defines the configuration for the LiveAvatar session and also serves as a short-lived access token, allowing your frontend client to manage the session once it starts.

You can find your API token on the LiveAvatar settings page.

See the example curl command below to generate a session token for FULL mode.

cURL

curl --request POST \
     --url https://api.liveavatar.com/v1/sessions/token \
     --header 'X-API-KEY: <API Token>' \
     --header 'accept: application/json' \
     --header 'content-type: application/json'
     --data '{
				"mode": "FULL",
				"avatar_id": <avatar_id>,
        "avatar_persona": {
          "voice_id": <voice_id>,
          "context_id": <context_id>,
          "language": "en"
				}
      }'	
When successful, you'll receive both a session_id and session_token.


{
  "session_id": <new_session_id>,
	"session_token": <your_session_token>,
}
2. Start the Session
Once you have access to a session token, you're ready to start the session. This can be done via a quick call via the newly generated session_token.

cURL

curl --request POST \
     --url https://api.liveavatar.com/v1/sessions/start \
     --header 'accept: application/json' \
     --header 'authorization: Bearer <session_token>'
With this, we return a LiveKit room url along with the room token. We stream all the relevant information about the room user.

3. Join the LiveKit room
For this quick start, try directly joining the LiveKit room on your web-browser and chatting with the avatar. Simply navigate to our hosted LiveKit URL to experience the it for yourself.


https://meet.livekit.io/custom?liveKitUrl=[livekit_url]&token=[livekit_client_token]
Once you join the room, you'll now be chatting with a LiveAvatar!

4. Building your own experience
Let's now get you up and ready to build your own customized experiences. We recommend starting up your client facing services with the our existing SDKs and using our demos to help get additional inspiration. If you're building with npm, we recommend using our own npm package to help to abstract away the session management of LiveKit.

Examples - https://github.com/heygen-com/liveavatar-web-sdk
NPM - https://www.npmjs.com/package/@heygen/liveavatar-web-sdk?activeTab=versions
You can also check out our API documentation to see all available functionality.


Developing in Sandbox Mode
Developing on top of LiveAvatar sessions can consume a lot of credits.

That's why we've decided to build Sandbox Mode. The intend is to help developers build and iterate on their API integrations without burning through credits better suited for production.

What is Sandbox Mode
Sandbox Mode is a special execution mode for LiveAvatar sessions designed for development and testing. It allows you to integrate, experiment, and validate your LiveAvatar workflows without consuming credits.

• Verifying your API integration • Testing session lifecycle events • Iterating on frontend or backend logic • Debugging any existing audio/video pipelines

While Sandbox Mode mirrors production behavior, it intentionally applies strict limits to prevent excessive resource usage.

Sandbox Mode Behaviors
In sandbox mode, the following behaviors apply:

Avatar Restrictions - developers will only be able to use a select subset of production avatars.
Wayne - dd73ea75-1218-4ef3-92ce-606d5f7fbc0a (id)
Session Duration Limits - sandbox mode sessions will terminate in around 1 minute. The session will automatically close and be treated as a maximum duration reached.
No credit usage - sandbox mode does not require any credits to start and will not consume any credits.
These constraints ensure Sandbox Mode remains a safe and cost-free environment for development while still providing realistic behavior.

Enabling Sandbox Mode
To enable Sandbox Mode, include the is_sandbox flag when creating a LiveAvatar token Create Session Token.




Configuring Full Mode
When you use LiveAvatars in Full Mode, we deal with the common setup pains with setting up realtime chat, including:

Large Language Models (LLMS)
Voice Activity Detection (VAD)
Text-to-Speech (TTS)
This frees you up focusing on building the best possible product for your use case.

Configuration Options
As of right now, we offer the following ways to personalize your LiveAvatar experience.

Avatars - control how the avatar looks
Voices - control how the avatar sounds
Context - control how the avatar thinks and responds
Mixing and matching the three creates unique experiences for your exact use case.

Avatars
An avatar determines the visual appearance of your AI agent. Developers can select from a catalog of avatars — ranging from realistic human presenters to stylized or expressive characters.

Each avatar can be uniquely identified by its avatar_id.

You can preview all available avatars here.

Avatar Personas
In addition to controlling the look of the Avatar, you can control additional features of the Avatar including it's voice and the context (think of it as the Avatar's personality).

Voices
A voice defines the sound and personality of your avatar’s speech. Voices can have many variabilities including gender, age, tones, and accents. Some voices are also better at some languages compared to others.

You can preview all available voices here.

Context
The context allows you to shape how your avatar will think and respond. This layer defines the information available to the avatar, the constraints replied to it, and any quirky personalities you want your avatar to have.

Each context includes an opening text, that will be said at the start of each LiveAvatar session, and instructions to direct the responses you want your avatar to generate. If no opening text is provided in the context, then we will not say anything to begin with.

What happens if no context is passed in
Contexts can be passed in when first creating a session token. If no context is supplied, the avatar will operate in a more restricted manner.

The avatar will not generate any responses to user conversation input We still emit user transcript events, which transcribe what the user says.
Avatars can still repeat phrases that you want them to say.
You can manage all your contexts here.

Wrapping Up
Combining the three together, you can customize your LiveAvatar to make the avatar look, sound, and respond consistently throughout the conversation, exactly how you want it to.




LiveAvatar Session Life Cycle
Manage your web app through out the client life cycle.

A LiveAvatar Session represents a real-time, two-way interaction between a user and an AI avatar. From a developer’s perspective, a session behaves like a live room that you can join, stream data into, and listen for key events as the conversation unfolds.

While every session may look different depending on your integration, they all follow a similar lifecycle.

1. Starting a Session and connecting to the LiveKit room
To begin, configure the session by specifying the desired avatar, voice, and context, then create the session via our API. In response, you’ll receive connection details that allow both your user and the avatar to join the same LiveKit room.

Once connected to the room via WebRTC, the session becomes active — enabling real-time exchange of audio, video, and text data between the user and the avatar.

At this point, the conversation environment is fully live and ready for interaction.

2. Managing the Session
Full Mode
After both the user and the avatar have joined the room, they can begin interacting in real time. From this point forward, the session is driven by a combination of client-side and server-side events that coordinate communication.

Command / Client-side events allow developers to send signals or issue commands to the avatar — for example, instructing it to speak a certain phrase, or handle an interrupt while it's speaking.
Server-side events are emitted by the session to report what’s happening — such as when the avatar starts or stops speaking or when the connection state changes.
By listening to these events, you can build responsive, adaptive experiences — updating your UI in real time, triggering custom animations, or handling interruptions gracefully.

In essence, client-side and server-side events form the backbone of the conversational loop: your app sends signals to the avatar, and the session broadcasts updates so your interface stays in sync.

See the event list to see the up to date supported events.

Custom Mode
In Custom Mode, we will no longer emit events on the state of the application. We assume that you have pre-existing full control and instead we offer is a way to pass in input audio via an websocket connection. We then output video frame data via the livekit room.

First, connect to the websocket endpoint. Wait for the session to be properly connected before sending any command events. There is a server event, session.state_updated which we send when the connection is ready. If you try to send command events before the session is connected, you will receive errors from the LiveAvatar side.


Notes
In both Full and Custom mode, we have a idleness shutdown mechanism in place. Our avatar will disconnect after detecting a prolonged period of inactivity. If you want to keep the session alive while waiting, two options to do so are

Calling our /keep-alive endpoint
Sending a command event to ensure the session remains active.
3. Ending the Session
When the interaction is complete, the session is closed. In most cases, this happens when the client ends the connection after the user finishes the conversation.

The server may also terminate a session under certain conditions, including (but not limited to):

No user detected in the room
Insufficient credits or quota remaining for streaming
When a session ends, both the user and the avatar are disconnected from the room, and all active media streams are stopped. You can use this moment to clean up resources, show a summary screen, or prompt the user to start a new session.




FULL Mode Life Cycle
1. Starting a Session and connecting to the LiveKit Room
In FULL mode, you are able to configure and specify

the avatar (via avatar_id)
the avatar persona including
voice
context
See here for more details - https://docs.liveavatar.com/update/docs/full-mode-configurations.

Connecting and starting the session is otherwise the same process.

2. Managing the Session
In FULL mode, we will emit events on the whole state of the conversation. As such, via the client-side and server side events, you have access to:

when the user/avatar is speaking.
realtime transcript data on what the user/avatar is saying
control over avatar behaviors such as:
interrupting
changing between idle and listening state
direct control on what you want the avatar to say / respond to, in addition to processing user audio input.
See FULL mode's event list to see the up to date supported events

3. Ending the Session
When the session is closed, we will do the following.

Close the LiveKit room
Our Avatar will leave the room and we will kick the user from the room if present.
While there are no resources that we expect the developers to manage, we also recommend cleaning up any resources that is used externally.



FULL Mode Events
In Full Mode, we process events that are sent via the LiveKit Protocol. Simply send these events into the LiveKit room session and we will process all of them. All FULL mode events will be structured in the following JSON format.


{
  "event_type": str, // name of the event
  ... // event data passed passed in. 
}
To differentiate between command and server events, we track different LiveKit room topics. You will need to publish/subscribe to specific topics in-order to track this data.

Command Events
For command events, these events need to be published to this topic: agent-control.

Below is the list of all events available that allow you to better control the state of the avatar.

Name / event_type	Additional Event Data	Description
avatar.interrupt	N/A	Interrupts and stops any scheduled commands. This will disrupt the entire sequence of calls passed in.
avatar.speak_text	{"text": string}	Instructs the avatar to say the spoken text
avatar.speak_response	{"text": string}	Instruct the avatar to generate an LLM response to the input text
avatar.start_listening	N/A	Instructs the avatar to switch to a listening state. Most of the time, avatars sit in an idle state when they are not speaking.
avatar.stop_listening	N/A	Instructs the avatar to leave the listening state and return to the idle state.
Server Events
For server events, these events will be emitted to the topic, agent-response

Throughout the Session, we will emit these events. Developers will be able to listen in to whichever events they deem necessary to build additional experiences on the user interface.

Name / event_type

Additional Event Data

Description

user.speak_started

N/A

The user in the LiveKit room has started sending us audio data.

user.speak_ended

N/A

The user in the LiveKit room is no longer sending us audio data.

Always follows a user.speak_started event

avatar.speak_started

N/A

The avatar in the LiveKit room started sending audio output

avatar.speak_ended

N/A

The avatar in the LiveKit room finished sending audio output.

Always follows a avatar.speak_started event.

user.transcription_started

N/A

We've started processing the input audio and converting it into text.

user.transcription_ended

{"text": string}

We've finished processing the input audio. The transcribed text is included in the event data under text.

avatar.transcription_started

N/A

The avatar's text response is being formed.

When calling avatar.speak_text, we will immediately emit this event and avatar.transcription_ended with the input text.

When calling `avatar.speak_response, we will emit this event prior to LLM generation.

avatar.transcription_ended

{"text": string}

The avatar's text response is being formed.

When calling avatar.speak_text, we will immediately emit this event and avatar.transcription_ended with the input text.

When calling avatar.speak_response, we emit this event after LLM generation.




Recommended Architecture
We recommend all developers using LiveAvatar to follow this high level approach. Set up both a backend and frontend services.

Have the backend initiate and track the session state as it occurs
Have the frontend manage the users respective responses and interactions.

The main developer experience is revolved around the events being sent to/from the LiveKit room. By sending client events and listening to server events, developers can both monitor and control exactly what and how the Avatar response.

Limited Existing Conversational Stack
If you don't have an existing LLM + Voice (VAD + TTS) stack or a few existing pieces, we recommend using FULL mode. A few calls to instantiate the session is all that is required by your backend server. We recommend building out the user experience on the frontend instead, leveraging our low latencies to immediately change the state.

Existing Developers Conversation Stack
We recommend developing with CUSTOM mode. Have your backend process the user input audio, and generate a custom response with whichever frameworks you want. Then send the outputted audio directly into LiveAvatar.

Using Custom, you should have full control over all services in your conversation stack. We will now expose a websocket link after starting a sesison.

We recommend establishing a connection with your backend service and streaming the output of your audio directly into our websocket. We'll stream back the generated avatar frame data that you can then send to your application.






