import {
  AbstractAgent,
  AgentConfig,
  BaseEvent,
  EventType,
  RunAgentInput,
  RunErrorEvent,
  StateSnapshotEvent,
  TextMessageChunkEvent,
  ToolCallChunkEvent,
  ToolCallResultEvent,
} from "@ag-ui/client";
import { A2AClient, SendMessageSuccessResponse, AgentCard } from "@a2a-js/sdk";
import { Observable, Observer } from "rxjs";
import {
  LanguageModel,
  processDataStream,
  streamText,
  tool,
  jsonSchema,
  Tool,
} from "ai";
import {
  convertMessagesToVercelAISDKMessages,
  createSystemPrompt,
} from "./utils";
import { randomUUID } from "crypto";

export interface A2AAgentConfig extends AgentConfig {
  agentUrls: string[];
  instructions?: string;
  model: LanguageModel;
}

interface AgentState {
  a2aMessages: Array<{
    name: string;
    to: string;
    message: string;
  }>;
}

interface AgentInfo {
  client: A2AClient;
  card: unknown;
}

export class A2AClientAgent extends AbstractAgent {
  private agentClients: A2AClient[];
  private instructions?: string;
  private model: LanguageModel;

  constructor(config: A2AAgentConfig) {
    super(config);
    this.instructions = config.instructions;
    this.agentClients = config.agentUrls.map((url) => new A2AClient(url));
    this.model = config.model;
  }

  protected run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((observer) => {
      this.executeRun(input, observer).catch((error) => {
        this.handleRunError(error, input, observer);
      });
    });
  }

  private async executeRun(
    input: RunAgentInput,
    observer: Observer<BaseEvent>
  ): Promise<void> {
    const state = this.initializeState();

    this.emitRunStarted(input, observer);
    this.emitStateSnapshot(state, observer);

    const agents = await this.setupAgents();
    const messages = this.prepareMessages(input, agents);
    const tools = this.createTools(input, agents, state, observer);

    await this.processStreamResponse(messages, tools, observer);

    this.emitRunFinished(input, observer);
    observer.complete();
  }

  private initializeState(): AgentState {
    return { a2aMessages: [] };
  }

  private emitRunStarted(
    input: RunAgentInput,
    observer: Observer<BaseEvent>
  ): void {
    observer.next({
      type: EventType.RUN_STARTED,
      timestamp: Date.now(),
      rawEvent: {
        threadId: input.threadId,
        runId: input.runId,
      },
    });
  }

  private emitRunFinished(
    input: RunAgentInput,
    observer: Observer<BaseEvent>
  ): void {
    observer.next({
      type: EventType.RUN_FINISHED,
      timestamp: Date.now(),
      rawEvent: {
        threadId: input.threadId,
        runId: input.runId,
      },
    });
  }

  private emitStateSnapshot(
    state: AgentState,
    observer: Observer<BaseEvent>
  ): void {
    observer.next({
      type: EventType.STATE_SNAPSHOT,
      snapshot: state,
    } as StateSnapshotEvent);
  }

  private async setupAgents(): Promise<Record<string, AgentInfo>> {
    const agentCards = await Promise.all(
      this.agentClients.map((client) => client.getAgentCard())
    );

    return Object.fromEntries(
      agentCards.map((card, index) => [
        card.name,
        { client: this.agentClients[index], card },
      ])
    );
  }

  private prepareMessages(
    input: RunAgentInput,
    agents: Record<string, AgentInfo>
  ) {
    const agentCards = Object.values(agents).map(
      ({ card }) => card as AgentCard
    );
    const systemPrompt = createSystemPrompt(agentCards, this.instructions);

    const messages = convertMessagesToVercelAISDKMessages(input.messages);

    // Remove existing system message if present
    if (messages.length && messages[0].role === "system") {
      messages.shift();
    }

    // Add our system prompt
    messages.unshift({
      role: "system",
      content: systemPrompt,
    });

    return messages;
  }

  private createTools(
    input: RunAgentInput,
    agents: Record<string, AgentInfo>,
    state: AgentState,
    observer: Observer<BaseEvent>
  ): Record<string, Tool> {
    const sendMessageTool = this.createSendMessageTool(agents, state, observer);

    const inputTools: Record<string, Tool> = {};
    for (const t of input.tools) {
      inputTools[t.name] = tool({
        description: t.description,
        parameters: jsonSchema(t.parameters),
      });
    }

    return {
      ...inputTools,
      sendMessage: sendMessageTool,
    };
  }

  private createSendMessageTool(
    agents: Record<string, AgentInfo>,
    state: AgentState,
    observer: Observer<BaseEvent>
  ) {
    return tool({
      description:
        "Sends a task to the agent named `agentName`, including the full conversation context and goal.",
      parameters: jsonSchema({
        type: "object",
        properties: {
          agentName: {
            type: "string",
            description: "The name of the agent to send the task to.",
          },
          task: {
            type: "string",
            description:
              "The comprehensive conversation-context summary and goal " +
              "to be achieved regarding the user inquiry.",
          },
        },
        required: ["agentName", "task"],
      }),
      // @ts-expect-error - Tool execute function type isn't properly inferred
      execute: async ({
        agentName,
        task,
      }: {
        agentName: string;
        task: string;
      }) => {
        // Log outgoing message
        state.a2aMessages.push({
          name: "Agent",
          to: agentName,
          message: task,
        });
        observer.next({
          type: EventType.STATE_SNAPSHOT,
          snapshot: state,
        } as StateSnapshotEvent);

        // Validate agent exists
        if (!agents[agentName]) {
          return `Agent "${agentName}" not found.`;
        }

        // Send message to agent
        const { client } = agents[agentName];
        const sendResponse = await client.sendMessage({
          message: {
            kind: "message",
            messageId: Date.now().toString(),
            role: "agent",
            parts: [{ text: task, kind: "text" }],
          },
        });

        if ("error" in sendResponse) {
          console.error(sendResponse.error);
          return `Error sending message to agent "${agentName}": ${sendResponse.error.message}`;
        }

        // Process response
        const result = (sendResponse as SendMessageSuccessResponse).result;

        if (
          result.kind === "message" &&
          result.parts.length > 0 &&
          result.parts[0].kind === "text"
        ) {
          state.a2aMessages.push({
            name: agentName,
            to: "Agent",
            message: result.parts[0].text,
          });
          observer.next({
            type: EventType.STATE_SNAPSHOT,
            snapshot: state,
          } as StateSnapshotEvent);
        }

        return "The agent responded: " + JSON.stringify(result);
      },
    });
  }

  private async processStreamResponse(
    messages: Parameters<typeof streamText>[0]["messages"],
    tools: Record<string, Tool>,
    observer: Observer<BaseEvent>
  ): Promise<void> {
    const response = streamText({
      model: this.model,
      messages,
      tools,
      maxSteps: 10,
      toolCallStreaming: true,
    });

    let messageId = randomUUID();

    await processDataStream({
      stream: response.toDataStreamResponse({
        getErrorMessage: (error) => {
          console.log("ERROR", error);
          return error instanceof Error ? error.message : "Unknown error";
        },
      }).body!,
      onTextPart: (text) => {
        observer.next({
          type: EventType.TEXT_MESSAGE_CHUNK,
          role: "assistant",
          messageId,
          delta: text,
        } as TextMessageChunkEvent);
      },
      onFinishMessagePart: () => {
        messageId = randomUUID();
      },
      onToolCallStreamingStartPart: (streamPart) => {
        observer.next({
          type: EventType.TOOL_CALL_CHUNK,
          toolCallId: streamPart.toolCallId,
          parentMessageId: messageId,
          toolCallName: streamPart.toolName,
        } as ToolCallChunkEvent);
      },
      onToolCallDeltaPart: (streamPart) => {
        observer.next({
          type: EventType.TOOL_CALL_CHUNK,
          toolCallId: streamPart.toolCallId,
          delta: streamPart.argsTextDelta,
          parentMessageId: messageId,
        } as ToolCallChunkEvent);
      },
      onToolResultPart: (streamPart) => {
        observer.next({
          messageId: randomUUID(),
          type: EventType.TOOL_CALL_RESULT,
          toolCallId: streamPart.toolCallId,
          content:
            typeof streamPart.result === "string"
              ? streamPart.result
              : JSON.stringify(streamPart.result),
        } as ToolCallResultEvent);
      },
      onErrorPart: (streamPart) => {
        console.log("ERROR PART", JSON.stringify(streamPart));
      },
    });
  }

  private handleRunError(
    error: unknown,
    input: RunAgentInput,
    observer: Observer<BaseEvent>
  ): void {
    observer.next({
      type: EventType.RUN_ERROR,
      threadId: input.threadId,
      runId: input.runId,
      message: error instanceof Error ? error.message : "Unknown error",
    } as RunErrorEvent);
    observer.error(error);
  }
}
