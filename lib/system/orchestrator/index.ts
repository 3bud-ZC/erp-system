/**
 * SYSTEM ORCHESTRATOR - Unified Export
 * 
 * Single entry point for system orchestration:
 * - SystemOrchestrator class
 * - systemOrchestrator singleton instance
 * - All related types
 */

export {
  SystemOrchestrator,
  systemOrchestrator,
} from './system-orchestrator';

export type {
  SystemOrchestratorStatus,
  SystemOrchestratorReport,
  SmokeTestResult,
} from './system-orchestrator';

export { default } from './system-orchestrator';
