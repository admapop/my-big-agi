import { z } from 'zod';

import { fetchJsonOrTRPCError } from '~/server/api/trpc.router.fetchers';


export const publishToInputSchema = z.object({
  to: z.enum(['paste.gg']),
  title: z.string(),
  fileContent: z.string(),
  fileName: z.string(),
  origin: z.string(),
});

export const publishToOutputSchema = z.object({
  url: z.string(),
  expires: z.string(),
  deletionKey: z.string(),
  created: z.string(),
});

export type PublishedSchema = z.infer<typeof publishToOutputSchema>;

/**
 * Post a paste to paste.gg
 * [called by the API]
 *  - API description: https://github.com/ascclemens/paste/blob/master/api.md
 *
 * @param title Title of the paste
 * @param fileName File with extension, e.g. 'conversation.md'
 * @param fileContent Textual content (e.g. markdown text)
 * @param origin the URL of the page that generated the paste
 * @param expireDays Number of days after which the paste will expire (0 = never expires, default = 30)
 */
export async function postToPasteGGOrThrow(title: string, fileName: string, fileContent: string, origin: string, expireDays: number = 30): Promise<PasteGGWire.PasteResponse> {

  // Default: expire in 30 days
  let expires = null;
  if (expireDays && expireDays >= 1) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expireDays);
    expires = expirationDate.toISOString();
  }

  const pasteData: PasteGGWire.PasteRequest = {
    name: title,
    description: `Generated by ${origin} 🚀`,
    visibility: 'unlisted',
    ...(expires && { expires }),
    files: [{
      name: fileName,
      content: {
        format: 'text',
        value: fileContent,
      },
    }],
  };

  return await fetchJsonOrTRPCError<PasteGGWire.PasteResponse, PasteGGWire.PasteRequest>('https://api.paste.gg/v1/pastes', 'POST', { 'Content-Type': 'application/json' }, pasteData, 'PasteGG');
}


namespace PasteGGWire {

  export interface PasteRequest {
    name?: string;
    description?: string;
    visibility?: 'public' | 'unlisted' | 'private';
    expires?: string;
    files: PasteFile[];
  }

  interface PasteFile {
    name?: string;
    content: {
      format: 'text' | 'base64' | 'gzip' | 'xz';
      highlight_language?: string | null;
      value: string;
    };
  }

  export type PasteResponse = {
    status: 'success'
    result: PasteRequest & {
      id: string;
      created_at: string;
      updated_at: string;
      files: {
        id: string;
        name: string;
        highlight_language?: string | null;
      }[];
      deletion_key?: string;
    };
  } | {
    status: 'error';
    error: string;
    message?: string;
  }

}