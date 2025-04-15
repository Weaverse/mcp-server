import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
const endpoint = "https://weaverse.io/api/public/rag";

async function* streamRagResponse(
	response: Response,
): AsyncGenerator<string, void, unknown> {
	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("No response body received");
	}

	console.log("🎯 Starting stream reading");
	const decoder = new TextDecoder();
	let partialLine = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				console.log("🏁 Stream reading completed");
				break;
			}

			const chunk = decoder.decode(value);
			partialLine += chunk;

			// Process complete lines
			let newlineIndex: number = partialLine.indexOf("\n");
			while (newlineIndex !== -1) {
				const line = partialLine.slice(0, newlineIndex).trim();
				partialLine = partialLine.slice(newlineIndex + 1);

				if (line.startsWith("data: ")) {
					try {
						const jsonStr = line.slice(6).trim();
						if (jsonStr === "[DONE]") {
							console.log("🏁 Stream ended with [DONE] marker");
							continue;
						}
						const data = JSON.parse(jsonStr);
						if (data.response) {
							console.log("📦 Received chunk:", {
								responseLength: data.response.length,
								nonce: data.nonce,
							});
							yield data.response;
						}
					} catch (e) {
						console.error("❌ Error parsing SSE data:", e, "\nLine:", line);
					}
				}
				newlineIndex = partialLine.indexOf("\n");
			}
		}
	} catch (error) {
		console.error("❌ Error in stream reading:", error);
		throw error;
	} finally {
		console.log("🧹 Cleaning up stream reader");
		reader.releaseLock();
	}
}

export async function queryRag(prompt: string, stream = false) {
	console.log("🚀 Starting RAG query:", { prompt, stream });
	try {
		// call weaverse api to search docs
		const response = await fetch(
			`${endpoint}?query=${encodeURIComponent(prompt)}&stream=${stream}`,
		);

		console.log("📥 RAG response received:", {
			status: response.status,
			headers: Object.fromEntries(response.headers.entries()),
			hasBody: !!response.body,
		});

		if (stream) {
			if (!response.body) {
				console.error("❌ No response body for streaming");
				throw new Error("No response body received");
			}
			return {
				success: true,
				stream: streamRagResponse(response),
			};
		}

		const res = await response.json();
		if (res.success) {
			const { data } = res.result;
			return {
				success: true,
				formattedText: JSON.stringify(data),
			};
		}
		return {
			success: false,
			formattedText: "No results found",
		};
	} catch (error) {
		return {
			success: false,
			formattedText: "No results found",
		};
	}
}

export function weaverseTools(server: McpServer) {
	server.tool(
		"search_weaverse_docs",
		`This tool will take in the user prompt, search docs and return relevant documentation that will help answer the user's question.`,
		{
			prompt: z
				.string()
				.describe("The search query for Weaverse documentation"),
			stream: z
				.boolean()
				.optional()
				.default(false)
				.describe("Whether to stream the response"),
		},
		async ({ prompt, stream }) => {
			const result = await queryRag(prompt, stream);

			if (stream && result.success && result.stream) {
				// For streaming, accumulate chunks and return as a single string
				let fullResponse = "";
				try {
					for await (const chunk of result.stream) {
						fullResponse += chunk;
					}
				} catch (error) {
					console.error("Error in stream processing:", error);
					return {
						content: [
							{
								type: "text",
								text: "Error processing stream response",
							},
						],
					};
				}

				return {
					content: [
						{
							type: "text",
							text: fullResponse || "No results found",
						},
					],
				};
			}

			// For non-streaming response
			return {
				content: [
					{
						type: "text",
						text: result.formattedText || "No results found",
					},
				],
			};
		},
	);
}
