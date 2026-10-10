/** Starting areas per city. These match the planner's coordinates in backend/app/services/planner.py. */
export const CITY_AREAS = {
  Chennai: [
    'Alwarpet', 'Adyar', 'Besant Nagar', 'Mylapore', 'Nungambakkam',
    'T. Nagar', 'Anna Nagar', 'Egmore', 'Guindy', 'Velachery',
    'ECR / Neelankarai', 'Muttukadu / Kovalam', 'Marina Beach',
  ],
  Coimbatore: [
    'R.S. Puram', 'Gandhipuram', 'Peelamedu', 'Race Course',
    'Saibaba Colony', 'Ukkadam',
  ],
  Madurai: [
    'Anna Nagar', 'KK Nagar', 'Goripalayam', 'Mattuthavani',
    'Town Hall Road', 'Vandiyur',
  ],
};

export const CITIES = Object.keys(CITY_AREAS);

/** Local YYYY-MM-DD (toISOString is UTC and can be a day off in India). */
export const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
