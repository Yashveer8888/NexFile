import { aiAssistantService } from '../src/services/ai/aiAssistantService';

describe('aiAssistantService', () => {
  beforeEach(() => {
    // Service state persists audit logs
  });

  test('resolves storage health intent', async () => {
    const response = await aiAssistantService.processQuery('How much free space do I have on storage?');
    expect(response.intent).toBe('storage_health');
    expect(response.text).toContain('GB');
    expect(response.sender).toBe('assistant');
  });

  test('resolves find PDF files intent', async () => {
    const response = await aiAssistantService.processQuery('Find all PDF files');
    expect(response.intent).toBe('find_files');
    expect(response.matchedFiles).toBeDefined();
    expect(response.text).toContain('PDF');
  });

  test('resolves find large files intent', async () => {
    const response = await aiAssistantService.processQuery('Show me big large files taking up room');
    expect(response.intent).toBe('find_large_files');
    expect(response.matchedFiles).toBeDefined();
    expect(response.matchedFiles!.length).toBeGreaterThan(0);
  });

  test('resolves duplicate files intent and enforces user confirmation gate', async () => {
    const response = await aiAssistantService.processQuery('Find duplicate files on my phone');
    expect(response.intent).toBe('find_duplicates');
    expect(response.actionRequest).toBeDefined();
    expect(response.actionRequest?.type).toBe('cleanup');
    expect(response.actionRequest?.requiresConfirmation).toBe(true);
    expect(response.actionRequest?.affectedFiles.length).toBeGreaterThan(0);
  });

  test('resolves organize downloads intent and enforces user confirmation gate', async () => {
    const response = await aiAssistantService.processQuery('Can you organize my downloads folder?');
    expect(response.intent).toBe('organize_folder');
    expect(response.actionRequest).toBeDefined();
    expect(response.actionRequest?.type).toBe('organize');
    expect(response.actionRequest?.requiresConfirmation).toBe(true);
  });

  test('resolves summarize document intent', async () => {
    const response = await aiAssistantService.processQuery('Summarize this document for me');
    expect(response.intent).toBe('summarize_document');
    expect(response.text).toContain('Document Summary');
  });

  test('resolves OCR / extract text intent', async () => {
    const response = await aiAssistantService.processQuery('Extract OCR text from this image');
    expect(response.intent).toBe('extract_text');
    expect(response.text).toContain('Extracted text');
  });

  test('returns fallback message for unknown queries', async () => {
    const response = await aiAssistantService.processQuery('What is the weather in Tokyo?');
    expect(response.intent).toBe('unknown');
    expect(response.text).toContain("offline local AI assistant");
  });

  test('maintains security audit trail for local operations', async () => {
    const logs = aiAssistantService.getAuditLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((log) => log.includes('USER QUERY:'))).toBe(true);
  });
});

