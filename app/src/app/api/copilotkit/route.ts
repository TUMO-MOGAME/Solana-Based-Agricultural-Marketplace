import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
  ExperimentalEmptyAdapter,
} from "@copilotkit/runtime";
import { NextRequest } from "next/server";
import { A2AClientAgent } from "./a2a";
import { openai } from "@ai-sdk/openai";

const COACHING_URL =
  process.env.COACHING_URL || "http://127.0.0.1:9995"; // Content Coaching Agent

const runtime = new CopilotRuntime({
  agents: {
    a2a_chat: new A2AClientAgent({
      model: openai("gpt-4o", { parallelToolCalls: false }),
      agentUrls: [COACHING_URL],
      instructions: `
          You are a Social Assembly assistant. You have one specialist agent to help the user.

          AVAILABLE AGENT:
          - Content Coaching Agent: Reviews images and videos (via URL), scores visual quality, predicts engagement, and gives actionable improvements to help content creators grow their audience

          ROUTING RULES:
          - For image or video review, content quality, engagement coaching, or social media growth → Route to Content Coaching Agent
          - For general questions you can answer directly, do so without routing

          ARTIFACT PANEL (SIDE PANEL FOR LONG CONTENT):
          - For ANY long-form response (reports, detailed analysis, comparisons, step-by-step guides) more than 3-4 paragraphs → use the "showArtifact" tool to display it in the side panel. Write content in markdown.
          - For code snippets or config files → use "showCodeArtifact" tool.
          - For browsing/viewing websites → use "showBrowserView" tool with the URL.
          - For HTML previews or generated UI → use "showHtmlPreview" tool.
          - Always provide a SHORT summary in chat (1-2 sentences) when opening an artifact.
          - ALWAYS prefer artifacts for structured, detailed content. Keep chat messages concise.

          ALWAYS communicate back to the relevant agent after making a tool call on its behalf.
   `,
    }),
  },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: req.nextUrl.pathname,
  });

  return handleRequest(req);
};
