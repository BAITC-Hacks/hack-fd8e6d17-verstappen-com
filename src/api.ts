// Типизированный клиент к FastAPI. Типы повторяют backend/app/schemas.py.

export const CARD_FIELDS = [
  "title",
  "context",
  "need",
  "users",
  "data",
  "constraints",
  "expected_result",
  "success_criteria",
  "contact",
  "interaction_format",
] as const;

export type CardField = (typeof CARD_FIELDS)[number];
export type TaskCard = Record<CardField, string>;

export const FIELD_LABELS: Record<CardField, string> = {
  title: "Название",
  context: "Контекст",
  need: "Потребность",
  users: "Пользователи",
  data: "Данные и материалы",
  constraints: "Ограничения",
  expected_result: "Ожидаемый результат",
  success_criteria: "Критерии успеха",
  contact: "Контакт",
  interaction_format: "Формат взаимодействия",
};

export type Level = "draft" | "working" | "ready" | "priority";
export type TaskStatus = "open" | "in_progress" | "closed";
export type ProposalStatus = "pending" | "accepted" | "rejected";

export const LEVEL_LABELS: Record<Level, string> = {
  draft: "Черновик",
  working: "Рабочая",
  ready: "Готовая",
  priority: "Приоритетная",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Открыта",
  in_progress: "В работе",
  closed: "Закрыта",
};

export interface CriterionScore {
  key: string;
  label: string;
  weight: number;
  points: number;
  fields: CardField[];
  reason: string;
}

export interface Hint {
  field: CardField;
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
  missing_fields: CardField[];
  next_level_at: number | null;
}

export interface Question {
  field: CardField;
  text: string;
  points: number;
}

export interface AnalyzeResult {
  card: TaskCard;
  sources: Partial<Record<CardField, string>>;
  missing_fields: CardField[];
  questions: Question[];
  score: ScoreResult;
  mode: "llm" | "mock";
}

export interface BuildCardResult {
  card: TaskCard;
  sources: Partial<Record<CardField, string>>;
  score: ScoreResult;
  mode: "llm" | "mock";
}

export interface Task {
  id: number;
  title: string;
  topic: string;
  tags: string[];
  owner: string;
  draft_text: string;
  card: TaskCard;
  confirmed_fields: CardField[];
  score: number;
  level: Level;
  level_label: string;
  needs_clarification: boolean;
  recommendable: boolean;
  score_detail: ScoreResult;
  score_history: { score: number; at: string }[];
  status: TaskStatus;
  proposals_count: number;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: number;
  name: string;
  interests: string[];
  skills: string[];
  tech: string[];
  points: number;
}

export interface Proposal {
  id: number;
  task_id: number;
  task_title: string;
  team: Team;
  idea: string;
  plan: string;
  deadline: string;
  link: string;
  status: ProposalStatus;
  milestones: { note: string; points: number; at: string }[];
  created_at: string;
  decided_at: string | null;
}

export interface Recommendation {
  task: Task;
  matched: string[];
  reason: string;
}

export interface Meta {
  fields: { key: CardField; label: string }[];
  topics: string[];
  criteria: { key: string; label: string; weight: number; fields: CardField[] }[];
  levels: { min: number; key: Level; label: string }[];
}

export interface DemoDraft {
  id: number;
  industry: string;
  completeness: string;
  text: string;
}

export interface CatalogFilters {
  topic?: string;
  level?: Level;
  status?: TaskStatus;
  q?: string;
  owner?: string;
}

export interface NewTask {
  card: TaskCard;
  topic: string;
  tags: string[];
  owner: string;
  draft_text: string;
  confirmed_fields: CardField[];
}

export interface NewProposal {
  team_id: number;
  idea: string;
  plan: string;
  deadline: string;
  link: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// FastAPI отдаёт detail строкой (наши HTTPException) или массивом (ошибки валидации Pydantic)
function errorMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => `${d.loc?.slice(-1)[0] ?? ""}: ${d.msg ?? ""}`)
      .join("; ");
  }
  return `Ошибка сервера (${status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, "Сервер недоступен. Запущен ли бэкенд (./run.sh)?");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(body, res.status));
  return body as T;
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });

const patch = <T>(path: string, data: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(data) });

function query(params: object): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const api = {
  meta: () => request<Meta>("/meta"),
  demoDrafts: () => request<DemoDraft[]>("/demo/drafts"),
  reset: () => post<{ status: string }>("/admin/reset"),

  // ИИ и рейтинг
  analyze: (text: string) => post<AnalyzeResult>("/analyze", { text }),
  buildCard: (text: string, answers: { field: CardField; answer: string }[]) =>
    post<BuildCardResult>("/build-card", { text, answers }),
  score: (card: TaskCard, confirmed_fields?: CardField[]) =>
    post<ScoreResult>("/score", { card, confirmed_fields }),

  // Задачи и каталог
  catalog: (filters: CatalogFilters = {}) => request<Task[]>(`/catalog${query(filters)}`),
  task: (id: number) => request<Task>(`/tasks/${id}`),
  createTask: (body: NewTask) => post<Task>("/tasks", body),
  updateTask: (
    id: number,
    body: Partial<{ card: Partial<TaskCard>; topic: string; tags: string[]; confirmed_fields: CardField[]; status: TaskStatus }>,
  ) => patch<Task>(`/tasks/${id}`, body),
  closeTask: (id: number) => post<Task>(`/tasks/${id}/close`),

  // Отклики и выбор бизнеса
  taskProposals: (taskId: number) => request<Proposal[]>(`/tasks/${taskId}/proposals`),
  createProposal: (taskId: number, body: NewProposal) => post<Proposal>(`/tasks/${taskId}/proposals`, body),
  decide: (proposalId: number, decision: "accept" | "reject") =>
    post<Proposal>(`/proposals/${proposalId}/decision`, { decision }),
  milestone: (proposalId: number, note?: string) =>
    post<Proposal>(`/proposals/${proposalId}/milestone`, note ? { note } : {}),

  // Команды
  teams: () => request<Team[]>("/teams"),
  team: (id: number) => request<Team>(`/teams/${id}`),
  teamProposals: (teamId: number) => request<Proposal[]>(`/teams/${teamId}/proposals`),
  recommendations: (teamId: number) => request<Recommendation[]>(`/recommendations${query({ team_id: teamId })}`),
  leaderboard: () => request<Team[]>("/leaderboard"),
};
