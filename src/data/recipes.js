/* The cookbook, one spread per dish. The photo fills the left-hand
   page; the right-hand page carries the occasion, the ingredients and
   the method.

   `image` is a path under /public (e.g. "/cooking/ghormeh-sabzi.jpg").
   Leave it null until there is a photo and the page shows a placeholder
   card in its place, so a missing file never renders as a broken image.

   `occasion` is the story: who it was for, where, why that night. Two
   or three sentences read best. `ingredients` and `steps` are the quick
   version written from memory, not the full method. */
export const RECIPES = [
  {
    id: "ghormeh-sabzi",
    title: "Ghormeh Sabzi",
    date: "Oct 2026",
    time: "3 hrs",
    serves: "8",
    image: "/cooking/ghormeh-sabzi.jpg",
    occasion:
      "A big pot for a table of friends, with hummus, olives and a shirazi salad crowding in around it. The herbs took most of the afternoon to chop and nobody noticed, which is the point.",
    ingredients: [
      "600g lamb shoulder, cubed",
      "2 onions, finely diced",
      "3 bunches parsley",
      "2 bunches coriander",
      "1 bunch chives or spring onion",
      "2 tbsp dried fenugreek leaves",
      "1 tin red kidney beans",
      "4 dried limes, pierced",
      "1 tsp turmeric",
      "Oil, salt, black pepper",
    ],
    steps: [
      "Brown the onions in plenty of oil, add turmeric, then the lamb, and colour it on all sides.",
      "Chop the herbs very finely and fry them in a separate pan until dark green and fragrant, about 15 minutes, then stir in the fenugreek.",
      "Add the herbs to the lamb with the dried limes and enough water to cover, and simmer gently for two hours.",
      "Add the kidney beans for the last half hour, season, and serve over rice with a good tahdig.",
    ],
  },
  {
    id: "arayes",
    title: "Arayes",
    date: "Sep 2026",
    time: "40 min",
    serves: "4",
    image: null,
    occasion:
      "Made on a weeknight when the fridge had mince, pitta and not much else. They went from pan to plate to gone in about ten minutes.",
    ingredients: [
      "500g lamb or beef mince",
      "1 onion, grated and squeezed",
      "2 tomatoes, deseeded and diced",
      "Handful parsley, chopped",
      "2 cloves garlic, crushed",
      "1 tsp each cumin, allspice, paprika",
      "4 pitta breads",
      "Olive oil, salt, pepper",
    ],
    steps: [
      "Mix the mince with the onion, tomato, parsley, garlic and spices, and season well.",
      "Halve the pittas, open the pockets and spread a thin, even layer of the mix inside each.",
      "Brush with olive oil and cook in a hot pan or on a grill, pressing down, until crisp and the meat is cooked through.",
      "Cut into wedges and eat with yoghurt, lemon and pickles.",
    ],
  },
  {
    id: "biryani",
    title: "Biryani",
    date: "Aug 2026",
    time: "2 hrs",
    serves: "6",
    image: null,
    occasion:
      "A Sunday project, started after lunch and ready in time for dinner. Layered in the biggest pot in the house and carried to the table still sealed.",
    ingredients: [
      "800g chicken thighs, bone in",
      "400g basmati rice",
      "250g yoghurt",
      "3 onions, thinly sliced and fried crisp",
      "2 tbsp ginger garlic paste",
      "2 green chillies",
      "Mint and coriander, a handful each",
      "2 tbsp biryani masala",
      "Pinch of saffron in warm milk",
      "Ghee, whole spices, salt",
    ],
    steps: [
      "Marinate the chicken in yoghurt, ginger garlic paste, chillies, masala, half the fried onions and salt for at least an hour.",
      "Parboil the rice with whole spices and salt until just under done, and drain.",
      "Layer the chicken in a heavy pot, then the rice, then the herbs, remaining onions, saffron milk and ghee.",
      "Seal the lid tightly and cook on the lowest heat for 40 minutes, then rest for 10 before opening.",
    ],
  },
];
