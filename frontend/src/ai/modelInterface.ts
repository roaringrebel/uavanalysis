// ============================================================
// AI Model Interface
// ============================================================
// Abstract interface to allow swapping between local mock models
// and real remote DL inference models (via REST/WebSocket).
// ============================================================

export interface AIModelInterface<TInput, TOutput> {
  readonly modelName: string;
  readonly modelType: string;
  readonly isSimulated: boolean;
  
  predict(input: TInput): Promise<TOutput>;
}
