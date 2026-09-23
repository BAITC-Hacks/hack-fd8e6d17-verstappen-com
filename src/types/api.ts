/** Generated from backend/app/schemas.py. Keep aligned with the Pydantic API contract. */

export type CardField =
  | "title"
  | "context"
  | "need"
  | "users"
  | "data"
  | "constraints"
  | "expected_result"
  | "success_criteria"
  | "contact"
  | "interaction_format";

export type Level = "draft" | "working" | "ready" | "priority";
export type TaskStatus = "open" | "in_progress" | "closed";
export type ProposalStatus = "pending" | "accepted" | "rejected";
export type AiMode = "llm" | "mock";

export interface TaskCard {
  title: string;
  context: string;
  need: string;
  users: string;
  data: string;
  constraints: string;
  expected_result: string;
  success_criteria: string;
  contact: string;
  interaction_format: string;
}

export interface CriterionScore {
  key: string;
  label: string;
  weight: number;
  points: number;
  fields: string[];
  reason: string;
}

export interface Hint {
  field: string;
  label: string;
  gain: number;
  text: string;
}

export interface ScoreResult {
  total: number;
  level: Level;
  level_label: string;
  breakdown: CriterionScore[];
  hints: Hint[];
  missing_fields: string[];
  next_level_at: number | null;
}

export interface ScoreRequest {
  card: TaskCard;
  confirmed_fields?: string[] | null;
}

export interface AnalyzeRequest {
  text: string;
}

export interface Question {
  field: string;
  text: string;
  points: number;
}

export interface AnalyzeResult {
  card: TaskCard;
  sources: Record<string, string>;
  missing_fields: string[];
  questions: Question[];
  score: ScoreResult;
  mode: AiMode;
}

export interface Answer {
  field: string;
  answer: string;
}

export interface BuildCardRequest {
  text: string;
  answers?: Answer[];
}

export interface BuildCardResult {
  card: TaskCard;
  sources: Record<string, string>;
  score: ScoreResult;
  mode: AiMode;
}

export interface TaskCreate {
  card: TaskCard;
  topic?: string;
  tags?: string[];
  owner?: string;
  draft_text?: string;
  confirmed_fields: string[];
}

export interface TaskUpdate {
  card?: Partial<Record<CardField, string>> | null;
  topic?: string | null;
  tags?: string[] | null;
  confirmed_fields?: string[] | null;
  status?: TaskStatus | null;
}

export interface TaskOut {
  id: number;
  title: string;
  topic: string;
  tags: string[];
  owner: string;
  draft_text: string;
  card: TaskCard;
  confirmed_fields: string[];
  score: number;
  level: Level;
  level_label: string;
  needs_clarification: boolean;
  recommendable: boolean;
  score_detail: ScoreResult;
  score_history: Array<Record<string, unknown>>;
  status: TaskStatus;
  proposals_count: number;
  created_at: string;
  updated_at: string;
}

export interface TeamOut {
  id: number;
  name: string;
  interests: string[];
  skills: string[];
  tech: string[];
  points: number;
}

export interface ProposalCreate {
  team_id: number;
  idea: string;
  plan: string;
  deadline: string;
  link: string;
}

export interface ProposalOut {
  id: number;
  task_id: number;
  task_title: string;
  team: TeamOut;
  idea: string;
  plan: string;
  deadline: string;
  link: string;
  status: ProposalStatus;
  milestones: Array<Record<string, unknown>>;
  created_at: string;
  decided_at: string | null;
}

export interface Decision {
  decision: "accept" | "reject";
}

export interface MilestoneCreate {
  note?: string;
}

export interface Recommendation {
  task: TaskOut;
  matched: string[];
  reason: string;
}

export interface MetaResponse {
  fields: Array<{ key: CardField; label: string }>;
  topics: string[];
  criteria: CriterionScore[];
  levels: Array<{ min: number; key: Level; label: string }>;
}

export interface ApiError {
  detail: string | Array<Record<string, unknown>>;
}
