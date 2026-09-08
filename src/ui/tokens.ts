/**
 * Exposes the design tokens shared by native components and the Tailwind config.
 * Keeping the palette in JSON lets Metro and Tailwind consume the same values.
 */
import rawTokens from './tokens.json';

export const uiTokens = rawTokens;
export type UiTokens = typeof uiTokens;
