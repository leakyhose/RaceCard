import { config } from "dotenv";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import * as z from "zod";
import type { Flashcard } from "@shared/types.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const termPromptFile = process.env.TERM_PROMPT_FILE || "termPrompt.txt";
const definitionPromptFile =
  process.env.DEFINITION_PROMPT_FILE || "definitionPrompt.txt";

const termPrompt = fs.readFileSync(
  path.join(__dirname, "..", termPromptFile),
  "utf8",
);
const definitionPrompt = fs.readFileSync(
  path.join(__dirname, "..", definitionPromptFile),
  "utf8",
);

let client: OpenAI | null = null;

function getClient() {
  if (!client && process.env.OPENAI_API_KEY) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}

// Zod schemas for term and definition distractors
const TermDistractorSet = z.object({
  distractors: z.array(z.array(z.string().min(1)).length(3)),
});

const DefinitionDistractorSet = z.object({
  distractors: z.array(z.array(z.string().min(1)).length(3)),
});

// Generate term distractors (match the "question" field)
async function generateTermDistractors(
  apiClient: OpenAI,
  flashcards: Flashcard[],
  onProgress?: (completed: number, total: number) => void,
): Promise<string[][]> {
  const BATCH_SIZE = 50;
  const allDistractors: string[][] = [];

  // Split into batches and process in parallel
  const batches: Flashcard[][] = [];
  for (let i = 0; i < flashcards.length; i += BATCH_SIZE) {
    batches.push(flashcards.slice(i, i + BATCH_SIZE));
  }

  let completedBatches = 0;
  const totalBatches = batches.length;

  // Process all batches in parallel
  const batchPromises = batches.map(async (batch, batchIndex) => {
    const cleanedBatch = batch.map((card) => card.question);
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await apiClient.chat.completions.parse({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content: termPrompt,
            },
            {
              role: "user",
              content: JSON.stringify(cleanedBatch),
            },
          ],
          response_format: zodResponseFormat(
            TermDistractorSet,
            "term_distractor_set",
          ),
        });

        const parsed = response.choices[0]!.message.parsed;

        if (!parsed) {
          throw new Error(
            `Failed to parse term distractors response for batch ${batchIndex + 1}`,
          );
        }

        if (parsed.distractors.length !== batch.length) {
          console.warn(
            `Batch ${batchIndex + 1} attempt ${attempt + 1}: Expected ${batch.length} term distractors, got ${parsed.distractors.length}. Retrying...`,
          );
          if (attempt === MAX_RETRIES - 1) {
            throw new Error(
              `Expected ${batch.length} term distractor sets, got ${parsed.distractors.length} after ${MAX_RETRIES} attempts`,
            );
          }
          continue;
        }

        completedBatches++;
        onProgress?.(completedBatches, totalBatches);
        return parsed.distractors;
      } catch (error) {
        if (attempt === MAX_RETRIES - 1) throw error;
        console.warn(
          `Batch ${batchIndex + 1} attempt ${attempt + 1} failed:`,
          error,
        );
      }
    }

    throw new Error(
      `Failed to generate term distractors for batch ${batchIndex + 1} after ${MAX_RETRIES} attempts`,
    );
  });

  const results = await Promise.all(batchPromises);
  results.forEach((batchDistractors) => {
    allDistractors.push(...batchDistractors);
  });

  return allDistractors;
}

// Generate definition distractors (match the "answer" field)
// Basically previous code copied pasted
async function generateDefinitionDistractors(
  apiClient: OpenAI,
  flashcards: Flashcard[],
  onProgress?: (completed: number, total: number) => void,
): Promise<string[][]> {
  const BATCH_SIZE = 50;
  const allDistractors: string[][] = [];

  // Split into batches and process in parallel
  const batches: Flashcard[][] = [];
  for (let i = 0; i < flashcards.length; i += BATCH_SIZE) {
    batches.push(flashcards.slice(i, i + BATCH_SIZE));
  }

  let completedBatches = 0;
  const totalBatches = batches.length;

  // Process all batches in parallel
  const batchPromises = batches.map(async (batch, batchIndex) => {
    const cleanedBatch = batch.map((card) => card.answer);
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await apiClient.chat.completions.parse({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content: definitionPrompt,
            },
            {
              role: "user",
              content: JSON.stringify(cleanedBatch),
            },
          ],
          response_format: zodResponseFormat(
            DefinitionDistractorSet,
            "definition_distractor_set",
          ),
        });

        const parsed = response.choices[0]!.message.parsed;

        if (!parsed) {
          throw new Error(
            `Failed to parse definition distractors response for batch ${batchIndex + 1}`,
          );
        }

        if (parsed.distractors.length !== batch.length) {
          console.warn(
            `Batch ${batchIndex + 1} attempt ${attempt + 1}: Expected ${batch.length} definition distractors, got ${parsed.distractors.length}. Retrying...`,
          );
          if (attempt === MAX_RETRIES - 1) {
            throw new Error(
              `Expected ${batch.length} definition distractor sets, got ${parsed.distractors.length} after ${MAX_RETRIES} attempts`,
            );
          }
          continue;
        }

        completedBatches++;
        onProgress?.(completedBatches, totalBatches);
        return parsed.distractors;
      } catch (error) {
        if (attempt === MAX_RETRIES - 1) throw error;
        console.warn(
          `Batch ${batchIndex + 1} attempt ${attempt + 1} failed:`,
          error,
        );
      }
    }

    throw new Error(
      `Failed to generate definition distractors for batch ${batchIndex + 1} after ${MAX_RETRIES} attempts`,
    );
  });

  const results = await Promise.all(batchPromises);
  results.forEach((batchDistractors) => {
    allDistractors.push(...batchDistractors);
  });

  return allDistractors;
}

export async function generateResponse(
  flashcards: Flashcard[],
  onProgress?: (message: string) => void,
) {
  const apiClient = getClient();
  if (!apiClient) {
    throw new Error("OpenAI API key not configured");
  }

  const BATCH_SIZE = 50;
  const totalTermBatches = Math.ceil(flashcards.length / BATCH_SIZE);
  const totalDefinitionBatches = Math.ceil(flashcards.length / BATCH_SIZE);
  const totalBatches = totalTermBatches + totalDefinitionBatches;

  let completedBatches = 0;

  const updateProgress = () => {
    completedBatches++;
    onProgress?.(`${completedBatches}/${totalBatches} batches complete`);
  };

  // Generate term and definition distractors in parallel
  const [termDistractors, definitionDistractors] = await Promise.all([
    generateTermDistractors(apiClient, flashcards, () => updateProgress()),
    generateDefinitionDistractors(apiClient, flashcards, () =>
      updateProgress(),
    ),
  ]);

  // Return as JSON string with both sets
  return JSON.stringify({
    termDistractors,
    definitionDistractors,
  });
}
