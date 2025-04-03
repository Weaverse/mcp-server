import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const handleResponse = (prompt: string, menu: DocsReference) => {
  let allArticles = menu.flatMap(({ title, headings }) => {
    return headings.map((heading) => ({
      ...heading,
      collectionTitle: title,
    }));
  });

  // Split prompt into keywords and create regex patterns
  const keywords = prompt.toLowerCase().split(/\s+/).filter(k => k.length > 2);
  const regexPatterns = keywords.map(k => new RegExp(k, 'ig'));

  // Score and filter articles based on keyword matches
  const scoredArticles = allArticles.map(article => {
    let score = 0;
    
    // Check title matches (highest weight)
    regexPatterns.forEach(regex => {
      if (article.title.match(regex)) score += 3;
    });

    // Check description matches (medium weight) 
    regexPatterns.forEach(regex => {
      if (article.description.match(regex)) score += 2;
    });

    // Check content matches (lowest weight)
    regexPatterns.forEach(regex => {
      if (article.content.match(regex)) score += 1;
    });

    return {
      article,
      score
    };
  });

  // Filter articles with any matches and sort by score
  const filteredArticles = scoredArticles
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.article)
    .slice(0, 3); // Limit to top 3 most relevant articles

  if (!filteredArticles.length) {
    return {
      success: false,
      formattedText: 'No results found',
    };
  }

  // Combine content from top articles and limit to 3000 words
  const combinedContent = filteredArticles
    .map(article => {
      return `## ${article.title}\n${article.content}`;
    })
    .join('\n\n');

  const words = combinedContent.split(/\s+/);
  const truncatedContent = words.slice(0, 3000).join(' ');

  return {
    success: true,
    formattedText: truncatedContent,
  };
};

export async function searchDocs(prompt: string) {
  try {
    // call weaverse api to search docs
    const response = await fetch(
      `https://weaverse.io/api/public/get-search-docs`
    );
    const data = await response.json();
    const result = handleResponse(prompt, data);
    return result;
  } catch (error) {
    return {
      success: false,
      formattedText: 'No results found xx',
    };
  }
}

export function weaverseTools(server: McpServer) {
  server.tool(
    'search_docs',
    `This tool will take in the user prompt, search docs and return relevant documentation that will help answer the user's question.`,
    {
      prompt: z
        .string()
        .describe('The search query for Weaverse documentation'),
    },
    async ({ prompt }) => {
      const result = await searchDocs(prompt);
      return {
        content: [
          {
            type: 'text',
            text: result.formattedText,
          },
        ],
      };
    }
  );
}
