declare module "word-extractor" {
  export type WordExtractorDocument = {
    getBody(): string;
    getHeaders(options?: { includeFooters?: boolean }): string;
    getTextboxes(options?: {
      includeHeadersAndFooters?: boolean;
      includeBody?: boolean;
    }): string;
  };

  export default class WordExtractor {
    extract(input: Buffer | string): Promise<WordExtractorDocument>;
  }
}
