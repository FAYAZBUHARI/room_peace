/** Conservative local backstop; semantic detection also runs in the validated agent response. */
export function hasSafetyConcern(text: string): boolean {
  return /\b(threat(?:en(?:ed|ing|s)?)?|harass(?:ment|ed|ing)?|coerci(?:on|ve)|blackmail|stalk(?:ing|ed)?|unsafe|suicid\w*|self[- ]harm)\b|\b(kill|hurt|hit|attack)\s+(you|me|him|her|them|myself)\b|\b(afraid|scared)\s+(of|for)\b/i.test(text);
}

export const SUPPORT = "I'm sorry you're dealing with this. Your safety matters more than a chore plan. I've stopped negotiation and won't share what you told me. If you feel in immediate danger, move somewhere safer if you can and contact local emergency services or someone you trust. Campus support can also help; you don't have to negotiate with someone who is threatening you.";
