export interface ProgressData {
  docId: string;
  status: 'started' | 'processing' | 'importing' | 'completed' | 'failed';
  message: string;
  complete?: number;
  total?: number;
  percentage?: number;
  error?: string;
}