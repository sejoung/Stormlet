import type { TextColor } from './text/model';

export const MAX_NOTE_LENGTH = 3000;
export const MIN_NOTE_FONT = 8;
export const MAX_NOTE_FONT = 144;
/** Size a note uses when automatic fitting is off and no size was chosen. */
export const DEFAULT_NOTE_FONT = 24;
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export const REACTION_EMOJI = ['👍', '❤️', '🎉', '💡', '✅', '👀'] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];
/**
 * Icons a note can show above its text, for diagrams such as system architecture
 * (ADR 0018). Generic names only: products are named in the note's text.
 */
export const NOTE_ICONS = [
  'user',
  'team',
  'web',
  'browser',
  'mobile',
  'desktop',
  'server',
  'service',
  'api',
  'gateway',
  'load-balancer',
  'network',
  'database',
  'cache',
  'queue',
  'stream',
  'storage',
  'files',
  'cloud',
  'function',
  'container',
  'cluster',
  'auth',
  'key',
  'lock',
  'mail',
  'message',
  'notification',
  'search',
  'analytics',
  'monitoring',
  'logs',
  'scheduler',
  'worker',
  'code',
  'config',
  'document',
  'payment',
  'external',
  'ai',
  // Kubernetes objects, by kind (ADR 0019).
  'k8s-pod',
  'k8s-deployment',
  'k8s-replicaset',
  'k8s-statefulset',
  'k8s-daemonset',
  'k8s-job',
  'k8s-cronjob',
  'k8s-service',
  'k8s-ingress',
  'k8s-egress',
  'k8s-namespace',
  'k8s-node',
  'k8s-configmap',
  'k8s-secret',
  'k8s-volume',
  'k8s-autoscaler',
  'k8s-helm',
  'k8s-registry',
  'k8s-operator',
] as const;
export type NoteIcon = (typeof NOTE_ICONS)[number];
/** Whether `icon` stands for a Kubernetes object; the picker lists those in their own group. */
export const isKubernetesIcon = (icon: NoteIcon): boolean => icon.startsWith('k8s-');
export const isNoteIcon = (value: unknown): value is NoteIcon =>
  (NOTE_ICONS as readonly unknown[]).includes(value);
export interface Reaction {
  emoji: string;
  people: readonly string[];
}

/** Optional fields keep original boards and field-level history compatible. */
export interface NoteDetails {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: TextAlign;
  textColor?: TextColor;
  /** An icon above a sticky note's text; `null` once removed. */
  icon?: NoteIcon | null;
  autoFont?: boolean;
  fontSize?: number;
  groupId?: string | null;
  locked?: boolean;
  reactions?: readonly Reaction[];
}
