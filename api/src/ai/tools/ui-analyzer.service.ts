import { Injectable, Logger } from '@nestjs/common';
import { ChatAnthropic } from '@langchain/anthropic';
import { PageSchema, ComponentSchema, type Page as UiPage, type Component as UiComponent, BaseUISchema } from '@zazos/schemas';
import { z } from 'zod';

// Schema for LLM to generate (only description and components array of strings)
const LlmSchema = z.object({
  description: z.string().optional(),
  components: z.array(z.string()).default([]),
});

@Injectable()
export class UiAnalyzerService {
  private readonly logger = new Logger(UiAnalyzerService.name);
  private readonly model: ChatAnthropic;

  constructor() {
    this.model = new ChatAnthropic({
      model: process.env.AI_MODEL_MINI || 'claude-3-haiku-20240307',
      temperature: 0.1,
    });
  }

  async analyze(content: string, kind: 'page' | 'component'): Promise<z.infer<typeof LlmSchema>> {
    
    const structuredLlm = this.model.withStructuredOutput(LlmSchema);

    const prompt = `Analyze this React ${kind} file and extract structured information.
The file content is:
\`\`\`jsx
${content.slice(0, 4000)}${content.length > 4000 ? '\n... (truncated)' : ''}
\`\`\`

Based on the code, provide:
1. A brief "description" of the component's or page's main purpose and functionality.
2. A "components" array listing all imported local components names, based on the import statement.

Focus ONLY on local project components (e.g., imports from './', '../', '@/components/', '@/pages/').
IGNORE imports from libraries like 'react', 'lucide-react', or external packages.
IGNORE imports from '@ /components/ui' (UI primitives).
If no local components are imported, return an empty array for "components".`;

    try {
      this.logger.log(`Analyzing with LLM (kind=${kind})...`);
      const result = await structuredLlm.invoke(prompt);
      this.logger.log(`LLM analysis successful.`);
      // Ensure components is always an array
      return {
        description: result.description,
        components: result.components || [],
      };
    } catch (error) {
      this.logger.error(`LLM analysis failed`, error);
      // Return a minimal fallback structure on error
      return { description: 'Analysis failed.', components: [] } as z.infer<typeof LlmSchema>;
    }
  }
}
