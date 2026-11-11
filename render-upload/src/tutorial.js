// One-time, mandatory tutorial: four short lessons, then a 1v1 with the MENTOR.
// Winning the duel gives the MENTOR knife, $450 and an exclusive wrap. Skipping gives nothing.
export const TUTORIAL_REWARD = { cash: 450, knifeId: 'mentor_fang', wrapId: 'wrap_fissure' };

// Index 4 is the duel announcement; the duel starts a moment after it is shown.
export const TUTORIAL_STEPS = [
  { id: 'move', text: '1/4 · Move with WASD (3 m).' },
  { id: 'jump', text: '2/4 · Ugorj a SPACE-szel.' },
  { id: 'slash', text: '3/4 · Slash with your knife: left mouse button.' },
  { id: 'throw', text: '4/4 · Throw your knife: right mouse button.' },
  { id: 'duel', text: 'Duel time! Beat the MENTOR for his knife, $450 and a rare wrap.' }
];

export function tutorialStatus(profile) {
  return profile.tutorial?.status ?? 'pending';
}

// Mandatory until it is either completed or skipped.
export function tutorialRequired(profile) {
  return tutorialStatus(profile) === 'pending';
}

export function skipTutorial(profile) {
  profile.tutorial = { status: 'skipped' };
}

/** Grants the reward once. Returns the granted reward, or null if nothing was granted. */
export function completeTutorial(profile) {
  if (tutorialStatus(profile) !== 'pending') return null;
  profile.tutorial = { status: 'done' };
  profile.cash += TUTORIAL_REWARD.cash;
  if (!profile.unlockedSkins.includes(TUTORIAL_REWARD.knifeId)) profile.unlockedSkins.push(TUTORIAL_REWARD.knifeId);
  if (!profile.unlockedWraps.includes(TUTORIAL_REWARD.wrapId)) profile.unlockedWraps.push(TUTORIAL_REWARD.wrapId);
  return { ...TUTORIAL_REWARD };
}
