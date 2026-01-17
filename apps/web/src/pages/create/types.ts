export type MessageRole = "user" | "system" | "tool" | "result";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
};

export type InspectorStage = "choosing_options" | "running" | "complete";
export type InspectorTab = "preview" | "assets" | "export";

export type TemplateSnippet = {
  id: string;
  label: string;
  template: string;
};

export type AssetItem = {
  id: string;
  label: string;
  href: string;
  kind: string;
};

export type AdvancedSettings = {
  model: string;
  seed: string;
  resolution: string;
};

export type StyleOption = {
  id: string;
  title: string;
  description: string;
};

export type MoodOption = {
  id: string;
  label: string;
};
