export type Column = { header: string; key: string; width?: number; type?: "text" | "money" | "number" | "percent" };
export type Report = {
  title: string;
  subtitle?: string;
  orgName?: string;
  columns: Column[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, string | number | null>;
  filename: string;
  landscape?: boolean;
};
