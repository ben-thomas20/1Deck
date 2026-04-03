import { ChatService } from '../chat-service';
import evalSet from './eval-set.json';

interface EvalCase {
  id: string;
  category: string;
  question: string;
  expected_answer_contains: string[];
  expected_answer_not_contains: string[];
  difficulty: string;
}

export interface EvalResult {
  evalId: string;
  category: string;
  passed: boolean;
  response: string;
  retrievedChunks: string[];
  latencyMs: number;
  details: string;
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  percentage: number;
  byCategory: Record<string, { total: number; passed: number; percentage: number }>;
  results: EvalResult[];
}

/**
 * Run a single eval case against the chat service.
 */
async function runEvalCase(chatService: ChatService, evalCase: EvalCase): Promise<EvalResult> {
  const start = Date.now();

  try {
    const { response, retrievedChunks } = await chatService.chat(evalCase.question);
    const latencyMs = Date.now() - start;
    const responseLower = response.toLowerCase();

    // Check expected_answer_contains
    const missingContains = evalCase.expected_answer_contains.filter(
      term => !responseLower.includes(term.toLowerCase())
    );

    // Check expected_answer_not_contains
    const foundNotContains = evalCase.expected_answer_not_contains.filter(
      term => responseLower.includes(term.toLowerCase())
    );

    const passed = missingContains.length === 0 && foundNotContains.length === 0;

    let details = '';
    if (missingContains.length > 0) {
      details += `Missing expected terms: ${missingContains.join(', ')}. `;
    }
    if (foundNotContains.length > 0) {
      details += `Found forbidden terms: ${foundNotContains.join(', ')}. `;
    }
    if (passed) {
      details = 'All criteria met.';
    }

    return {
      evalId: evalCase.id,
      category: evalCase.category,
      passed,
      response,
      retrievedChunks,
      latencyMs,
      details,
    };
  } catch (err) {
    return {
      evalId: evalCase.id,
      category: evalCase.category,
      passed: false,
      response: '',
      retrievedChunks: [],
      latencyMs: Date.now() - start,
      details: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Run all eval cases and produce a report.
 */
export async function runEvals(chatService: ChatService): Promise<EvalReport> {
  const cases = evalSet as EvalCase[];
  const results: EvalResult[] = [];

  console.log(`Running ${cases.length} eval cases...\n`);

  for (const evalCase of cases) {
    process.stdout.write(`  [${evalCase.id}] ${evalCase.question.slice(0, 50)}... `);
    const result = await runEvalCase(chatService, evalCase);
    results.push(result);
    console.log(result.passed ? 'PASS' : `FAIL (${result.details})`);
  }

  // Aggregate
  const passed = results.filter(r => r.passed).length;
  const byCategory: EvalReport['byCategory'] = {};

  for (const result of results) {
    if (!byCategory[result.category]) {
      byCategory[result.category] = { total: 0, passed: 0, percentage: 0 };
    }
    byCategory[result.category].total++;
    if (result.passed) byCategory[result.category].passed++;
  }

  for (const cat of Object.values(byCategory)) {
    cat.percentage = Math.round((cat.passed / cat.total) * 100);
  }

  const report: EvalReport = {
    total: cases.length,
    passed,
    failed: cases.length - passed,
    percentage: Math.round((passed / cases.length) * 100),
    byCategory,
    results,
  };

  return report;
}

/**
 * Format an eval report for console output.
 */
export function formatReport(report: EvalReport): string {
  let output = '\n═══════════════════════════════════\n';
  output += `  EVAL RESULTS: ${report.passed}/${report.total} passed (${report.percentage}%)\n`;
  output += '═══════════════════════════════════\n\n';

  output += '  By category:\n';
  for (const [category, stats] of Object.entries(report.byCategory)) {
    const bar = stats.percentage === 100 ? '████' : stats.percentage >= 75 ? '███░' : '██░░';
    output += `    ${category.padEnd(25)} ${stats.passed}/${stats.total} (${stats.percentage}%) ${bar}\n`;
  }

  const failures = report.results.filter(r => !r.passed);
  if (failures.length > 0) {
    output += '\n  Failed cases:\n';
    for (const f of failures) {
      output += `    [${f.evalId}] ${f.details}\n`;
    }
  }

  return output;
}
