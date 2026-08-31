import { z } from 'zod';

export const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  markdown: z.string().min(1, 'Paragraph text is required'),
});

export const imageBlockSchema = z.object({
  type: z.literal('image'),
  url: z.string().url('Please enter a valid image URL'),
  caption: z.string().optional(),
  altText: z.string().optional(),
});

export const codeBlockSchema = z.object({
  type: z.literal('code'),
  language: z.string().min(1, 'Language is required'),
  code: z.string().min(1, 'Code content is required'),
});

export const calloutBlockSchema = z.object({
  type: z.literal('callout'),
  variant: z.enum(['info', 'warning', 'metric']),
  title: z.string().optional(),
  body: z.string().min(1, 'Callout body is required'),
});

export const videoBlockSchema = z.object({
  type: z.literal('video'),
  url: z.string().url('Please enter a valid video URL'),
  caption: z.string().optional(),
});

export const diagramBlockSchema = z.object({
  type: z.literal('diagram'),
  url: z.string().url('Please enter a valid diagram URL'),
  caption: z.string().optional(),
});

export const contentBlockSchema = z.discriminatedUnion('type', [
  paragraphBlockSchema,
  imageBlockSchema,
  codeBlockSchema,
  calloutBlockSchema,
  videoBlockSchema,
  diagramBlockSchema,
]);

export const contentBlocksSchema = z.array(contentBlockSchema).default([]);

export type ParagraphBlock = z.infer<typeof paragraphBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;
export type CodeBlock = z.infer<typeof codeBlockSchema>;
export type CalloutBlock = z.infer<typeof calloutBlockSchema>;
export type VideoBlock = z.infer<typeof videoBlockSchema>;
export type DiagramBlock = z.infer<typeof diagramBlockSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;

// Drives the "add block" dropdown in the admin editor — one entry per block type,
// in the order it should be offered.
export const CONTENT_BLOCK_TYPES: { value: ContentBlock['type']; label: string }[] = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'image', label: 'Image' },
  { value: 'code', label: 'Code Snippet' },
  { value: 'callout', label: 'Callout' },
  { value: 'video', label: 'Video' },
  { value: 'diagram', label: 'Diagram' },
];
