/** Taste quiz options, shared by the partner quiz and "Make it more personal". */

export const QUIZ_CUISINES = [
  'South Indian',
  'Continental',
  'Café & Bakery',
  'Italian',
  'Mediterranean',
  'North Indian / Tandoor',
  'Desserts & Gelato',
  'Coastal Seafood',
];

export const QUIZ_VIBES = [
  'Quiet & Intimate',
  'Romantic Garden',
  'Vintage / Pastel',
  'Beachside & Breezy',
  'Artsy & Bohemian',
  'Candlelight',
  'Heritage & Cultural',
];

export const QUIZ_ACTIVITIES = [
  'Pottery Workshop',
  'Board Game Café',
  'Sunset Promenade',
  'Art Gallery Walk',
  'Historic Museum',
  'Backwater Boating',
];

const slug = (label) => label.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-');

/** Quiz picks in the shape the backend expects. */
export function toAnswers({ cuisines = [], vibes = [], activities = [], dietary = 'none', dislikes = '', priceComfort = 'mid' }) {
  return {
    cuisines: cuisines.map(slug),
    vibes: vibes.map(slug),
    activities: activities.map((a) => a.toLowerCase().replace(/\s+/g, '-')),
    dietary_signals: dietary !== 'none' ? [dietary] : [],
    dislikes: dislikes.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
    price_comfort: priceComfort,
  };
}
