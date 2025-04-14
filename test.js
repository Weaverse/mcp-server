import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
	const transport = new StdioClientTransport({
		command: "node",
		args: ["build/index.js"],
	});

	const client = new Client({
		name: "test-client",
		version: "1.0.0",
	});

	try {
		// Connect to the server
		await client.connect(transport);
		console.log("🔌 Connected to server\n");

		// List available tools
		console.log("🔧 Available tools:");
		const tools = await client.listTools();
		console.log(tools);
		console.log("\n-------------------\n");

		// Test streaming query with a complex question
		console.log("🔄 Testing streaming response:");
		console.log(
			'Query: "How do I create a custom section with product recommendations?"\n',
		);

		const streamingResult = await client.callTool({
			name: "search_weaverse_docs",
			arguments: {
				prompt:
					"How do I create a custom section with product recommendations?",
				stream: true,
				rewrite_query: true, // Enable query optimization
				max_num_results: 5, // Limit to top 5 most relevant results
			},
		});

		console.log("📝 Streaming response:");
		console.log("-------------------");

		// Log the structure of the streaming result
		console.log("Stream result structure:", {
			hasContent: !!streamingResult.content,
			contentLength: streamingResult.content.length,
			firstContentType: streamingResult.content[0]?.type,
			textIterator: !!streamingResult.content[0]?.text,
			textType: typeof streamingResult.content[0]?.text,
			isAsyncIterable:
				streamingResult.content[0]?.text?.[Symbol.asyncIterator] !== undefined,
		});

		// Handle streaming response
		let responseBuffer = "";
		let chunkCount = 0;

		if (!streamingResult.content[0]?.text) {
			console.error("❌ No text iterator found in the response");
			process.exit(1);
		}

		try {
			for await (const chunk of streamingResult.content[0].text) {
				chunkCount++;
				responseBuffer += chunk;
				// Show progress
				process.stdout.write(".");
			}

			console.log("\n\n📄 Complete response:");
			console.log("===================");
			console.log(responseBuffer);
			console.log("===================");
			console.log("\n📊 Stats:");
			console.log(`Total chunks received: ${chunkCount}`);
			console.log(`Total response length: ${responseBuffer.length} characters`);

			console.log("\n✅ Test completed successfully");
		} catch (error) {
			console.error("❌ Error during streaming:", error);
			throw error;
		}
	} catch (error) {
		console.error("❌ Error:", error);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("❌ Fatal error:", error);
	process.exit(1);
}); 